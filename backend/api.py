from fastapi import FastAPI
from typing import List
import random
import math
from datetime import datetime, timedelta
from fastapi.middleware.cors import CORSMiddleware
from sklearn.cluster import KMeans
import numpy as np

app = FastAPI(title="AIC Senior Care MVP")

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
    kmeans = KMeans(n_clusters=n_clusters, n_init=10, random_state=42)
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
def assess_seniors(seniors: List[dict]):
    results = []
    for senior in seniors:
        physical = senior.get("physical", 3)
        mental = senior.get("mental", 3) 
        community = senior.get("community", 3)
        risk = (5-physical)*0.4 + (5-mental)*0.3 + (5-community)*0.3
        risk = risk / 5
        results.append({
            "uid": senior.get("uid"),
            "risk": round(risk, 2),
            "priority": "HIGH" if risk > 0.7 else "MEDIUM" if risk > 0.4 else "LOW",
            "needscare": risk > 0.6
        })
    return {"assessments": results}

@app.post("/allocate")
def allocate_volunteers(data: dict):
    volunteers = data.get("volunteers", [])
    seniors = data.get("seniors", [])

    if len(seniors) == 0:
        return {"assignments": [], "cluster_density": {}, "seniors": []}

    # Step 1: K-means clustering of seniors (~5 per cluster)
    n_clusters = max(1, len(seniors)//5)
    n_clusters = min(n_clusters, len(seniors))  # ensure <= num seniors

    labels, centroids = kmeans_clusters([s['coords'] for s in seniors], n_clusters)

    # Step 2: Assign seniors to clusters
    clusters = {i: [] for i in range(n_clusters)}
    for idx, senior in enumerate(seniors):
        cluster_id = int(labels[idx])  # convert NumPy int to Python int
        clusters[cluster_id].append(senior)
        senior['cluster'] = cluster_id

    # Step 3: Calculate cluster density
    cluster_density_map = {int(i): float(cluster_density(cluster)) for i, cluster in clusters.items()}

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

    return {"assignments": assignments, "cluster_density": cluster_density_map, "seniors": seniors}

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

# -------------------------------
# Demo Data Endpoints
# -------------------------------
@app.get("/demo/seniors")
def generate_demo_seniors(count: int = 10):
    seniors = []
    for i in range(count):
        seniors.append({
            "uid": f"senior_{i}",
            "coords": get_sg_coords(),
            "physical": random.randint(1, 5),
            "mental": random.randint(1, 5),
            "community": random.randint(1, 5),
        })
    return {"seniors": seniors}

@app.get("/demo/volunteers")
def generate_demo_volunteers(count: int = 5):
    volunteers = []
    for i in range(count):
        available_slots = [get_iso_time(days=d, hour=h) for d in range(1, 8) for h in [9,11,14,16]]
        volunteers.append({
            "vid": f"vol_{i}",
            "coords": get_sg_coords(),
            "skill": random.randint(1, 3),
            "available": available_slots
        })
    return {"volunteers": volunteers}

# -------------------------------
# Health Check
# -------------------------------
@app.get("/")
def health():
    return {"status": "OK", "time": get_iso_time()}

# -------------------------------
# Run Server
# -------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:main:app", host="localhost", port=8000, reload=True)
