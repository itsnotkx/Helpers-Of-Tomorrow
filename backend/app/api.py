from routers import availability 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import time
import asyncio
from threading import Thread

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

# Flag to track if initialization has run
_initialization_done = False

def run_classification_background():
    """Run classification in background after app is fully started"""
    global _initialization_done
    try:
        logger.info("Starting background classification...")
        response = supabase.table("seniors").select("*").execute()
        
        if response.data:
            classify_seniors({"seniors": response.data})
            logger.info(f"Successfully classified {len(response.data)} seniors in background")
        else:
            logger.info("No seniors data found to classify")
        
        _initialization_done = True
            
    except Exception as e:
        logger.error(f"Error during background classification: {str(e)}", exc_info=True)

@app.on_event("startup")
async def startup_event():
    """Schedule classification to run after startup is complete"""
    def delayed_classification():
        import time
        time.sleep(2)  # Wait for app to fully start
        run_classification_background()
    
    # Run in background thread after a delay
    thread = Thread(target=delayed_classification, daemon=True)
    thread.start()
    logger.info("Scheduled background classification to run after startup")

# # Include routers
# app.include_router(assignment.router)
app.include_router(availability.router)
# app.include_router(schedule.router)

@app.get("/")
def health():
    return {
        "status": "OK", 
        "time": get_iso_time(),
        "classification_complete": _initialization_done
    }

@app.get("/seniors")
def get_seniors():
    try:
        response = supabase.table("seniors").select("*").execute()
        logger.info(f"Fetched {len(response.data)} seniors")
        
        # Simply add static addresses to seniors data
        seniors_with_address = []
        for senior in response.data:
            senior_data = senior.copy()
            # Use static_address if available, otherwise fallback
            senior_data["address"] = senior.get("static_address", "Singapore")
            seniors_with_address.append(senior_data)
        
        logger.info(f"Processed {len(seniors_with_address)} seniors with static addresses")
        return {"seniors": seniors_with_address}
        
    except Exception as e:
        logger.error(f"Error in get_seniors: {str(e)}")
        return {"seniors": []}

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