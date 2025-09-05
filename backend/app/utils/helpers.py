import random
import math
from datetime import datetime, timedelta
from sklearn.cluster import KMeans
import numpy as np

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
