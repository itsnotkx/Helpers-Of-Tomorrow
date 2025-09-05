# from routers import assignment, availability, schedule 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from config.settings import CORS_ORIGINS
from utils.helpers import get_iso_time
from services.assessments import classify_seniors
from config.settings import supabase, logger

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
# app.include_router(availability.router)
# app.include_router(schedule.router)


@app.get("/")
def health():
    return {"status": "OK", "time": get_iso_time()}

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