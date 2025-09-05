from fastapi import FastAPI
from typing import List
import random
import math
from datetime import datetime, timedelta
from fastapi.middleware.cors import CORSMiddleware
from sklearn.cluster import KMeans
import numpy as np
import os
from supabase import create_client
from dotenv import load_dotenv
import uvicorn
import joblib
import pandas as pd
import logging
import json  # for safer coords parsing
import pickle  # Add this import
from sklearn.base import BaseEstimator
from sklearn.ensemble import RandomForestClassifier  # Add this import
from geopy.geocoders import Nominatim

os.environ['OMP_NUM_THREADS'] = '1'  # Add this at the top with other imports

app = FastAPI(title="AIC Senior Care MVP")
load_dotenv('.env.local')
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase = create_client(url, key)

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------
# Helper Functions
# -------------------------------
def get_sg_coords():
    return {
        "lat": round(random.uniform(1.16, 1.47), 4),
        "lng": round(random.uniform(103.6, 104.0), 4)
    }

def get_iso_time(days=0, hour=0, minute=0):
    dt = datetime.now() + timedelta(days=days)
    dt = dt.replace(hour=hour, minute=minute, second=0, microsecond=0)
    return dt.isoformat() + "+08:00"

def distance(coord1, coord2):
    return math.sqrt((coord1["lat"] - coord2["lat"])**2 + (coord1["lng"] - coord2["lng"])**2)

def kmeans_clusters(coords_list, n_clusters):
    X = np.array([[c['lat'], c['lng']] for c in coords_list])
    kmeans = KMeans(n_clusters=n_clusters, 
                    n_init=10, 
                    random_state=42,)  # Let scikit-learn decide based on dataset size
    kmeans.fit(X)
    return kmeans.labels_, kmeans.cluster_centers_

def cluster_density(cluster_seniors):
    if len(cluster_seniors) < 2:
        return 1.0
    lats = [s['coords']['lat'] for s in cluster_seniors]
    lngs = [s['coords']['lng'] for s in cluster_seniors]
    area = max((max(lats)-min(lats)) * (max(lngs)-min(lngs)), 0.001)
    return len(cluster_seniors) / area

def is_available(vol, slot):
    return slot in vol.get('available', [])

# Add helper functions for name lookup
def get_volunteer_name(vid, volunteers):
    """Get volunteer name from ID"""
    volunteer = next((v for v in volunteers if v['vid'] == vid), None)
    return volunteer['name'] if volunteer else vid

def get_senior_name(uid, seniors):
    """Get senior name from UID"""
    senior = next((s for s in seniors if s['uid'] == uid), None)
    return senior['name'] if senior else uid

# -------------------------------
# Core Endpoints
# -------------------------------
@app.post("/assess")
def classify_seniors(data: dict):
    try:
        # Load the model
        current_dir = os.path.dirname(os.path.abspath(__file__))
        model_data = joblib.load(os.path.join(current_dir, 'seniorModel', 'training', 'senior_risk_model.pkl'))
        model = model_data["model"]

        # Get seniors data and prepare features
        seniors = data.get("seniors", [])
        if not seniors:
            return {"assessments": []}

        # Create DataFrame with required features
        df = pd.DataFrame(seniors)
        features = ['age', 'physical', 'mental', 'dl_intervention', 'rece_gov_sup', 
                   'community', 'making_ends_meet', 'living_situation']
        X = df[features]

        # Get predictions and probabilities
        predictions = model.predict(X)  # 1=LOW, 2=MEDIUM, 3=HIGH wellbeing
        probabilities = model.predict_proba(X)

        # Update wellbeing scores in database
        for i, senior in enumerate(seniors):
            try:
                supabase.table("seniors").update(
                    {"overall_wellbeing": int(predictions[i])}
                ).eq("uid", senior['uid']).execute()
            except Exception as e:
                logger.error(f"Failed to update wellbeing for senior {senior['uid']}: {str(e)}")

        # Create assessments with inverted mapping (low wellbeing = high priority)
        assessments = []
        wellbeing_to_priority = {
            1: "HIGH",    # LOW wellbeing → HIGH priority
            2: "MEDIUM",  # MEDIUM wellbeing → MEDIUM priority
            3: "LOW"      # HIGH wellbeing → LOW priority
        }
        
        for i, senior in enumerate(seniors):
            prediction = int(predictions[i])  # wellbeing level
            probs = probabilities[i]
            max_prob = max(probs)
            
            # Calculate risk score based on physical, mental and community metrics
            risk_score = (
                float(senior.get('physical', 0)) + 
                float(senior.get('mental', 0)) + 
                float(senior.get('community', 0))
            ) / 15  # Normalize to 0-1 range

            assessments.append({
                "uid": senior['uid'],
                "risk": round(risk_score, 2),
                "priority": wellbeing_to_priority.get(prediction, "MEDIUM"),
                "needscare": risk_score > 0.6 or prediction == 1,  # Needs care if high risk or low wellbeing
                "confidence": round(float(max_prob), 2),
                "wellbeing": prediction  # Added this to show original wellbeing score
            })

        return {"assessments": assessments}

    except Exception as e:
        logger.error(f"Error in classify_seniors: {str(e)}", exc_info=True)
        return {"error": str(e), "assessments": []}




@app.get("/get_slots/{email}")
def get_slots(email: str):
    """Fetch volunteer availability slots"""
    try:
        if not email:
            return {"error": "email is required"}

        response = supabase.table("availabilities").select("*").eq("volunteer_email", email).execute()
        if not response.data:
            logger.info(f"No availability slots found for volunteer {email}")
            return {"email": email, "slots": []}

        slots = []
        for record in response.data:
            date_str = record.get("date")
            start_time_str = record.get("start_t")
            end_time_str = record.get("end_t")

            if not date_str or not start_time_str or not end_time_str:
                logger.warning(f"Incomplete slot data in record: {record}")
                continue

            try:
                start_dt = datetime.fromisoformat(f"{date_str}T{start_time_str}+08:00")
                end_dt = datetime.fromisoformat(f"{date_str}T{end_time_str}+08:00")
                slots.append({
                    "date": date_str,
                    "start_time": start_dt.isoformat(),
                    "end_time": end_dt.isoformat()
                })
            except ValueError as ve:
                logger.error(f"Error parsing datetime for record {record}: {ve}")
                continue

        logger.info(f"Retrieved {len(slots)} slots for volunteer {email}")
        return {"email": email, "slots": slots}

    except Exception as e:
        logger.error(f"Error in get_slots: {str(e)}", exc_info=True)
        return {"error": "Internal server error"}
    

@app.post("/upload_slots")
def upload_slots(data: dict):
    """Upload volunteer availability slots"""
    try:
        email = data.get("email")
        slots = data.get("slots", [])
        
        if not email:
            return {"error": "email is required"}

        if not slots:
            return {"error": "slots list is required"}
        
        # Validate slot format
        processed_slots = []
        dates_to_clear = set()  # Track unique dates for deletion
        
        for i, slot in enumerate(slots):
            if not isinstance(slot, dict):
                return {"error": f"Slot {i} must be an object"}
            
            start_time = slot.get("start_time")
            end_time = slot.get("end_time")
            
            if not start_time or not end_time:
                return {"error": f"Slot {i} must have both start_time and end_time"}
            
            # Validate datetime format (ISO format expected)
            try:
                # Parse to validate format
                start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                
                if end_dt <= start_dt:
                    return {"error": f"Slot {i}: end_time must be after start_time"}
                
                date_str = start_dt.date().isoformat()
                dates_to_clear.add(date_str)  # Add date to deletion set
                
                processed_slots.append({
                    "start_time": start_time,
                    "end_time": end_time,
                    "date": date_str,  # Extract date for database
                    "start_time_only": start_dt.time().isoformat(),  # Extract time portion only
                    "end_time_only": end_dt.time().isoformat(),  # Extract time portion only
                    "duration_minutes": int((end_dt - start_dt).total_seconds() / 60)
                })
                
            except ValueError as e:
                return {"error": f"Slot {i}: Invalid datetime format - {str(e)}"}
        
        # Delete existing slots for the same email and dates
        try:
            deleted_count = 0
            for date_str in dates_to_clear:
                delete_response = supabase.table("availabilities").delete().eq("volunteer_email", email).eq("date", date_str).execute()
                if delete_response.data:
                    deleted_count += len(delete_response.data)
            
            logger.info(f"Deleted {deleted_count} existing slots for volunteer {email} on dates: {list(dates_to_clear)}")
            
        except Exception as delete_error:
            logger.error(f"Error deleting existing slots: {str(delete_error)}")
            return {"error": f"Failed to delete existing slots: {str(delete_error)}"}
        
        # Insert each slot as a separate row in availabilities table
        try:
            inserted_rows = []
            
            for slot in processed_slots:
                # Insert individual availability record matching your table schema
                response = supabase.table("availabilities").insert({
                    "volunteer_email": email,  # Changed from volunteer_id to email to match your table
                    "date": slot["date"],
                    "start_t": slot["start_time_only"],  # Now just the time portion (e.g., "11:00:00")
                    "end_t": slot["end_time_only"]  # Now just the time portion (e.g., "13:00:00")
                }).execute()
                
                if response.data:
                    inserted_rows.extend(response.data)
                else:
                    logger.warning(f"Failed to insert slot: {slot}")
            
            logger.info(f"Inserted {len(inserted_rows)} availability slots for volunteer {email}")
            
            return {
                "success": True,
                "email": email,
                "deleted_slots": deleted_count,
                "slots_uploaded": len(inserted_rows),
                "slots": processed_slots,
                "inserted_records": len(inserted_rows)
            }
            
        except Exception as db_error:
            logger.error(f"Database error: {str(db_error)}")
            return {"error": f"Failed to insert availability slots: {str(db_error)}"}
        
    except Exception as e:
        logger.error(f"Error in upload_slots: {str(e)}")
        return {"error": "Internal server error"}

    
@app.post("/allocate")
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


@app.get("/assignments")
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

@app.post("/schedule")
def create_schedule(data: dict):
    assignments = data.get("assignments", [])
    seniors = data.get("seniors", [])
    volunteers = data.get("volunteers", [])

    logger.info(f"Creating schedule for {len(assignments)} assignments, {len(seniors)} seniors, {len(volunteers)} volunteers")

    if not assignments or not seniors or not volunteers:
        logger.warning("Missing required data for scheduling")
        return {"schedules": []}

    # Create email to volunteer ID mapping
    vol_email_to_id = {vol['email']: vol['vid'] for vol in volunteers}
    volunteer_map = {vol['vid']: vol for vol in volunteers}

    # Get all volunteer availabilities for the next week
    try:
        # Get availabilities for all volunteers
        availabilities_resp = supabase.table("availabilities").select("*").execute()
        availabilities = availabilities_resp.data if availabilities_resp.data else []
        logger.info(f"Found {len(availabilities)} availability slots")
        
        # Log raw availability data for debugging
        if availabilities:
            logger.info(f"Sample raw availability: {availabilities[0]}")
        
        # Group availabilities by volunteer
        volunteer_availabilities = {}
        for avail in availabilities:
            try:
                vol_email = avail['volunteer_email']
                if vol_email in vol_email_to_id:
                    vid = vol_email_to_id[vol_email]
                    if vid not in volunteer_availabilities:
                        volunteer_availabilities[vid] = []
                    
                    # Log raw data before processing
                    logger.info(f"Processing availability - Date: {avail['date']}, Start: {avail['start_t']}, End: {avail['end_t']}")
                    
                    # Ensure date and time are properly formatted
                    date_str = avail['date']
                    start_time = avail['start_t']
                    end_time = avail['end_t']
                    
                    # Format date consistently
                    if isinstance(date_str, datetime):
                        formatted_date = date_str.strftime('%Y-%m-%d')
                    else:
                        formatted_date = datetime.strptime(date_str, '%Y-%m-%d').strftime('%Y-%m-%d')
                    
                    # Format times consistently
                    formatted_start = datetime.strptime(start_time, '%H:%M:%S').strftime('%H:%M')
                    formatted_end = datetime.strptime(end_time, '%H:%M:%S').strftime('%H:%M')
                    
                    volunteer_availabilities[vid].append({
                        'date': formatted_date,
                        'start': formatted_start,
                        'end': formatted_end
                    })
                    logger.info(f"Processed availability for volunteer {vid}: {formatted_date} {formatted_start}-{formatted_end}")
            except Exception as e:
                logger.error(f"Error processing availability: {str(e)}, Data: {avail}")
                continue

    except Exception as e:
        logger.error(f"Error fetching availabilities: {str(e)}")
        return {"schedules": []}

    # Sort seniors by priority (wellbeing) and risk
    seniors_with_priority = []
    for senior in seniors:
        priority_score = 0
        if senior.get('overall_wellbeing') == 1:  # Low wellbeing
            priority_score += 3
        elif senior.get('overall_wellbeing') == 2:  # Medium wellbeing
            priority_score += 2
        risk_score = senior.get('risk', 0)
        seniors_with_priority.append({
            **senior,
            'priority_score': priority_score + risk_score
        })

    seniors_sorted = sorted(seniors_with_priority, 
                          key=lambda s: s['priority_score'], 
                          reverse=True)

    # Create schedule - maximum one visit per senior
    schedules = []
    used_slots = {}  # Track used time slots
    scheduled_seniors = set()  # Track which seniors have been scheduled

    for assignment in assignments:
        vol_id = assignment['volunteer']
        cluster_id = assignment['cluster']
        
        vol_slots = volunteer_availabilities.get(vol_id, [])
        if not vol_slots:
            continue

        # Get unscheduled seniors in this cluster, sorted by priority
        cluster_seniors = [
            s for s in seniors_sorted 
            if s.get('cluster') == cluster_id and s['uid'] not in scheduled_seniors
        ]
        
        logger.info(f"Processing cluster {cluster_id}: {len(cluster_seniors)} unscheduled seniors for volunteer {vol_id}")
        
        # Schedule one visit per senior until no more slots available
        for senior in cluster_seniors:
            # Find first available slot
            for slot in vol_slots:
                slot_key = f"{vol_id}_{slot['date']}_{slot['start']}"
                if slot_key in used_slots:
                    continue

                schedule_entry = {
                    "volunteer": vol_id,
                    "senior": senior['uid'],
                    "cluster": cluster_id,
                    "date": slot['date'],
                    "start_time": slot['start'],
                    "end_time": slot['end'],
                    "priority_score": senior['priority_score']
                }
                
                schedules.append(schedule_entry)
                
                # Enhanced logging with names
                volunteer_name = get_volunteer_name(vol_id, volunteers)
                senior_name = get_senior_name(senior['uid'], seniors)
                logger.info(f"Sample schedule entry: {json.dumps(schedule_entry, indent=2)} - Volunteer: {volunteer_name}, Senior: {senior_name}")
                
                used_slots[slot_key] = True
                scheduled_seniors.add(senior['uid'])
                break  # Move to next senior after scheduling one visit

    stats = {
        "total_scheduled": len(schedules),
        "unique_seniors": len(set(s['senior'] for s in schedules)),
        "unique_volunteers": len(set(s['volunteer'] for s in schedules))
    }
    
    logger.info(f"Schedule generation complete. Stats: {stats}")
    if schedules:
        # Enhanced sample logging with names
        sample_entry = schedules[0]
        volunteer_name = get_volunteer_name(sample_entry['volunteer'], volunteers)
        senior_name = get_senior_name(sample_entry['senior'], seniors)
        logger.info(f"Sample schedule entry: {json.dumps(sample_entry, indent=2)} - Volunteer: {volunteer_name}, Senior: {senior_name}")
        
        if len(schedules) > 1:
            sample_entry2 = schedules[1]
            volunteer_name2 = get_volunteer_name(sample_entry2['volunteer'], volunteers)
            senior_name2 = get_senior_name(sample_entry2['senior'], seniors)
            logger.info(f"Sample schedule entry: {json.dumps(sample_entry2, indent=2)} - Volunteer: {volunteer_name2}, Senior: {senior_name2}")
    else:
        logger.warning("No schedules created")
    
    return {
        "schedules": schedules,
        "stats": stats
    }

# -------------------------------
# Data Endpoints
# -------------------------------

@app.get("/seniors")
def get_seniors():  # Changed from get_senior to get_seniors
    response = supabase.table("seniors").select("*").execute()
    logger.info(f"Fetched {len(response.data)} seniors")
    return {"seniors": response.data}

@app.get("/volunteers")
def get_volunteers():  # This was correct but adding logging
    response = supabase.table("volunteers").select("*").execute()
    logger.info(f"Fetched {len(response.data)} volunteers")
    return {"volunteers": response.data}

@app.get("/schedules")
def get_schedules():
    try:
        logger.info("Fetching schedule data")
        assignments_data = get_assignments()
        
        if not assignments_data.get("assignments"):
            logger.warning("No assignments available for scheduling")
            return {"schedules": [], "clusters": [], "cluster_density": {}, "stats": {}}

        schedule_result = create_schedule({
            "assignments": assignments_data["assignments"],
            "seniors": assignments_data.get("seniors", []),
            "volunteers": assignments_data.get("volunteers", [])
        })

        logger.info(f"Generated {len(schedule_result.get('schedules', []))} schedules")
        return {
            "schedules": schedule_result.get("schedules", []),
            "clusters": assignments_data.get("clusters", []),
            "cluster_density": assignments_data.get("cluster_density", {}),
            "stats": schedule_result.get("stats", {})
        }

    except Exception as e:
        logger.error(f"Error in get_schedules: {str(e)}", exc_info=True)
        return {"schedules": [], "clusters": [], "cluster_density": {}, "stats": {}}

@app.get("/schedules/{user_email}")
def get_user_schedules(user_email: str):
    geolocator = Nominatim(user_agent="geoapi")
    try:
        schedules_resp = supabase.table("assignments").select("*, seniors:sid(name, coords)").eq("volunteer_email", user_email).execute()

        # logger.info(schedules_resp)

        if not schedules_resp.data:
            logger.warning(f"No schedules found for user: {user_email}")
            return {"schedules": []}
       
        schedules = []
        for schedule in schedules_resp.data:
            seniors = schedule.get("seniors", {})
            coords = seniors.get("coords")

            if coords:
                try:
                    lat, lng = coords["lat"], coords["lng"]
                    location = geolocator.reverse((lat, lng), language="en")
                    # Replace coords with readable string
                    seniors["coords"] = location.address  
                except Exception as e:
                    seniors["coords"] = None  # fallback

            schedules.append({
                "aid": schedule["aid"],
                # "vid": schedule["vid"],
                # "sid": schedule["sid"],
                "date": schedule["date"],
                "start_time": schedule["start_time"],
                "end_time": schedule["end_time"],
                "is_acknowledged": schedule["is_acknowledged"],
                # "volunteer_email": schedule["volunteer_email"],
                "senior_name": seniors["name"],
                "address": seniors.get("coords"),
            })

        return {"data": schedules}

    except Exception as e:
        logger.error(f"Error in get_user_schedules: {str(e)}", exc_info=True)
        return {"schedules": []}

@app.put("/acknowledgements")
def update_acknowledgements(aid: dict[str, str]):
    #logger.info(f"Updating acknowledgements for aids: {aid}")
    list_aid = list(aid.values())

    #logger.info(f"List of AIDs to acknowledge: {list_aid}")
    response = supabase.table("assignments").update(
        {"is_acknowledged": True}
    ).in_("aid", list_aid).execute()

    return {"success": response.data}

# -------------------------------j
# Health Check
# -------------------------------
@app.get("/")
def health():
    return {"status": "OK", "time": get_iso_time()}

if __name__ == "__main__":
    uvicorn.run("api:app", port=8000, reload=True)