from fastapi import APIRouter # type: ignore

from datetime import datetime, timedelta

from config.settings import logger, supabase
from routers.assignment import get_assignments
from geopy.geocoders import Nominatim
from utils.helpers import get_senior_name, get_volunteer_name
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from collections import defaultdict
import json  # for safer coords parsing
import os


router = APIRouter(tags=["schedule"])


# @router.get("/schedules")
# def get_schedules():
#     try:
#         logger.info("Fetching schedule data")
#         assignments_data = get_assignments()
        
#         if not assignments_data.get("assignments"):
#             logger.warning("No assignments available for scheduling")
#             return {"schedules": [], "clusters": [], "cluster_density": {}, "stats": {}}

#         schedule_result = create_schedule({
#             "assignments": assignments_data["assignments"],
#             "seniors": assignments_data.get("seniors", []),
#             "volunteers": assignments_data.get("volunteers", [])
#         })

#         logger.info(f"Generated {len(schedule_result.get('schedules', []))} schedules")
#         return {
#             "schedules": schedule_result.get("schedules", []),
#             "clusters": assignments_data.get("clusters", []),
#             "cluster_density": assignments_data.get("cluster_density", {}),
#             "stats": schedule_result.get("stats", {})
#         }

#     except Exception as e:
#         logger.error(f"Error in get_schedules: {str(e)}", exc_info=True)
#         return {"schedules": [], "clusters": [], "cluster_density": {}, "stats": {}}

# @router.get("/schedules/{user_email}")
# def get_user_schedules(user_email: str):
#     geolocator = Nominatim(user_agent="geoapi")
#     try:
#         schedules_resp = supabase.table("assignments").select("*, seniors:sid(name, coords)").eq("volunteer_email", user_email).execute()

#         # logger.info(schedules_resp)

#         if not schedules_resp.data:
#             logger.warning(f"No schedules found for user: {user_email}")
#             return {"schedules": []}
       
#         schedules = []
#         for schedule in schedules_resp.data:
#             seniors = schedule.get("seniors", {})
#             coords = seniors.get("coords")

#             if coords:
#                 try:
#                     lat, lng = coords["lat"], coords["lng"]
#                     location = geolocator.reverse((lat, lng), language="en")
#                     # Replace coords with readable string
#                     seniors["coords"] = location.address  
#                 except Exception as e:
#                     seniors["coords"] = None  # fallback

#             schedules.append({
#                 "aid": schedule["aid"],
#                 # "vid": schedule["vid"],
#                 # "sid": schedule["sid"],
#                 "date": schedule["date"],
#                 "start_time": schedule["start_time"],
#                 "end_time": schedule["end_time"],
#                 "is_acknowledged": schedule["is_acknowledged"],
#                 # "volunteer_email": schedule["volunteer_email"],
#                 "senior_name": seniors["name"],
#                 "address": seniors.get("coords"),
#             })

#         return {"data": schedules}

#     except Exception as e:
#         logger.error(f"Error in get_user_schedules: {str(e)}", exc_info=True)
#         return {"schedules": []}

def send_schedule_notifications(schedules, volunteers, seniors):
    """
    Sends formatted weekly schedules to volunteers via email.
    """
    # Group schedules by volunteer
    schedules_by_volunteer = defaultdict(list)
    for s in schedules:
        schedules_by_volunteer[s['volunteer']].append(s)

    for vol_id, vol_schedules in schedules_by_volunteer.items():
        volunteer = next((v for v in volunteers if v['vid'] == vol_id), None)
        if not volunteer:
            continue

        email = volunteer['email']
        name = volunteer.get('name', f"Volunteer {vol_id}")

        # Build email body
        message_body = [f"Hello {name},\n\nHere is your schedule for the week:\n"]
        for s in sorted(vol_schedules, key=lambda x: (x['date'], x['start_time'])):
            senior = next((sen for sen in seniors if sen['uid'] == s['senior']), {})
            senior_name = senior.get('name', f"Senior {s['senior']}")
            message_body.append(
                f"- {s['date']} {s['start_time']}–{s['end_time']}: Visit {senior_name} (Cluster {s['cluster']})"
            )

        message_body.append("\nThank you for volunteering!\nHelpers of Tomorrow Team")
        body = "\n".join(message_body)

        # Construct email
        msg = MIMEMultipart()
        msg['From'] = "noreply@helpersoftomorrow.org"
        msg['To'] = email
        msg['Subject'] = "Your Weekly Volunteer Schedule"
        msg.attach(MIMEText(body, "plain"))

        # Send email (example with Gmail SMTP, replace with your mail server)
        try:
            with smtplib.SMTP("smtp.gmail.com", 587) as server:
                server.starttls()
                server.login(os.getenv("APP_EMAIL"), os.getenv("APP_PASSWORD"))
                server.sendmail(msg['From'], email, msg.as_string())
            logger.info(f"✅ Schedule email sent to {email}")
        except Exception as e:
            logger.warning(f"❌ Failed to send email to {email}: {e}")

# @router.post("/schedule")
# def create_schedule(data: dict):
#     assignments = data.get("assignments", [])
#     seniors = data.get("seniors", [])
#     volunteers = data.get("volunteers", [])

#     logger.info(f"Creating schedule for {len(assignments)} assignments, {len(seniors)} seniors, {len(volunteers)} volunteers")

#     if not assignments or not seniors or not volunteers:
#         logger.warning("Missing required data for scheduling")
#         return {"schedules": []}

#     # Create email to volunteer ID mapping
#     vol_email_to_id = {vol['email']: vol['vid'] for vol in volunteers}
#     volunteer_map = {vol['vid']: vol for vol in volunteers}

#     # Get all volunteer availabilities for the next week
#     try:
#         # Get availabilities for all volunteers
#         availabilities_resp = supabase.table("availabilities").select("*").execute()
#         availabilities = availabilities_resp.data if availabilities_resp.data else []
#         logger.info(f"Found {len(availabilities)} availability slots")
        
#         # Log raw availability data for debugging
#         if availabilities:
#             logger.info(f"Sample raw availability: {availabilities[0]}")
        
#         # Group availabilities by volunteer
#         volunteer_availabilities = {}
#         for avail in availabilities:
#             try:
#                 vol_email = avail['volunteer_email']
#                 if vol_email in vol_email_to_id:
#                     vid = vol_email_to_id[vol_email]
#                     if vid not in volunteer_availabilities:
#                         volunteer_availabilities[vid] = []
                    
#                     # Log raw data before processing
#                     logger.info(f"Processing availability - Date: {avail['date']}, Start: {avail['start_t']}, End: {avail['end_t']}")
                    
#                     # Ensure date and time are properly formatted
#                     date_str = avail['date']
#                     start_time = avail['start_t']
#                     end_time = avail['end_t']
                    
#                     # Format date consistently
#                     if isinstance(date_str, datetime):
#                         formatted_date = date_str.strftime('%Y-%m-%d')
#                     else:
#                         formatted_date = datetime.strptime(date_str, '%Y-%m-%d').strftime('%Y-%m-%d')
                    
#                     # Format times consistently
#                     formatted_start = datetime.strptime(start_time, '%H:%M:%S').strftime('%H:%M')
#                     formatted_end = datetime.strptime(end_time, '%H:%M:%S').strftime('%H:%M')
                    
#                     volunteer_availabilities[vid].append({
#                         'date': formatted_date,
#                         'start': formatted_start,
#                         'end': formatted_end
#                     })
#                     logger.info(f"Processed availability for volunteer {vid}: {formatted_date} {formatted_start}-{formatted_end}")
#             except Exception as e:
#                 logger.error(f"Error processing availability: {str(e)}, Data: {avail}")
#                 continue

#     except Exception as e:
#         logger.error(f"Error fetching availabilities: {str(e)}")
#         return {"schedules": []}

#     # Sort seniors by priority (wellbeing) and risk
#     seniors_with_priority = []
#     for senior in seniors:
#         priority_score = 0
#         if senior.get('overall_wellbeing') == 1:  # Low wellbeing
#             priority_score += 3
#         elif senior.get('overall_wellbeing') == 2:  # Medium wellbeing
#             priority_score += 2
#         risk_score = senior.get('risk', 0)
#         seniors_with_priority.append({
#             **senior,
#             'priority_score': priority_score + risk_score
#         })

#     seniors_sorted = sorted(seniors_with_priority, 
#                           key=lambda s: s['priority_score'], 
#                           reverse=True)

#     # Create schedule - maximum one visit per senior
#     schedules = []
#     used_slots = {}  # Track used time slots
#     scheduled_seniors = set()  # Track which seniors have been scheduled

#     for assignment in assignments:
#         vol_id = assignment['volunteer']
#         cluster_id = assignment['cluster']
        
#         vol_slots = volunteer_availabilities.get(vol_id, [])
#         if not vol_slots:
#             continue

#         # Get unscheduled seniors in this cluster, sorted by priority
#         cluster_seniors = [
#             s for s in seniors_sorted 
#             if s.get('cluster') == cluster_id and s['uid'] not in scheduled_seniors
#         ]
        
#         logger.info(f"Processing cluster {cluster_id}: {len(cluster_seniors)} unscheduled seniors for volunteer {vol_id}")
        
#         # Schedule one visit per senior until no more slots available
#         for senior in cluster_seniors:
#             # Find first available slot
#             for slot in vol_slots:
#                 slot_key = f"{vol_id}_{slot['date']}_{slot['start']}"
#                 if slot_key in used_slots:
#                     continue

#                 schedule_entry = {
#                     "volunteer": vol_id,
#                     "senior": senior['uid'],
#                     "cluster": cluster_id,
#                     "date": slot['date'],
#                     "start_time": slot['start'],
#                     "end_time": slot['end'],
#                     "priority_score": senior['priority_score']
#                 }
                
#                 schedules.append(schedule_entry)
                
#                 # Enhanced logging with names
#                 volunteer_name = get_volunteer_name(vol_id, volunteers)
#                 senior_name = get_senior_name(senior['uid'], seniors)
#                 logger.info(f"Sample schedule entry: {json.dumps(schedule_entry, indent=2)} - Volunteer: {volunteer_name}, Senior: {senior_name}")
                
#                 used_slots[slot_key] = True
#                 scheduled_seniors.add(senior['uid'])
#                 break  # Move to next senior after scheduling one visit

#     stats = {
#         "total_scheduled": len(schedules),
#         "unique_seniors": len(set(s['senior'] for s in schedules)),
#         "unique_volunteers": len(set(s['volunteer'] for s in schedules))
#     }
    
#     logger.info(f"Schedule generation complete. Stats: {stats}")
#     if schedules:
#         # Enhanced sample logging with names
#         sample_entry = schedules[0]
#         volunteer_name = get_volunteer_name(sample_entry['volunteer'], volunteers)
#         senior_name = get_senior_name(sample_entry['senior'], seniors)
#         logger.info(f"Sample schedule entry: {json.dumps(sample_entry, indent=2)} - Volunteer: {volunteer_name}, Senior: {senior_name}")
        
#         if len(schedules) > 1:
#             sample_entry2 = schedules[1]
#             volunteer_name2 = get_volunteer_name(sample_entry2['volunteer'], volunteers)
#             senior_name2 = get_senior_name(sample_entry2['senior'], seniors)
#             logger.info(f"Sample schedule entry: {json.dumps(sample_entry2, indent=2)} - Volunteer: {volunteer_name2}, Senior: {senior_name2}")
            
#         send_schedule_notifications(schedules, volunteers, seniors)
#     else:
#         logger.warning("No schedules created")
#     return {
#         "schedules": schedules,
#         "stats": stats
#     }