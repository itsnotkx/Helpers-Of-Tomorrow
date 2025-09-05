from fastapi import APIRouter # type: ignore
from config.settings import logger, supabase
from utils.helpers import cluster_density, kmeans_clusters, distance
from services.assessments import classify_seniors

import json  # for safer coords parsing

router = APIRouter(tags=["assignment"])

@router.post("/assess")
def assess_seniors(data: dict):
    return classify_seniors(data)

@router.post("/allocate")
def allocate_volunteers(data: dict):
    volunteers = data.get("volunteers", [])
    seniors = data.get("seniors", [])
    if len(seniors) == 0:
        return {"assignments": [], "clusters": [], "cluster_density": {}, "seniors": []}
    
    # Calculate optimal number of clusters based on volunteer-to-senior ratio
    # Use 1:3 ratio (1 volunteer per 3 seniors) as optimal target
    target_ratio = 3  # seniors per volunteer
    recommended_clusters = max(1, len(seniors) // (target_ratio * max(1, len(volunteers))))
    min_clusters = max(1, len(seniors) // 6)  # max 6 seniors per cluster
    max_clusters = len(seniors) // 2  # min 2 seniors per cluster
    n_clusters = max(min_clusters, min(recommended_clusters, max_clusters))
    
    # Step 1: K-means clustering of seniors
    labels, centroids = kmeans_clusters([s['coords'] for s in seniors], n_clusters)
    
    # Step 2: Assign seniors to clusters
    clusters = {i: [] for i in range(n_clusters)}
    for idx, senior in enumerate(seniors):
        cluster_id = int(labels[idx])
        clusters[cluster_id].append(senior)
        senior['cluster'] = cluster_id
    
    # Step 3: Calculate cluster density and radius
    cluster_density_map = {}
    cluster_radius_map = {}
    volunteers_per_cluster = {i: 0 for i in range(n_clusters)}  # Track volunteers per cluster
    
    for cluster_id, cluster_seniors in clusters.items():
        density = cluster_density(cluster_seniors)
        cluster_density_map[int(cluster_id)] = float(density)
        
        if cluster_seniors:
            centroid_coords = {'lat': float(centroids[cluster_id][0]), 'lng': float(centroids[cluster_id][1])}
            max_distance = 0
            
            for senior in cluster_seniors:
                dist = distance(senior['coords'], centroid_coords)
                max_distance = max(max_distance, dist)
            
            # Add a small buffer (10% extra) to ensure all seniors are visually within the circle
            radius = max_distance * 1.1
            # Set minimum radius for visual clarity (e.g., 200 meters)
            radius = max(radius, 0.2)  # 0.2 km = 200 meters
        else:
            radius = 0.2  # default minimum radius
            
        cluster_radius_map[int(cluster_id)] = float(radius)
    
    # Step 4: Assign volunteers to clusters with workload balancing
    assignments = []
    for vol in volunteers:
        vol_coords = vol.get('coords')
        if not vol_coords:
            continue
        
        best_cluster = None
        min_weighted_dist = float('inf')
        
        for cluster_id, cluster_seniors in clusters.items():
            if not cluster_seniors:  # Skip empty clusters
                continue
                
            centroid = {'lat': float(centroids[cluster_id][0]), 'lng': float(centroids[cluster_id][1])}
            base_dist = distance(vol_coords, centroid)
            
            # Workload factor: increases with more volunteers assigned
            workload_factor = 1 + (volunteers_per_cluster[cluster_id] / max(1, len(cluster_seniors)))
            # Density factor: decreases with higher density
            density_factor = 1 / max(0.1, cluster_density_map[cluster_id])
            
            weighted_dist = base_dist * workload_factor * density_factor
            
            if vol.get('prefers_outside', False):
                weighted_dist *= 0.8
                
            if weighted_dist < min_weighted_dist:
                min_weighted_dist = weighted_dist
                best_cluster = cluster_id
        
        if best_cluster is not None:
            volunteers_per_cluster[best_cluster] += 1
            assignments.append({
                "volunteer": vol['vid'],
                "cluster": best_cluster,
                "weighted_distance": round(min_weighted_dist, 4)
            })
    
    # Rest of the function remains the same
    clusters_output = []
    for cluster_id, cluster_seniors in clusters.items():
        clusters_output.append({
            "id": cluster_id,
            "center": {"lat": float(centroids[cluster_id][0]), "lng": float(centroids[cluster_id][1])},
            "radius": cluster_radius_map[cluster_id],
            "seniors": cluster_seniors,
            "senior_count": len(cluster_seniors),
            "volunteer_count": volunteers_per_cluster[cluster_id]  # Added this field
        })
    
    return {
        "assignments": assignments,
        "clusters": clusters_output,
        "cluster_density": cluster_density_map,
        "cluster_radius": cluster_radius_map
    }

@router.get("/assignments")
def get_assignments():
    """Fetch seniors and volunteers, parse coords, and run clustering"""
    try:
        logger.info("Fetching assignments data from Supabase")
        seniors_resp = supabase.table("seniors").select("*").execute()
        volunteers_resp = supabase.table("volunteers").select("*").execute()

        if not seniors_resp.data or not volunteers_resp.data:
            logger.warning("No data retrieved from Supabase")
            return {"assignments": [], "clusters": [], "cluster_density": {}, "seniors": [], "volunteers": []}

        seniors = seniors_resp.data
        volunteers = volunteers_resp.data
        
        logger.info(f"Processing {len(seniors)} seniors and {len(volunteers)} volunteers")

        # Parse coordinates and handle errors
        for s in seniors:
            try:
                coords = s.get("coords")
                if isinstance(coords, str):
                    s["coords"] = json.loads(coords)
                elif not isinstance(coords, dict):
                    s["coords"] = {"lat": 1.3521, "lng": 103.8198}  # Default to Singapore center
            except Exception as e:
                logger.error(f"Error parsing senior coords: {e}")
                s["coords"] = {"lat": 1.3521, "lng": 103.8198}

        for v in volunteers:
            try:
                coords = v.get("coords")
                if isinstance(coords, str):
                    v["coords"] = json.loads(coords)
                elif not isinstance(coords, dict):
                    v["coords"] = {"lat": 1.3521, "lng": 103.8198}
            except Exception as e:
                logger.error(f"Error parsing volunteer coords: {e}")
                v["coords"] = {"lat": 1.3521, "lng": 103.8198}

        result = allocate_volunteers({"seniors": seniors, "volunteers": volunteers})
        logger.info(f"Successfully created {len(result['assignments'])} assignments")
        
        # Include the processed seniors and volunteers in the return value
        return {
            "assignments": result["assignments"],
            "clusters": result["clusters"],
            "cluster_density": result["cluster_density"],
            "cluster_radius": result["cluster_radius"],
            "seniors": seniors,  # Include processed seniors with their cluster assignments
            "volunteers": volunteers  # Include processed volunteers for scheduling
        }

    except Exception as e:
        logger.error(f"Error in get_assignments: {str(e)}", exc_info=True)
        return {
            "assignments": [], 
            "clusters": [], 
            "cluster_density": {},
            "cluster_radius": {},
            "seniors": [],
            "volunteers": []
        }

@router.put("/acknowledgements")
def update_acknowledgements(aid: dict[str, str]):
    #logger.info(f"Updating acknowledgements for aids: {aid}")
    list_aid = list(aid.values())

    #logger.info(f"List of AIDs to acknowledge: {list_aid}")
    response = supabase.table("assignments").update(
        {"is_acknowledged": True}
    ).in_("aid", list_aid).execute()

    return {"success": response.data}