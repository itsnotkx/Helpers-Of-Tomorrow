from routers import availability, schedule
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import time
import asyncio
from threading import Thread

from config.settings import CORS_ORIGINS, supabase, logger

from utils.helpers import get_iso_time
from services.assessments import classify_seniors
app = FastAPI(title="AIC Senior Care MVP")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

app.include_router(availability.router)
app.include_router(schedule.router)

@app.get("/")
def health():
    return {
        "status": "OK", 
        "time": get_iso_time(),
        "classification_complete": _initialization_done
    }

@app.get("/test-wellbeing")
def test_wellbeing():
    """Test endpoint to verify wellbeing route is accessible"""
    return {"message": "Wellbeing endpoint is accessible", "status": "OK"}

@app.get("/seniors")
def get_seniors(): 
    response = supabase.table("seniors").select("*").execute()
    logger.info(f"Fetched {len(response.data)} seniors")
    return {"seniors": response.data}
        

@app.get("/volunteers")
def get_volunteers():  
    response = supabase.table("volunteers").select("*").execute()
    logger.info(f"Fetched {len(response.data)} volunteers")
    return {"volunteers": response.data}

@app.get("/dl/{user_email}")
def get_user_schedules(user_email: str):
    response = supabase.table("volunteers").select("*").eq("email", user_email).execute()
    logger.info(f"Fetched DL information for user {user_email}")
    logger.info(f"\nDL RETURN OBJECT: {response.data}, USER EMAIL: {user_email}\n")
    return {"dl_info": response.data}

@app.get("/assignments")
def get_assignments():
    response = supabase.table("assignments").select("*").execute()
    logger.info(f"Fetched {len(response.data)} assignments")
    return {"assignments": response.data}

@app.get("/assignmentarchive")
def get_assignment_archive():
    response = supabase.table("assignments_archive").select("*").execute()
    logger.info(f"Fetched {len(response.data)} archived assignments")
    return {"assignment_archive": response.data}

@app.get("/clusters")
def get_clusters():
    response = supabase.table("clusters").select("*").execute()
    logger.info(f"Fetched {len(response.data)} clusters")
    logger.info(f"Clusters data sample: {response.data[:2] if response.data else 'No data'}")
    return {"clusters": response.data}

@app.put("/wellbeing")
def update_wellbeing(data: dict):
    try:
        sid = data.get("sid")
        overall_wellbeing = data.get("overall_wellbeing")
        
        response = supabase.table("seniors").update({
            "overall_wellbeing": overall_wellbeing
        }).eq("uid", sid).execute()
        
        logger.info(f"Supabase response: {response}")
        
        success = response.data is not None and len(response.data) > 0
        
        if success:
            logger.info(f"Successfully updated wellbeing for senior {sid}")
            return {"success": True, "message": "Wellbeing updated successfully"}
        else:
            logger.error(f"Failed to update wellbeing - no rows affected for senior {sid}")
            return {"success": False, "error": "Senior not found or update failed"}
            
    except Exception as e:
        logger.error(f"Error updating wellbeing: {str(e)}", exc_info=True)
        return {"success": False, "error": f"Internal server error: {str(e)}"}

@app.put("/acknowledgements")
def update_acknowledgements(acknowledgements: dict):
    """
    Update is_acknowledged field for assignments based on assignment IDs
    Expected format: {"aid1": "aid1", "aid2": "aid2", ...}
    """
    try:
        updated_count = 0
        errors = []
        
        for aid in acknowledgements.keys():
            try:
                # Update the assignment to set is_acknowledged to True
                response = supabase.table("assignments").update({
                    "is_acknowledged": True
                }).eq("aid", aid).execute()
                
                if response.data:
                    updated_count += 1
                    logger.info(f"Updated acknowledgement for assignment {aid}")
                else:
                    errors.append(f"Assignment {aid} not found")
                    
            except Exception as e:
                error_msg = f"Failed to update assignment {aid}: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)
        
        if updated_count > 0:
            return {
                "success": True,
                "message": f"Successfully updated {updated_count} assignments",
                "updated_count": updated_count,
                "errors": errors if errors else None
            }
        else:
            return {
                "success": False,
                "error": "No assignments were updated",
                "errors": errors
            }
            
    except Exception as e:
        logger.error(f"Error updating acknowledgements: {str(e)}")
        return {
            "success": False,
            "error": f"Failed to update acknowledgements: {str(e)}"
        }

@app.put("/confirm-visit")
def confirm_visit(data: dict):
    try:
        aid = data.get("aid")
        if not aid:
            return {"success": False, "error": "Assignment ID is required"}
        
        # First, get the archived assignment to find the senior and date
        archive_response = supabase.table("assignments_archive").select("*").eq("aid", aid).execute()
        
        if not archive_response.data or len(archive_response.data) == 0:
            return {"success": False, "error": "Archived assignment not found"}
        
        assignment = archive_response.data[0]
        sid = assignment.get("sid")
        visit_date = assignment.get("date")
        
        if not sid or not visit_date:
            return {"success": False, "error": "Invalid assignment data"}
        
        # Update has_visited in assignments_archive
        archive_update = supabase.table("assignments_archive").update({
            "has_visited": True
        }).eq("aid", aid).execute()
        
        if not archive_update.data:
            return {"success": False, "error": "Failed to update assignment archive"}
        
        # Update last_visit in seniors table
        senior_update = supabase.table("seniors").update({
            "last_visit": visit_date
        }).eq("uid", sid).execute()
        
        if not senior_update.data:
            logger.warning(f"Failed to update last_visit for senior {sid}, but assignment was marked as visited")
        
        logger.info(f"Successfully confirmed visit for assignment {aid}, senior {sid}")
        return {
            "success": True,
            "message": "Visit confirmed successfully",
            "assignment_id": aid,
            "senior_id": sid,
            "visit_date": visit_date
        }
        
    except Exception as e:
        logger.error(f"Error confirming visit: {str(e)}", exc_info=True)
        return {"success": False, "error": f"Internal server error: {str(e)}"}

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