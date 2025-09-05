from fastapi import APIRouter # type: ignore
from config.settings import logger, supabase
from datetime import datetime

router = APIRouter(tags=["availability"])



@router.get("/get_slots/{email}")
def get_slots(email: str):
    """Fetch volunteer availability slots"""
    try:
        if not email:
            return {"error": "email is required"}

        response = supabase.table("availabilities").select("*").eq("volunteer_email", email).execute()
        if not response.data:
            logger.info(f"No availability slots found for volunteer {email}")
            return {"email": email, "slots": []}

        slots = []
        for record in response.data:
            date_str = record.get("date")
            start_time_str = record.get("start_t")
            end_time_str = record.get("end_t")

            if not date_str or not start_time_str or not end_time_str:
                logger.warning(f"Incomplete slot data in record: {record}")
                continue

            try:
                start_dt = datetime.fromisoformat(f"{date_str}T{start_time_str}+08:00")
                end_dt = datetime.fromisoformat(f"{date_str}T{end_time_str}+08:00")
                slots.append({
                    "date": date_str,
                    "start_time": start_dt.isoformat(),
                    "end_time": end_dt.isoformat()
                })
            except ValueError as ve:
                logger.error(f"Error parsing datetime for record {record}: {ve}")
                continue

        logger.info(f"Retrieved {len(slots)} slots for volunteer {email}")
        return {"email": email, "slots": slots}

    except Exception as e:
        logger.error(f"Error in get_slots: {str(e)}", exc_info=True)
        return {"error": "Internal server error"}
    

@router.post("/upload_slots")
def upload_slots(data: dict):
    """Upload volunteer availability slots"""
    try:
        email = data.get("email")
        slots = data.get("slots", [])
        
        if not email:
            return {"error": "email is required"}

        if not slots:
            return {"error": "slots list is required"}
        
        # Validate slot format
        processed_slots = []
        dates_to_clear = set()  # Track unique dates for deletion
        
        for i, slot in enumerate(slots):
            if not isinstance(slot, dict):
                return {"error": f"Slot {i} must be an object"}
            
            start_time = slot.get("start_time")
            end_time = slot.get("end_time")
            
            if not start_time or not end_time:
                return {"error": f"Slot {i} must have both start_time and end_time"}
            
            # Validate datetime format (ISO format expected)
            try:
                # Parse to validate format
                start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
                
                if end_dt <= start_dt:
                    return {"error": f"Slot {i}: end_time must be after start_time"}
                
                date_str = start_dt.date().isoformat()
                dates_to_clear.add(date_str)  # Add date to deletion set
                
                processed_slots.append({
                    "start_time": start_time,
                    "end_time": end_time,
                    "date": date_str,  # Extract date for database
                    "start_time_only": start_dt.time().isoformat(),  # Extract time portion only
                    "end_time_only": end_dt.time().isoformat(),  # Extract time portion only
                    "duration_minutes": int((end_dt - start_dt).total_seconds() / 60)
                })
                
            except ValueError as e:
                return {"error": f"Slot {i}: Invalid datetime format - {str(e)}"}
        
        # Delete existing slots for the same email and dates
        try:
            deleted_count = 0
            for date_str in dates_to_clear:
                delete_response = supabase.table("availabilities").delete().eq("volunteer_email", email).eq("date", date_str).execute()
                if delete_response.data:
                    deleted_count += len(delete_response.data)
            
            logger.info(f"Deleted {deleted_count} existing slots for volunteer {email} on dates: {list(dates_to_clear)}")
            
        except Exception as delete_error:
            logger.error(f"Error deleting existing slots: {str(delete_error)}")
            return {"error": f"Failed to delete existing slots: {str(delete_error)}"}
        
        # Insert each slot as a separate row in availabilities table
        try:
            inserted_rows = []
            
            for slot in processed_slots:
                # Insert individual availability record matching your table schema
                response = supabase.table("availabilities").insert({
                    "volunteer_email": email,  # Changed from volunteer_id to email to match your table
                    "date": slot["date"],
                    "start_t": slot["start_time_only"],  # Now just the time portion (e.g., "11:00:00")
                    "end_t": slot["end_time_only"]  # Now just the time portion (e.g., "13:00:00")
                }).execute()
                
                if response.data:
                    inserted_rows.extend(response.data)
                else:
                    logger.warning(f"Failed to insert slot: {slot}")
            
            logger.info(f"Inserted {len(inserted_rows)} availability slots for volunteer {email}")
            
            return {
                "success": True,
                "email": email,
                "deleted_slots": deleted_count,
                "slots_uploaded": len(inserted_rows),
                "slots": processed_slots,
                "inserted_records": len(inserted_rows)
            }
            
        except Exception as db_error:
            logger.error(f"Database error: {str(db_error)}")
            return {"error": f"Failed to insert availability slots: {str(db_error)}"}
        
    except Exception as e:
        logger.error(f"Error in upload_slots: {str(e)}")
        return {"error": "Internal server error"}