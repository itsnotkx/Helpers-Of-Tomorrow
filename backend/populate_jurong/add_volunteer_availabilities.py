import os
import random
from supabase import create_client, Client
from dotenv import load_dotenv

# Load environment variables
load_dotenv('.env.local')

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def random_half_hour_time():
    """Return a random time string in half-hour increments between 09:00:00 and 22:00:00"""
    hour = random.randint(9, 21)
    minute = random.choice([0, 30])
    return f"{hour:02d}:{minute:02d}:00"

def random_availability(volunteer_email, date):
    """Generate a random availability for a volunteer on a specific date"""
    # Generate start and end time
    start_t = random_half_hour_time()
    # Convert start_t to minutes since midnight
    h, m, _ = map(int, start_t.split(":"))
    start_minutes = h * 60 + m
    # End time must be after start time, in half-hour increments, max 22:00
    possible_end_minutes = [x for x in range(start_minutes + 30, 22*60+1, 30) if x <= 22*60]
    if not possible_end_minutes:
        # If start_t is 22:00, set end_t to 22:00
        end_t = "22:00:00"
    else:
        end_minutes = random.choice(possible_end_minutes)
        end_h = end_minutes // 60
        end_m = end_minutes % 60
        end_t = f"{end_h:02d}:{end_m:02d}:00"
    
    return {
        "date": date,
        "volunteer_email": volunteer_email,
        "start_t": start_t,
        "end_t": end_t
    }

def get_existing_volunteers():
    """Fetch all existing volunteer emails from the database"""
    try:
        response = supabase.table("volunteers").select("email").execute()
        if response.data:
            return [volunteer["email"] for volunteer in response.data]
        else:
            print("No volunteers found in database")
            return []
    except Exception as e:
        print(f"Error fetching volunteers: {str(e)}")
        return []

def insert_availabilities_data():
    """Insert availability data for existing volunteers for September 1-7, 2025"""
    try:
        # Get existing volunteers
        volunteer_emails = get_existing_volunteers()
        if not volunteer_emails:
            print("No existing volunteers found. Please run the volunteer population script first.")
            return False
        
        print(f"Found {len(volunteer_emails)} existing volunteers")
        print("Generating availabilities for September 1-7, 2025...")
        
        # Generate dates for September 1-7, 2025
        dates = [f"2025-09-{day:02d}" for day in range(1, 8)]  # Sept 1-7, 2025
        
        availabilities_data = []
        
        # Generate availabilities for each volunteer
        for volunteer_email in volunteer_emails:
            # Each volunteer gets 1-3 random availabilities across the 5 days
            num_availabilities = random.randint(1, 3)
            selected_dates = random.sample(dates, min(num_availabilities, len(dates)))
            
            for date in selected_dates:
                availability = random_availability(volunteer_email, date)
                availabilities_data.append(availability)
        
        print(f"Generated {len(availabilities_data)} availabilities")
        print("Inserting availabilities into Supabase...")
        
        # Insert in batches
        batch_size = 10
        for i in range(0, len(availabilities_data), batch_size):
            batch = availabilities_data[i:i+batch_size]
            response = supabase.table("availabilities").insert(batch).execute()
            if response.data:
                print(f"Successfully inserted availabilities batch {i//batch_size + 1}")
            else:
                print(f"Error inserting availabilities batch {i//batch_size + 1}: {response}")
        
        print(f"Successfully inserted {len(availabilities_data)} availabilities for September 1-7, 2025!")
        
        print("\nSample of inserted availabilities:")
        for i, avail in enumerate(availabilities_data[:5]):
            print(f"\nAvailability {i+1}:")
            for key, value in avail.items():
                print(f"  {key}: {value}")
                
    except Exception as e:
        print(f"Error inserting availabilities data: {str(e)}")
        return False
    
    return True

def main():
    """Main function to run the script"""
    print("=== Add Volunteer Availabilities Script ===")
    print("This script will add availabilities for existing volunteers for September 1-7, 2025.")
    
    # Confirm before insertion
    confirm = input("Add availabilities for September 1-7, 2025? (y/N): ").lower().strip()
    if confirm != 'y':
        print("Operation cancelled.")
        return
    
    # Insert the data
    success = insert_availabilities_data()
    
    if success:
        print("\n✅ Availability insertion completed successfully!")
    else:
        print("\n❌ Availability insertion failed. Please check your configuration and try again.")

if __name__ == "__main__":
    main()
