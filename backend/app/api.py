from routers import availability 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import time

from config.settings import CORS_ORIGINS
from utils.helpers import get_iso_time
from services.assessments import classify_seniors
from config.settings import supabase, logger
from utils.geocoding import geocoder

app = FastAPI(title="AIC Senior Care MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# # Include routers
# app.include_router(assignment.router)
app.include_router(availability.router)
# app.include_router(schedule.router)

@app.get("/")
def health():
    return {"status": "OK", "time": get_iso_time()}

@app.get("/seniors")
def get_seniors():
    try:
        response = supabase.table("seniors").select("*").execute()
        logger.info(f"Fetched {len(response.data)} seniors")
        
        # Identify high-risk seniors first
        high_risk_seniors = []
        other_seniors = []
        
        for senior in response.data:
            if senior.get("overall_wellbeing") == 1:
                high_risk_seniors.append(senior)
            else:
                other_seniors.append(senior)
        
        logger.info(f"Found {len(high_risk_seniors)} high-risk seniors")
        
        seniors_with_address = []
        geocoded_count = 0
        max_geocode = 15  # Limit to prevent slowdowns
        
        # Process high-risk seniors first
        for senior in high_risk_seniors:
            senior_data = senior.copy()
            coords = senior.get("coords")
            
            if coords and geocoded_count < max_geocode:
                try:
                    lat, lng = coords["lat"], coords["lng"]
                    address = geocoder.get_singapore_address(lat, lng)
                    senior_data["address"] = address
                    geocoded_count += 1
                    
                    if address and "Singapore" in address:
                        logger.info(f"Geocoded high-risk senior {senior.get('uid', 'unknown')[:8]}: {address[:50]}")
                    
                except Exception as e:
                    logger.warning(f"Failed to geocode high-risk senior: {str(e)[:50]}")
                    senior_data["address"] = geocoder._get_fallback_area(coords["lat"], coords["lng"])
            else:
                # Use fallback for seniors not geocoded
                if coords:
                    senior_data["address"] = geocoder._get_fallback_area(coords["lat"], coords["lng"])
                else:
                    senior_data["address"] = "Singapore"
                    
            seniors_with_address.append(senior_data)
        
        # Process other seniors
        for senior in other_seniors:
            senior_data = senior.copy()
            coords = senior.get("coords")
            
            if coords and geocoded_count < max_geocode:
                try:
                    lat, lng = coords["lat"], coords["lng"]
                    address = geocoder.get_singapore_address(lat, lng)
                    senior_data["address"] = address
                    geocoded_count += 1
                    
                except Exception as e:
                    logger.warning(f"Failed to geocode senior: {str(e)[:50]}")
                    senior_data["address"] = geocoder._get_fallback_area(coords["lat"], coords["lng"])
            else:
                # Use fallback for remaining seniors
                if coords:
                    senior_data["address"] = geocoder._get_fallback_area(coords["lat"], coords["lng"])
                else:
                    senior_data["address"] = "Singapore"
                    
            seniors_with_address.append(senior_data)
        
        logger.info(f"Processed {len(seniors_with_address)} seniors, geocoded {geocoded_count}")
        return {"seniors": seniors_with_address}
        
    except Exception as e:
        logger.error(f"Error in get_seniors: {str(e)}")
        # Fallback: return seniors with area-based addresses
        response = supabase.table("seniors").select("*").execute()
        seniors_fallback = []
        for senior in response.data:
            senior_data = senior.copy()
            coords = senior.get("coords")
            if coords:
                senior_data["address"] = geocoder._get_fallback_area(coords["lat"], coords["lng"])
            else:
                senior_data["address"] = "Singapore"
            seniors_fallback.append(senior_data)
        return {"seniors": seniors_fallback}

# Add a separate endpoint for batch geocoding (run manually/scheduled)
@app.post("/seniors/geocode")
def batch_geocode_seniors():
    """
    Batch geocode all seniors and store addresses in database.
    This should be run separately, not during normal API calls.
    """
    try:
        response = supabase.table("seniors").select("*").execute()
        
        geocoded_count = 0
        for senior in response.data:
            coords = senior.get("coords")
            if coords and not senior.get("address"):  # Only geocode if no address exists
                try:
                    time.sleep(1)  # Respectful delay
                    lat, lng = coords["lat"], coords["lng"]
                    address = geocoder.get_singapore_address(lat, lng)
                    
                    if address:
                        # Update the database with the address
                        supabase.table("seniors").update({
                            "address": address
                        }).eq("uid", senior["uid"]).execute()
                        geocoded_count += 1
                        logger.info(f"Geocoded senior {senior['uid'][:8]}")
                        
                except Exception as e:
                    logger.warning(f"Failed to geocode {senior['uid'][:8]}: {str(e)[:50]}")
                    continue
        
        return {"message": f"Geocoded {geocoded_count} seniors"}
    except Exception as e:
        logger.error(f"Batch geocoding error: {str(e)}")
        return {"error": "Batch geocoding failed"}

@app.get("/volunteers")
def get_volunteers():  # This was correct but adding logging
    response = supabase.table("volunteers").select("*").execute()
    logger.info(f"Fetched {len(response.data)} volunteers")
    return {"volunteers": response.data}

@app.get("/dl/{user_email}")
def get_user_schedules(user_email: str):
    response = supabase.table("volunteers").select("*, constituency(centre_lat, centre_long)").eq("email", user_email).execute()
    logger.info(f"Fetched DL information for user {user_email}")
    return {"dl_info": response.data}

@app.get("/assignments")
def get_assignments():
    response = supabase.table("assignments").select("*").execute()
    logger.info(f"Fetched {len(response.data)} assignments")
    logger.info(f"Assignments data: {response.data}")
    logger.info(f"Assignments columns: {list(response.data[0].keys()) if response.data else 'No data'}")
    return {"assignments": response.data}

@app.get("/clusters")
def get_clusters():
    response = supabase.table("clusters").select("*").execute()
    logger.info(f"Fetched {len(response.data)} clusters")
    logger.info(f"Clusters data sample: {response.data[:2] if response.data else 'No data'}")
    return {"clusters": response.data}

# Add a debug endpoint to check all table structures
@app.get("/debug/tables")
def debug_tables():
    tables_info = {}
    
    for table_name in ["seniors", "volunteers", "assignments", "clusters"]:
        try:
            response = supabase.table(table_name).select("*").limit(1).execute()
            tables_info[table_name] = {
                "count": len(response.data),
                "columns": list(response.data[0].keys()) if response.data else [],
                "sample": response.data[0] if response.data else None
            }
        except Exception as e:
            tables_info[table_name] = {"error": str(e)}
    
    return tables_info

if __name__ == "__main__":
    uvicorn.run("api:app", port=8000, reload=True)