from config.settings import supabase, logger

# Singapore neighbourhood coordinates
SINGAPORE_NEIGHBOURHOODS = {
    "Yishun": [103.8454, 1.4382],
    "Tampines": [103.9568, 1.3496],
    "Jurong": [103.722, 1.3315],
    "Bedok": [103.9273, 1.3236],
    "Hougang": [103.8924, 1.3612],
    "Sembawang": [103.8184, 1.4491],
    "Woodlands": [103.7890, 1.4382],
    "Ang Mo Kio": [103.8454, 1.3691],
    "Bishan": [103.8454, 1.3506],
    "Punggol": [103.9021, 1.4043],
    "Toa Payoh": [103.8476, 1.3343],
    "Clementi": [103.7649, 1.3162],
    "Pasir Ris": [103.9492, 1.3721],
    "Serangoon": [103.8698, 1.3554],
    "Bukit Batok": [103.7437, 1.3587],
    "Choa Chu Kang": [103.7444, 1.3840],
    "Bukit Panjang": [103.7718, 1.3774],
    "Queenstown": [103.8057, 1.2966],
    "Kallang": [103.8614, 1.3111],
    "Marine Parade": [103.9057, 1.3017]
}

def populate_constituencies():
    """Populate the constituency table with neighbourhood coordinates"""
    try:
        logger.info("Starting to populate constituency table...")
        
        # First, let's check if the table exists and what records are already there
        existing_response = supabase.table("constituency").select("name").execute()
        existing_names = {record["name"] for record in existing_response.data} if existing_response.data else set()
        
        logger.info(f"Found {len(existing_names)} existing constituencies: {existing_names}")
        
        inserted_count = 0
        updated_count = 0
        errors = []
        
        for name, coordinates in SINGAPORE_NEIGHBOURHOODS.items():
            longitude, latitude = coordinates
            
            try:
                # Check if constituency already exists
                if name in existing_names:
                    # Update existing record
                    response = supabase.table("constituency").update({
                        "centre_lat": latitude,
                        "centre_long": longitude
                    }).eq("name", name).execute()
                    
                    if response.data:
                        updated_count += 1
                        logger.info(f"Updated {name}: lat={latitude}, long={longitude}")
                    else:
                        errors.append(f"Failed to update {name}")
                        logger.error(f"Failed to update {name}")
                else:
                    # Insert new record
                    response = supabase.table("constituency").insert({
                        "name": name,
                        "centre_lat": latitude,
                        "centre_long": longitude
                    }).execute()
                    
                    if response.data:
                        inserted_count += 1
                        logger.info(f"Inserted {name}: lat={latitude}, long={longitude}")
                    else:
                        errors.append(f"Failed to insert {name}")
                        logger.error(f"Failed to insert {name}")
                        
            except Exception as e:
                error_msg = f"Error processing {name}: {str(e)}"
                errors.append(error_msg)
                logger.error(error_msg)
        
        # Summary
        logger.info(f"Population complete!")
        logger.info(f"Inserted: {inserted_count} constituencies")
        logger.info(f"Updated: {updated_count} constituencies")
        
        if errors:
            logger.error(f"Errors encountered: {len(errors)}")
            for error in errors:
                logger.error(f"  - {error}")
        
        return {
            "success": True,
            "inserted": inserted_count,
            "updated": updated_count,
            "errors": errors,
            "total_processed": inserted_count + updated_count
        }
        
    except Exception as e:
        logger.error(f"Fatal error in populate_constituencies: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }

def verify_constituencies():
    """Verify the populated data"""
    try:
        response = supabase.table("constituency").select("*").execute()
        
        if response.data:
            logger.info(f"Verification: Found {len(response.data)} constituencies in database")
            for record in response.data:
                logger.info(f"  {record['name']}: lat={record.get('centre_lat')}, long={record.get('centre_long')}")
        else:
            logger.warning("Verification: No constituencies found in database")
            
        return response.data
        
    except Exception as e:
        logger.error(f"Error in verify_constituencies: {str(e)}")
        return None

if __name__ == "__main__":
    print("Populating constituency table with coordinates...")
    result = populate_constituencies()
    
    if result["success"]:
        print(f"✅ Success! Processed {result['total_processed']} constituencies")
        print(f"   - Inserted: {result['inserted']}")
        print(f"   - Updated: {result['updated']}")
        
        if result["errors"]:
            print(f"⚠️  {len(result['errors'])} errors occurred:")
            for error in result["errors"]:
                print(f"   - {error}")
    else:
        print(f"❌ Failed: {result['error']}")
    
    print("\nVerifying data...")
    verify_constituencies()
    print("Done!")