import os
import random
from datetime import datetime, timedelta
from supabase import create_client
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')
url = os.getenv("SUPABASE_URL")
key = os.getenv("SUPABASE_KEY")
supabase = create_client(url, key)

# Volunteer emails from your list
volunteer_emails = [
    "supersuitpig@gmail.com",
    "zinlin.wai.2024@smu.edu.sg",
    "goh.li@mockmail.com",
    "ismail.aisyah@example.org",
    "lim.gurpreet@demo.com",
    "ismail.hui@mailtest.com",
    "ismail.gurpreet@example.net",
    "singh.hui@fakemail.com",
    "raj.ming@samplemail.com",
    "lee.aisyah@testdomain.org"
]

def generate_time_slots():
    """Generate realistic time slots between 8am and 10pm"""
    time_slots = [
        # Morning slots
        ("08:00:00", "10:00:00"),  # Early morning
        ("09:00:00", "11:00:00"),  # Mid-morning
        ("10:00:00", "12:00:00"),  # Late morning
        
        # Afternoon slots
        ("12:00:00", "14:00:00"),  # Lunch time
        ("13:00:00", "15:00:00"),  # Early afternoon
        ("14:00:00", "16:00:00"),  # Mid-afternoon
        ("15:00:00", "17:00:00"),  # Late afternoon
        ("16:00:00", "18:00:00"),  # Early evening
        
        # Evening slots
        ("17:00:00", "19:00:00"),  # Evening
        ("18:00:00", "20:00:00"),  # Late evening
        ("19:00:00", "21:00:00"),  # Night
        ("20:00:00", "22:00:00"),  # Late night (until 10pm)
        
        # Extended morning slots
        ("08:30:00", "10:30:00"),  # Extended morning
        ("11:00:00", "13:00:00"),  # Pre-lunch
        
        # Extended afternoon slots
        ("14:30:00", "16:30:00"),  # Extended afternoon
        ("15:30:00", "17:30:00"),  # Extended late afternoon
        
        # Extended evening slots
        ("17:30:00", "19:30:00"),  # Extended evening
        ("18:30:00", "20:30:00"),  # Extended late evening
    ]
    return time_slots

def generate_dates():
    """Generate dates for the next 14 days"""
    dates = []
    start_date = datetime.now().date()
    for i in range(14):  # Next 2 weeks
        date = start_date + timedelta(days=i)
        dates.append(date.strftime('%Y-%m-%d'))
    return dates

def populate_availabilities():
    """Populate the availabilities table with test data"""
    try:
        # Clear existing data (optional - remove if you want to keep existing data)
        print("Clearing existing availabilities...")
        # supabase.table("availabilities").delete().neq("id", 0).execute()
        
        time_slots = generate_time_slots()
        dates = generate_dates()
        
        total_records = 0
        
        for email in volunteer_emails:
            # Each volunteer gets 4-10 random availability slots (increased for more coverage)
            num_slots = random.randint(4, 10)
            
            # Select random dates and times
            selected_dates = random.sample(dates, min(num_slots, len(dates)))
            
            volunteer_records = []
            
            for date in selected_dates:
                # Each volunteer can have 1-3 time slots per day (increased for better coverage)
                slots_per_day = random.randint(1, 3)
                available_times = time_slots.copy()
                
                for _ in range(min(slots_per_day, len(available_times))):
                    start_time, end_time = available_times.pop(random.randint(0, len(available_times) - 1))
                    
                    record = {
                        "volunteer_email": email,
                        "date": date,
                        "start_t": start_time,
                        "end_t": end_time
                    }
                    volunteer_records.append(record)
            
            # Insert records for this volunteer
            if volunteer_records:
                response = supabase.table("availabilities").insert(volunteer_records).execute()
                inserted_count = len(response.data) if response.data else 0
                total_records += inserted_count
                print(f"✓ Inserted {inserted_count} slots for {email}")
        
        print(f"\n🎉 Successfully populated {total_records} availability records!")
        print(f"📧 For {len(volunteer_emails)} volunteers")
        print(f"📅 Covering {len(dates)} days ({dates[0]} to {dates[-1]})")
        print(f"⏰ Time range: 8:00 AM - 10:00 PM")
        
        # Display sample data
        print("\n📋 Sample records:")
        sample_response = supabase.table("availabilities").select("*").limit(8).execute()
        if sample_response.data:
            for record in sample_response.data:
                start_12h = datetime.strptime(record['start_t'], '%H:%M:%S').strftime('%I:%M %p')
                end_12h = datetime.strptime(record['end_t'], '%H:%M:%S').strftime('%I:%M %p')
                print(f"   {record['volunteer_email'][:20]:<20} | {record['date']} | {start_12h}-{end_12h}")
        
    except Exception as e:
        print(f"❌ Error populating availabilities: {str(e)}")

def verify_data():
    """Verify the populated data"""
    try:
        print("\n🔍 Verifying populated data...")
        
        # Count total records
        response = supabase.table("availabilities").select("*", count="exact").execute()
        total_count = response.count
        print(f"📊 Total availability records: {total_count}")
        
        # Count by volunteer
        for email in volunteer_emails[:5]:  # Show first 5
            email_response = supabase.table("availabilities").select("*", count="exact").eq("volunteer_email", email).execute()
            count = email_response.count
            print(f"   {email[:25]:<25}: {count} slots")
        
        # Show date range coverage
        all_dates_response = supabase.table("availabilities").select("date").execute()
        if all_dates_response.data:
            dates = [record['date'] for record in all_dates_response.data]
            unique_dates = sorted(set(dates))
            print(f"📅 Date coverage: {unique_dates[0]} to {unique_dates[-1]} ({len(unique_dates)} unique dates)")
        
        # Show time range coverage
        all_times_response = supabase.table("availabilities").select("start_t", "end_t").execute()
        if all_times_response.data:
            start_times = [record['start_t'] for record in all_times_response.data]
            end_times = [record['end_t'] for record in all_times_response.data]
            earliest_start = min(start_times)
            latest_end = max(end_times)
            
            earliest_12h = datetime.strptime(earliest_start, '%H:%M:%S').strftime('%I:%M %p')
            latest_12h = datetime.strptime(latest_end, '%H:%M:%S').strftime('%I:%M %p')
            print(f"⏰ Time coverage: {earliest_12h} to {latest_12h}")
        
    except Exception as e:
        print(f"❌ Error verifying data: {str(e)}")

if __name__ == "__main__":
    print("🚀 Starting availability data population...")
    print("⏰ Time slots: 8:00 AM - 10:00 PM (2-hour blocks)")
    print("=" * 60)
    
    populate_availabilities()
    verify_data()
    
    print("\n" + "=" * 60)
    print("✅ Availability population complete!")
    print("\n💡 You can now test the /get_slots/{email} and /schedule endpoints")
    print("🔧 Example: curl http://localhost:8000/get_slots/supersuitpig@gmail.com")