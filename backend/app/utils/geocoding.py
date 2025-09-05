import requests
import time
from typing import Optional
from config.settings import logger

class GeocodingService:
    def __init__(self):
        self.cache = {}  # Simple in-memory cache
    
    def get_singapore_address(self, lat: float, lng: float) -> Optional[str]:
        """
        Get address for Singapore coordinates with multiple fallbacks
        """
        cache_key = f"{lat:.4f},{lng:.4f}"
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        # Try multiple services
        address = self._try_onemap(lat, lng) or self._try_nominatim(lat, lng) or self._get_fallback_area(lat, lng)
        
        if address:
            self.cache[cache_key] = address
        
        return address
    
    def _try_onemap(self, lat: float, lng: float) -> Optional[str]:
        """Use Singapore's OneMap API (faster for Singapore addresses)"""
        try:
            # OneMap reverse geocoding endpoint (no token required for basic usage)
            url = "https://developers.onemap.sg/commonapi/search"
            params = {
                "searchVal": f"{lat},{lng}",
                "returnGeom": "Y",
                "getAddrDetails": "Y"
            }
            
            response = requests.get(url, params=params, timeout=3)
            if response.status_code == 200:
                data = response.json()
                if data.get("found", 0) > 0 and data.get("results"):
                    result = data["results"][0]
                    building = result.get("BUILDING")
                    road = result.get("ROAD")
                    if building and road:
                        return f"{building}, {road}, Singapore"
                    elif road:
                        return f"{road}, Singapore"
                    elif building:
                        return f"{building}, Singapore"
        except Exception as e:
            logger.warning(f"OneMap failed: {e}")
        
        return None
    
    def _try_nominatim(self, lat: float, lng: float) -> Optional[str]:
        """Fallback to Nominatim with better rate limiting"""
        try:
            time.sleep(0.2)  # Respectful rate limiting
            url = "https://nominatim.openstreetmap.org/reverse"
            params = {
                "lat": lat,
                "lon": lng,
                "format": "json",
                "addressdetails": 1,
                "zoom": 18,
                "accept-language": "en"
            }
            
            response = requests.get(url, params=params, timeout=3, 
                                  headers={"User-Agent": "SeniorCare/1.0"})
            
            if response.status_code == 200:
                data = response.json()
                address = data.get("display_name")
                if address:
                    # Clean up the address for Singapore
                    if "Singapore" in address:
                        parts = address.split(",")
                        # Take first 2-3 meaningful parts
                        clean_parts = [p.strip() for p in parts[:3] if p.strip()]
                        return ", ".join(clean_parts)
                    return address
        except Exception as e:
            logger.warning(f"Nominatim failed: {e}")
        
        return None
    
    def _get_fallback_area(self, lat: float, lng: float) -> str:
        """Static fallback based on coordinate ranges"""
        singapore_areas = {
            (1.44, 1.46, 103.81, 103.83): "Sembawang",
            (1.42, 1.44, 103.83, 103.85): "Yishun", 
            (1.43, 1.45, 103.78, 103.80): "Woodlands",
            (1.36, 1.38, 103.84, 103.86): "Ang Mo Kio",
            (1.34, 1.36, 103.84, 103.86): "Bishan",
            (1.35, 1.37, 103.89, 103.91): "Hougang",
            (1.39, 1.41, 103.90, 103.92): "Punggol",
            (1.34, 1.36, 103.86, 103.88): "Serangoon",
            (1.34, 1.36, 103.94, 103.96): "Tampines",
            (1.36, 1.38, 103.94, 103.96): "Pasir Ris",
            (1.32, 1.34, 103.92, 103.94): "Bedok",
            (1.30, 1.32, 103.90, 103.92): "Marine Parade",
            (1.30, 1.32, 103.85, 103.87): "Kallang",
            (1.33, 1.35, 103.84, 103.86): "Toa Payoh",
            (1.35, 1.37, 103.73, 103.75): "Bukit Batok",
            (1.33, 1.35, 103.73, 103.75): "Jurong",
            (1.31, 1.33, 103.76, 103.78): "Clementi",
            (1.29, 1.31, 103.80, 103.82): "Queenstown",
        }
        
        for (min_lat, max_lat, min_lng, max_lng), area in singapore_areas.items():
            if min_lat <= lat <= max_lat and min_lng <= lng <= max_lng:
                return f"{area} Area, Singapore"
        
        return "Singapore"

# Global instance
geocoder = GeocodingService()
