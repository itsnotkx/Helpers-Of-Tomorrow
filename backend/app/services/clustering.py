# import numpy as np
# from sklearn.cluster import KMeans
# from utils.helpers import distance

# def kmeans_clusters(coords_list, n_clusters):
#     X = np.array([[c['lat'], c['lng']] for c in coords_list])
#     kmeans = KMeans(n_clusters=n_clusters, 
#                     n_init=10, 
#                     random_state=42)
#     kmeans.fit(X)
#     return kmeans.labels_, kmeans.cluster_centers_

# def cluster_density(cluster_seniors):
#     if len(cluster_seniors) < 2:
#         return 1.0
#     lats = [s['coords']['lat'] for s in cluster_seniors]
#     lngs = [s['coords']['lng'] for s in cluster_seniors]
#     area = max((max(lats)-min(lats)) * (max(lngs)-min(lngs)), 0.001)
#     return len(cluster_seniors) / area

# def allocate_volunteers(data: dict):
#     volunteers = data.get("volunteers", [])
#     seniors = data.get("seniors", [])
    
#     if len(seniors) == 0:
#         return {"assignments": [], "clusters": [], "cluster_density": {}, "seniors": []}
    
#     # Calculate optimal number of clusters
#     target_ratio = 3
#     recommended_clusters = max(1, len(seniors) // (target_ratio * max(1, len(volunteers))))
#     min_clusters = max(1, len(seniors) // 6)
#     max_clusters = len(seniors) // 2
#     n_clusters = max(min_clusters, min(recommended_clusters, max_clusters))
    
#     # K-means clustering
#     labels, centroids = kmeans_clusters([s['coords'] for s in seniors], n_clusters)
    
#     # Assign seniors to clusters
#     clusters = {i: [] for i in range(n_clusters)}
#     for idx, senior in enumerate(seniors):
#         cluster_id = int(labels[idx])
#         clusters[cluster_id].append(senior)
#         senior['cluster'] = cluster_id
    
#     # Calculate cluster density and radius
#     cluster_density_map = {}
#     cluster_radius_map = {}
#     volunteers_per_cluster = {i: 0 for i in range(n_clusters)}
    
#     for cluster_id, cluster_seniors in clusters.items():
#         density = cluster_density(cluster_seniors)
#         cluster_density_map[int(cluster_id)] = float(density)
        
#         if cluster_seniors:
#             centroid_coords = {'lat': float(centroids[cluster_id][0]), 'lng': float(centroids[cluster_id][1])}
#             max_distance = 0
            
#             for senior in cluster_seniors:
#                 dist = distance(senior['coords'], centroid_coords)
#                 max_distance = max(max_distance, dist)
            
#             radius = max(max_distance * 1.1, 0.2)
#         else:
#             radius = 0.2
            
#         cluster_radius_map[int(cluster_id)] = float(radius)
    
#     # Assign volunteers to clusters
#     assignments = []
#     for vol in volunteers:
#         vol_coords = vol.get('coords')
#         if not vol_coords:
#             continue
        
#         best_cluster = None
#         min_weighted_dist = float('inf')
        
#         for cluster_id, cluster_seniors in clusters.items():
#             if not cluster_seniors:
#                 continue
                
#             centroid = {'lat': float(centroids[cluster_id][0]), 'lng': float(centroids[cluster_id][1])}
#             base_dist = distance(vol_coords, centroid)
            
#             workload_factor = 1 + (volunteers_per_cluster[cluster_id] / max(1, len(cluster_seniors)))
#             density_factor = 1 / max(0.1, cluster_density_map[cluster_id])
            
#             weighted_dist = base_dist * workload_factor * density_factor
            
#             if vol.get('prefers_outside', False):
#                 weighted_dist *= 0.8
                
#             if weighted_dist < min_weighted_dist:
#                 min_weighted_dist = weighted_dist
#                 best_cluster = cluster_id
        
#         if best_cluster is not None:
#             volunteers_per_cluster[best_cluster] += 1
#             assignments.append({
#                 "volunteer": vol['vid'],
#                 "cluster": best_cluster,
#                 "weighted_distance": round(min_weighted_dist, 4)
#             })
    
#     # Format clusters output
#     clusters_output = []
#     for cluster_id, cluster_seniors in clusters.items():
#         clusters_output.append({
#             "id": cluster_id,
#             "center": {"lat": float(centroids[cluster_id][0]), "lng": float(centroids[cluster_id][1])},
#             "radius": cluster_radius_map[cluster_id],
#             "seniors": cluster_seniors,
#             "senior_count": len(cluster_seniors),
#             "volunteer_count": volunteers_per_cluster[cluster_id]
#         })
    
#     return {
#         "assignments": assignments,
#         "clusters": clusters_output,
#         "cluster_density": cluster_density_map,
#         "cluster_radius": cluster_radius_map
#     }