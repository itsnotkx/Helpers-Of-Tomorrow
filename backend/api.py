from fastapi import FastAPI
from typing import List
import random
import math
from datetime import datetime, timedelta

app = FastAPI(title="AIC Senior Care MVP")

# -------------------------------
# Helper Functions
# -------------------------------
def get_sg_coords():
    """Random Singapore coordinates"""
    return {
        "lat": round(random.uniform(1.16, 1.47), 4),
        "lng": round(random.uniform(103.6, 104.0), 4)
    }

def get_iso_time(days=0):
    """ISO8601 timestamp"""
    return (datetime.now() + timedelta(days=days)).isoformat() + "+08:00"

def distance(coord1, coord2):
    """Simple distance calculation"""
    return math.sqrt((coord1["lat"] - coord2["lat"])**2 + (coord1["lng"] - coord2["lng"])**2)

# -------------------------------
# Core Endpoints
# -------------------------------

@app.post("/assess")
def assess_seniors(seniors: List[dict]):
    """Score seniors using decision tree logic"""
    results = []
    for senior in seniors:
        # Simple weighted scoring
        physical = senior.get("physical", 3)
        mental = senior.get("mental", 3) 
        community = senior.get("community", 3)
        
        risk = (5-physical)*0.4 + (5-mental)*0.3 + (5-community)*0.3
        risk = risk / 5  # Normalize to 0-1
        
        results.append({
            "uid": senior.get("uid"),
            "risk": round(risk, 2),
            "priority": "HIGH" if risk > 0.7 else "MEDIUM" if risk > 0.4 else "LOW",
            "needscare": risk > 0.6
        })
    
    return {"assessments": results}

@app.post("/allocate")
def allocate_volunteers(data: dict):
    """Assign volunteers to seniors by proximity"""
    volunteers = data.get("volunteers", [])
    seniors = data.get("seniors", [])
    
    # Simple clustering - group seniors by area
    clusters = {}
    for senior in seniors:
        cluster_id = f"area_{int(senior.get('coords', {}).get('lat', 1.3) * 100) % 5}"
        if cluster_id not in clusters:
            clusters[cluster_id] = []
        clusters[cluster_id].append(senior)
    
    assignments = []
    for vol in volunteers:
        vol_coords = vol.get("coords", get_sg_coords())
        
        # Find nearest cluster
        nearest_cluster = None
        min_dist = float('inf')
        
        for cluster_id, cluster_seniors in clusters.items():
            if cluster_seniors:
                # Use first senior's coords as cluster center
                cluster_coords = cluster_seniors[0].get("coords", get_sg_coords())
                dist = distance(vol_coords, cluster_coords)
                
                if dist < min_dist:
                    min_dist = dist
                    nearest_cluster = cluster_id
        
        assignments.append({
            "volunteer": vol.get("vid"),
            "cluster": nearest_cluster,
            "distance": round(min_dist, 4)
        })
    
    return {"assignments": assignments, "clusters": list(clusters.keys())}

@app.post("/schedule")
def create_schedule(data: dict):
    """Generate weekly schedule"""
    assignments = data.get("assignments", [])
    
    schedules = []
    time_slots = ["09:00", "11:00", "14:00", "16:00"]
    
    for i, assignment in enumerate(assignments):
        # Assign 2-3 slots per volunteer per week
        for day in range(1, 4):  # Mon, Tue, Wed
            time = random.choice(time_slots)
            schedules.append({
                "volunteer": assignment.get("volunteer"),
                "cluster": assignment.get("cluster"),
                "datetime": get_iso_time(days=day).replace("T" + get_iso_time().split("T")[1], f"T{time}:00+08:00"),
                "duration": 60
            })
    
    return {"schedules": schedules}

# -------------------------------
# Data Endpoints
# -------------------------------

@app.get("/senior/{uid}")
def get_senior(uid: str):
    """Get senior details"""
    return {
        "uid": uid,
        "name": "Ah Gong",
        "coords": get_sg_coords(),
        "physical": random.randint(1, 5),
        "mental": random.randint(1, 5),
        "community": random.randint(1, 5),
        "last_visit": get_iso_time(days=-random.randint(0, 365))
    }

@app.get("/volunteer/{vid}")
def get_volunteer(vid: str):
    """Get volunteer details"""
    return {
        "vid": vid,
        "name": "Sarah",
        "coords": get_sg_coords(),
        "skill": random.randint(1, 3),
        "available": [get_iso_time(days=i) for i in range(1, 8)]
    }

@app.get("/district/{name}")
def get_district_data(name: str):
    """Get district overview"""
    senior_count = random.randint(50, 200)
    vol_count = random.randint(10, 50)
    
    return {
        "district": name,
        "seniors": senior_count,
        "volunteers": vol_count,
        "high_risk": random.randint(5, 30),
        "coords": get_sg_coords()
    }

# -------------------------------
# Demo Data Generator
# -------------------------------

@app.get("/demo/seniors")
def generate_demo_seniors(count: int = 10):
    """Generate demo senior data"""
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
    """Generate demo volunteer data"""
    volunteers = []
    for i in range(count):
        volunteers.append({
            "vid": f"vol_{i}",
            "coords": get_sg_coords(),
            "skill": random.randint(1, 3),
            "available": True
        })
    return {"volunteers": volunteers}

# -------------------------------
# Health Check
# -------------------------------

@app.get("/")
def health():
    return {"status": "OK", "time": get_iso_time()}


if __name__ == "__main__":
    import uvicorn
    app = FastAPI()
    uvicorn.run("api:main", host="0.0.0.0", port=8000, reload=True)