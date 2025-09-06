from fastapi import APIRouter # type: ignore

from datetime import datetime, timedelta

from config.settings import logger, supabase
# from geopy.geocoders import Nominatim
from utils.helpers import get_senior_name, get_volunteer_name
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from collections import defaultdict
import json  # for safer coords parsing
import os


router = APIRouter(tags=["schedule"])

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