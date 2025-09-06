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


# Volunteer names and specific emails
VOLUNTEERS = [
    {"name": "Alex Chen", "email": "alex.chen@sample.com"},
    {"name": "Sarah Krishnan", "email": "sarah.krishnan@sample.com"},
    {"name": "Marcus Lim", "email": "marcus.lim@sample.com"},
    {"name": "Jessica Wong", "email": "jessica.wong@sample.com"},
    {"name": "Ryan Patel", "email": "ryan.patel@sample.com"},
    {"name": "Emma Tan", "email": "emma.tan@sample.com"},
    {"name": "Daniel Kumar", "email": "daniel.kumar@sample.com"},
    {"name": "Sophie Lee", "email": "sophie.lee@sample.com"},
    {"name": "Nathan Ong", "email": "nathan.ong@sample.com"},
    {"name": "Isabella Garcia", "email": "isabella.garcia@sample.com"},
    {"name": "Aaron Singh", "email": "aaron.singh@sample.com"},
    {"name": "Chloe Ng", "email": "chloe.ng@sample.com"},
    {"name": "Ethan Rajesh", "email": "ethan.rajesh@sample.com"},
    {"name": "Olivia Fernandez", "email": "olivia.fernandez@sample.com"},
    {"name": "Lucas Teo", "email": "lucas.teo@sample.com"},
    {"name": "Ava Sharma", "email": "ava.sharma@sample.com"},
    {"name": "Mason Ali", "email": "mason.ali@sample.com"},
    {"name": "Zoe Yap", "email": "zoe.yap@sample.com"},
    {"name": "Logan Nair", "email": "logan.nair@sample.com"},
    {"name": "Mia Santos", "email": "mia.santos@sample.com"}
]

# Volunteer coordinates (different from seniors, but still in Jurong area)
VOLUNTEER_COORDINATES = [
    {"lat": 1.3385, "lng": 103.7065},  # Jurong East MRT
    {"lat": 1.3275, "lng": 103.7435},  # Jurong West Sports Complex
    {"lat": 1.3195, "lng": 103.7295},  # Boon Lay Shopping Centre
    {"lat": 1.3355, "lng": 103.7185},  # Chinese Garden MRT
    {"lat": 1.3315, "lng": 103.7425},  # Pioneer Mall
    {"lat": 1.3165, "lng": 103.7385},  # Joo Koon MRT
    {"lat": 1.3245, "lng": 103.7165},  # Lakeside MRT
    {"lat": 1.3375, "lng": 103.7305},  # JEM Shopping Mall
    {"lat": 1.3295, "lng": 103.7055},  # J-Cube
    {"lat": 1.3405, "lng": 103.7255},  # West Coast Plaza
    {"lat": 1.3325, "lng": 103.7355},  # Jurong Point
    {"lat": 1.3185, "lng": 103.7325},  # Jurong Regional Library
    {"lat": 1.3425, "lng": 103.7185},  # NUS Bukit Timah Campus
    {"lat": 1.3155, "lng": 103.7255},  # Pioneer Secondary School
    {"lat": 1.3365, "lng": 103.7405},  # Ng Teng Fong General Hospital
    {"lat": 1.3285, "lng": 103.7155},  # Jurong Junior College
    {"lat": 1.3225, "lng": 103.7385},  # Nanyang Technological University
    {"lat": 1.3345, "lng": 103.7225},  # Singapore Chinese Cultural Centre
    {"lat": 1.3195, "lng": 103.7205},  # Jurong Town Hall
    {"lat": 1.3375, "lng": 103.7355}   # Jurong East Bus Interchange
]



def generate_volunteer_data(volunteer, coordinate):
    """Generate a single volunteer's data with specific name, email, and coordinate"""
    return {
        "name": volunteer["name"],
        "coords": coordinate,
        "skill": random.randint(1, 3),
        "email": volunteer["email"]
    }


def random_half_hour_time():
    """Return a random time string in half-hour increments between 09:00:00 and 22:00:00"""
    hour = random.randint(9, 21)
    minute = random.choice([0, 30])
    return f"{hour:02d}:{minute:02d}:00"

def random_availability(volunteer_email):
    """Generate a random availability for a volunteer"""
    # Date between 2025/09/08 and 2025/09/14
    start_date = 8
    end_date = 14
    day = random.randint(start_date, end_date)
    date = f"2025-09-{day:02d}"
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

def insert_volunteers_data(num_volunteers=20):
    """Insert volunteer data and availabilities into the database"""
    try:
        print(f"Generating {num_volunteers} volunteers data...")
        max_available = min(len(VOLUNTEERS), len(VOLUNTEER_COORDINATES))
        if num_volunteers > max_available:
            print(f"Warning: Requested {num_volunteers} volunteers but only {max_available} unique combinations available.")
            num_volunteers = max_available
        volunteers_data = []
        availabilities_data = []
        for i in range(num_volunteers):
            volunteer = VOLUNTEERS[i]
            coordinate = VOLUNTEER_COORDINATES[i]
            vdata = generate_volunteer_data(volunteer, coordinate)
            volunteers_data.append(vdata)
            # Generate 1-3 random availabilities per volunteer
            for _ in range(random.randint(1, 3)):
                availability = random_availability(volunteer["email"])
                availabilities_data.append(availability)
        print("Inserting volunteers into Supabase...")
        batch_size = 10
        for i in range(0, len(volunteers_data), batch_size):
            batch = volunteers_data[i:i+batch_size]
            response = supabase.table("volunteers").insert(batch).execute()
            if response.data:
                print(f"Successfully inserted volunteers batch {i//batch_size + 1}")
            else:
                print(f"Error inserting volunteers batch {i//batch_size + 1}: {response}")
        print("Inserting availabilities into Supabase...")
        for i in range(0, len(availabilities_data), batch_size):
            batch = availabilities_data[i:i+batch_size]
            response = supabase.table("availabilities").insert(batch).execute()
            if response.data:
                print(f"Successfully inserted availabilities batch {i//batch_size + 1}")
            else:
                print(f"Error inserting availabilities batch {i//batch_size + 1}: {response}")
        print(f"Successfully inserted {num_volunteers} volunteers and {len(availabilities_data)} availabilities into the database!")
        print("\nSample of inserted volunteers:")
        for i, volunteer in enumerate(volunteers_data[:3]):
            print(f"\nVolunteer {i+1}:")
            for key, value in volunteer.items():
                print(f"  {key}: {value}")
        print("\nSample of inserted availabilities:")
        for i, avail in enumerate(availabilities_data[:3]):
            print(f"\nAvailability {i+1}:")
            for key, value in avail.items():
                print(f"  {key}: {value}")
    except Exception as e:
        print(f"Error inserting volunteers/availabilities data: {str(e)}")
        return False
    return True

def main():
    """Main function to run the script"""
    print("=== Volunteers Data Insertion Script ===")
    print("This script will insert 20 volunteer entries in the Jurong area.")
    
    # Confirm before insertion
    confirm = input("Insert 20 volunteers? (y/N): ").lower().strip()
    if confirm != 'y':
        print("Operation cancelled.")
        return
    
    # Insert the data
    success = insert_volunteers_data(20)
    
    if success:
        print("\n✅ Data insertion completed successfully!")
    else:
        print("\n❌ Data insertion failed. Please check your configuration and try again.")

if __name__ == "__main__":
    main()