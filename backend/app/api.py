from routers import assignment, availability, schedule 
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

# Include routers
app.include_router(assignment.router)
app.include_router(availability.router)
app.include_router(schedule.router)


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

if __name__ == "__main__":
    uvicorn.run("api:app", port=8000, reload=True)