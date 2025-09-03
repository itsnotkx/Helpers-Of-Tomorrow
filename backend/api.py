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

# -------------------------------
# Core Endpoints
# -------------------------------
@app.post("/assess")
def classify_seniors(data: dict):
    """Classify seniors with ML model and return risk assessments"""
    seniors = data.get("seniors", [])
    if not seniors:
        logger.warning("No seniors provided for assessment")
        return {"assessments": []}

    try:
        logger.info(f"Starting assessment for {len(seniors)} seniors")
        current_dir = os.path.dirname(os.path.abspath(__file__))
        model_path = os.path.join(current_dir, 'seniorModel', 'training', 'senior_risk_model.pkl')
        
        if not os.path.exists(model_path):
            logger.error(f"Model file not found at {model_path}")
            raise FileNotFoundError("Model file not found")
            
        logger.info("Loading model...")
        try:
            # Use only joblib since it works
            model_data = joblib.load(model_path)
            logger.info("Model loaded using joblib")
            
            # Extract the model object
            if isinstance(model_data, dict):
                model = model_data.get('model')
            else:
                model = model_data
                
            # Verify it's a valid model
            if not isinstance(model, RandomForestClassifier):
                logger.error(f"Invalid model type: {type(model)}")
                raise TypeError("Model is not a RandomForestClassifier")
                
            logger.info(f"Model type: {type(model)}")
            
        except Exception as load_error:
            logger.error(f"Model loading failed: {load_error}")
            raise Exception(f"Failed to load valid model: {str(load_error)}")

        # Create DataFrame from seniors data
        df = pd.DataFrame(seniors)
        
        # Prepare features as expected by the model
        feature_cols = ['age', 'physical', 'mental', 'dl_intervention', 'rece_gov_sup',
                       'community', 'making_ends_meet', 'living_situation']
        
        # Fill missing values
        for col in feature_cols:
            if col not in df.columns:
                if col in ['dl_intervention', 'rece_gov_sup']:
                    df[col] = 'No'
                elif col == 'making_ends_meet':
                    df[col] = 'Manageable'
                elif col == 'living_situation':
                    df[col] = 'Alone'
                elif col == 'community':
                    df[col] = 'Low'
                else:
                    df[col] = 0

        # Map categorical values
        yes_mapping = {'Yes': 1, 'No': 0}
        meeting_ends_mapping = {'Struggling': 1, 'Manageable': 2, 'Comfortable': 3}
        living_situation_mapping = {'Alone': 1, 'With Spouse': 2, 'With Family': 3, 'Assisted Living': 4}
        low_high_mapping = {'Low': 1, 'Medium': 2, 'High': 3}

        for col in df.select_dtypes(include=['object']).columns:
            if col == 'making_ends_meet':
                df[col] = df[col].map(meeting_ends_mapping)
            elif col == 'living_situation':
                df[col] = df[col].map(living_situation_mapping)
            elif col == 'community':
                df[col] = df[col].map(low_high_mapping)
            elif col in ["dl_intervention", 'rece_gov_sup']:
                df[col] = df[col].map(yes_mapping)

        logger.info(f"Features prepared: {feature_cols}")
        logger.debug(f"Feature data sample: {df.head()}")
        
        try:
            # Convert features to numpy array if needed
            X = df[feature_cols]  # Keep as DataFrame to preserve feature names
            predictions = model.predict(X)
            probabilities = model.predict_proba(X)
            logger.info("Successfully made predictions")
            
            # Ensure predictions are in valid range
            predictions = np.clip(predictions, 0, 2)  # Clip to valid range 0-2
            
        except Exception as pred_error:
            logger.error(f"Prediction failed: {pred_error}")
            logger.error(f"Feature shape: {df[feature_cols].shape}")
            logger.error(f"Features head: \n{df[feature_cols].head()}")
            raise Exception(f"Model prediction failed: {pred_error}")
        
        logger.info(f"Predictions completed. Distribution: {pd.Series(predictions).value_counts().to_dict()}")
        
        # Create assessments with fixed class mapping
        assessments = []
        class_mapping = {0: "LOW", 1: "MEDIUM", 2: "HIGH"}
        
        for i, senior in enumerate(seniors):
            prediction = int(predictions[i])  # Ensure integer
            probs = probabilities[i]
            max_prob = max(probs)
            risk_score = (senior.get('physical', 0) + senior.get('mental', 0) + senior.get('community', 0)) / 15

            assessments.append({
                "uid": senior['uid'],
                "risk": risk_score,
                "priority": class_mapping.get(prediction, "MEDIUM"),  # Default to MEDIUM if invalid
                "needscare": risk_score > 0.6,
                "confidence": float(max_prob)
            })

        return {"assessments": assessments}

    except Exception as e:
        logger.error(f"Error in classify_seniors: {str(e)}", exc_info=True)
        return {
            "assessments": [
                {
                    "uid": s['uid'],
                    "risk": (s.get('physical', 0) + s.get('mental', 0) + s.get('community', 0)) / 15,
                    "priority": "HIGH" if (s.get('physical', 0) + s.get('mental', 0) + s.get('community', 0)) / 15 > 0.7 
                              else "MEDIUM" if (s.get('physical', 0) + s.get('mental', 0) + s.get('community', 0)) / 15 > 0.4 
                              else "LOW",
                    "needscare": (s.get('physical', 0) + s.get('mental', 0) + s.get('community', 0)) / 15 > 0.6,
                    "confidence": 0.8  # Default confidence for fallback
                }
                for s in seniors
            ]
        }

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
                
                processed_slots.append({
                    "start_time": start_time,
                    "end_time": end_time,
                    "date": start_dt.date().isoformat(),  # Extract date for database
                    "start_time_only": start_dt.time().isoformat(),  # Extract time portion only
                    "end_time_only": end_dt.time().isoformat(),  # Extract time portion only
                    "duration_minutes": int((end_dt - start_dt).total_seconds() / 60)
                })
                
            except ValueError as e:
                return {"error": f"Slot {i}: Invalid datetime format - {str(e)}"}
        
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
    
    # Step 1: K-means clustering of seniors (~5 per cluster)
    n_clusters = max(1, len(seniors)//5)
    n_clusters = min(n_clusters, len(seniors))  # ensure <= num seniors
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
    
    for cluster_id, cluster_seniors in clusters.items():
        # Calculate density
        density = cluster_density(cluster_seniors)
        cluster_density_map[int(cluster_id)] = float(density)
        
        # Calculate radius - distance from centroid to farthest senior
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
    
    # Step 4: Assign volunteers to clusters
    assignments = []
    for vol in volunteers:
        vol_coords = vol.get('coords')
        if not vol_coords:
            continue
        best_cluster = None
        min_weighted_dist = float('inf')
        
        for cluster_id, cluster_seniors in clusters.items():
            centroid = {'lat': float(centroids[cluster_id][0]), 'lng': float(centroids[cluster_id][1])}
            weighted_dist = distance(vol_coords, centroid) / cluster_density_map[cluster_id]
            
            if vol.get('prefers_outside', False):
                weighted_dist *= 0.8  # preference adjustment
                
            if weighted_dist < min_weighted_dist:
                min_weighted_dist = weighted_dist
                best_cluster = cluster_id
        
        assignments.append({
            "volunteer": vol['vid'],
            "cluster": best_cluster,
            "weighted_distance": round(min_weighted_dist, 4)
        })
    
    # Step 5: Format clusters for frontend
    clusters_output = []
    for cluster_id, cluster_seniors in clusters.items():
        clusters_output.append({
            "id": cluster_id,
            "center": {"lat": float(centroids[cluster_id][0]), "lng": float(centroids[cluster_id][1])},
            "radius": cluster_radius_map[cluster_id],  # Add radius to output
            "seniors": cluster_seniors,
            "senior_count": len(cluster_seniors)
        })
    
    return {
        "assignments": assignments,
        "clusters": clusters_output,
        "cluster_density": cluster_density_map,
        "cluster_radius": cluster_radius_map  # Include radius map in response
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
            return {"assignments": [], "clusters": [], "cluster_density": {}}

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
        return result

    except Exception as e:
        logger.error(f"Error in get_assignments: {str(e)}", exc_info=True)
        return {"assignments": [], "clusters": [], "cluster_density": {}}

@app.post("/schedule")
def create_schedule(data: dict):
    assignments = data.get("assignments", [])
    seniors = data.get("seniors", [])
    volunteers = data.get("volunteers", [])

    # Map volunteer ID to volunteer object for availability check
    volunteer_map = {vol['vid']: vol for vol in volunteers}

    schedules = []
    time_slots = [9, 11, 14, 16]

    seniors_sorted = sorted(seniors, key=lambda s: s.get('risk', 0), reverse=True)

    for assignment in assignments:
        vol_id = assignment['volunteer']
        cluster_id = assignment['cluster']
        vol_obj = volunteer_map.get(vol_id)
        if not vol_obj:
            continue
        cluster_seniors = [s for s in seniors_sorted if s.get('cluster') == cluster_id]
        for senior in cluster_seniors:
            for day_offset in range(1, 8):
                for hour in time_slots:
                    dt = get_iso_time(days=day_offset, hour=hour)
                    if is_available(vol_obj, dt):
                        schedules.append({
                            "volunteer": vol_id,
                            "senior": senior['uid'],
                            "cluster": cluster_id,
                            "datetime": dt,
                            "duration": 60
                        })
                        break
                else:
                    continue
                break
    return {"schedules": schedules}

@app.get("/schedules")
def get_schedules():
    try:
        logger.info("Fetching schedule data")
        assignments_data = get_assignments()
        
        if not assignments_data.get("assignments"):
            logger.warning("No assignments available for scheduling")
            return {"schedules": [], "clusters": [], "cluster_density": {}}

        schedules = create_schedule({
            "assignments": assignments_data["assignments"],
            "seniors": assignments_data.get("seniors", []),
            "volunteers": assignments_data.get("volunteers", [])
        })

        logger.info(f"Generated {len(schedules.get('schedules', []))} schedules")
        return {
            "schedules": schedules["schedules"],
            "clusters": assignments_data["clusters"],
            "cluster_density": assignments_data["cluster_density"]
        }

    except Exception as e:
        logger.error(f"Error in get_schedules: {str(e)}", exc_info=True)
        return {"schedules": [], "clusters": [], "cluster_density": {}}

# Classify seniors to get their overall wellbeing.
@app.get("/classify-seniors")
def get_senior_wellbeing():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    model = joblib.load(os.path.join(current_dir, 'seniorModel', 'training', 'senior_risk_model.pkl'))["model"]
    print(model)
    response = supabase.table("seniors").select("*").execute()
    data = response.data
    df = pd.DataFrame(data)
    features = ['age', 'physical', 'mental', 'dl_intervention', 'rece_gov_sup', 'community', 'making_ends_meet', 'living_situation']
    X = df[features]
    df["overall_wellbeing"] = model.predict(X)

    for idx, row in df.iterrows():
        supabase.table("seniors").update({"overall_wellbeing": int(row["overall_wellbeing"])}).eq("uid", row["uid"]).execute()

    return {"status": "success"}

# -------------------------------
# Data Endpoints
# -------------------------------

@app.get("/seniors")
def get_senior():
    response = supabase.table("seniors").select("*").execute()
    return {"seniors": response.data}

@app.get("/volunteers")
def get_volunteers():
    response = supabase.table("volunteers").select("*").execute()
    return {"volunteers": response.data}

@app.get("/senior/{uid}")
def get_senior(uid: str):
    """Get senior details from DB"""
    response = supabase.table("seniors").select("*").eq("uid", uid).single().execute()
    return response.data

@app.get("/volunteer/{vid}")
def get_volunteer(vid: str):
    """Get volunteer details from DB"""
    response = supabase.table("volunteers").select("*").eq("vid", vid).single().execute()
    return response.data

@app.get("/district/{name}")
def get_district_data(name: str):
    """Get district overview from DB"""
    response = supabase.table("districts").select("*").eq("name", name).single().execute()
    return response.data



# -------------------------------
# Health Check
# -------------------------------
@app.get("/")
def health():
    return {"status": "OK", "time": get_iso_time()}

if __name__ == "__main__":
    uvicorn.run("api:app", port=8000, reload=True)