import math
from typing import Optional

# Singapore neighborhood mappings (approximate centers)
SINGAPORE_AREAS = {
    "Sembawang": (1.4491, 103.8184),
    "Yishun": (1.4304, 103.8350),
    "Woodlands": (1.4382, 103.7890),
    "Ang Mo Kio": (1.3691, 103.8454),
    "Bishan": (1.3506, 103.8454),
    "Hougang": (1.3612, 103.8924),
    "Punggol": (1.4043, 103.9021),
    "Serangoon": (1.3554, 103.8698),
    "Tampines": (1.3496, 103.9568),
    "Pasir Ris": (1.3721, 103.9492),
    "Bedok": (1.3236, 103.9273),
    "Marine Parade": (1.3017, 103.9057),
    "Kallang": (1.3111, 103.8614),
    "Toa Payoh": (1.3343, 103.8476),
    "Bukit Batok": (1.3587, 103.7437),
    "Jurong": (1.3404, 103.7436),
    "Clementi": (1.3162, 103.7649),
    "Queenstown": (1.2966, 103.8057),
}

def get_nearest_area(lat: float, lng: float) -> Optional[str]:
    """Find the nearest Singapore area to given coordinates"""
    min_distance = float('inf')
    nearest_area = None
    
    for area_name, (area_lat, area_lng) in SINGAPORE_AREAS.items():
        # Simple distance calculation
        distance = math.sqrt((lat - area_lat)**2 + (lng - area_lng)**2)
        if distance < min_distance:
            min_distance = distance
            nearest_area = area_name
    
    if min_distance < 0.05:  # Within reasonable distance
        return f"{nearest_area} Area, Singapore"
    
    return "Singapore"
