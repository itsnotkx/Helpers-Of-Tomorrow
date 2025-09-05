import os
import random
from datetime import datetime, timedelta
from supabase import create_client, Client
import json
from dotenv import load_dotenv
from supabase import create_client
    
# Load environment variables
load_dotenv('.env.local')

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Sample Singapore names without titles
SENIOR_NAMES = [
    "Ah Beng Tan", "Hwee Choo Lim", "Raj Kumar", "Mei Ling Wong",
    "Kian Seng Lee", "Li Hua Chen", "Krishnan Muthu", "Fatimah Ahmad",
    "Boon Huat Ong", "Siti Aminah", "Wei Ming Tan", "Lakshmi Devi",
    "Chee Keong Lim", "Mary Fernandez", "David Ng", "Priya Sharma",
    "Ahmad Hassan", "Susan Loh", "Vincent Teo", "Kamala Devi",
    "Robert Sim", "Lily Zhang", "Kumar Selvam", "Rosita Santos",
    "Hasan Ali", "Grace Koh", "Selvam Raman", "Jenny Wee",
    "Mohamed Farid", "Indira Nair", "Benjamin Yap", "Salmah Osman",
    "Thomas Lee", "Kamala Suresh", "Abdul Rahman", "Helen Tan",
    "Rajesh Gupta", "Sarah Lim", "Hassan Ibrahim", "Prema Nair",
    "Cheng Wei Koh", "Siti Zahra", "Muthu Raja", "Xiao Ming Liu",
    "Aminah Salleh", "Ramesh Nair", "Li Wei Wang", "Fatimah Ismail",
    "Beng Hock Tan", "Siew Lan Goh", "Arjun Patel", "Mei Fong Low",
    "Hassan Mahmud", "Geok Choo Tay", "Ravi Shankar", "Yi Ling Chua",
    "Ibrahim Rahman", "Bee Hoon Sim", "Muthu Kumar", "Hui Min Loh",
    "Razak Ali", "Jin Hui Ng", "Suresh Reddy", "Ai Lian Tan",
    "Omar Hashim", "Swee Choo Lim", "Krishnan Nair", "Xin Yi Wong",
    "Abdul Aziz", "Pei Shan Chen", "Gopal Singh", "Mei Hua Goh"
]

# Jurong area coordinates (expanded to 60+ unique locations)
JURONG_COORDINATES = [
    {"lat": 1.3390, "lng": 103.7057},  # Jurong East
    {"lat": 1.3280, "lng": 103.7430},  # Jurong West
    {"lat": 1.3200, "lng": 103.7290},  # Boon Lay
    {"lat": 1.3350, "lng": 103.7180},  # Chinese Garden
    {"lat": 1.3310, "lng": 103.7420},  # Pioneer
    {"lat": 1.3160, "lng": 103.7380},  # Joo Koon
    {"lat": 1.3240, "lng": 103.7160},  # Lakeside
    {"lat": 1.3380, "lng": 103.7300},  # Jurong East Central
    {"lat": 1.3290, "lng": 103.7050},  # International Business Park
    {"lat": 1.3400, "lng": 103.7250},  # Teban Gardens
    {"lat": 1.3320, "lng": 103.7350},  # Yuhua
    {"lat": 1.3180, "lng": 103.7320},  # Taman Jurong
    {"lat": 1.3420, "lng": 103.7180},  # Pandan Gardens
    {"lat": 1.3150, "lng": 103.7250},  # Gek Poh
    {"lat": 1.3360, "lng": 103.7400},  # Jurong West Street 41
    {"lat": 1.3280, "lng": 103.7150},  # Jurong West Street 81
    {"lat": 1.3220, "lng": 103.7380},  # Jurong West Street 91
    {"lat": 1.3340, "lng": 103.7220},  # Jurong West Street 61
    {"lat": 1.3190, "lng": 103.7200},  # Jurong West Street 71
    {"lat": 1.3370, "lng": 103.7350},  # Jurong West Street 51
    {"lat": 1.3410, "lng": 103.7080},  # Jurong East Street 13
    {"lat": 1.3330, "lng": 103.7120},  # Jurong East Street 21
    {"lat": 1.3270, "lng": 103.7250},  # Jurong East Street 31
    {"lat": 1.3250, "lng": 103.7340},  # Jurong West Street 24
    {"lat": 1.3300, "lng": 103.7380},  # Jurong West Street 64
    {"lat": 1.3170, "lng": 103.7300},  # Jurong West Street 74
    {"lat": 1.3430, "lng": 103.7200},  # Pandan Valley
    {"lat": 1.3140, "lng": 103.7180},  # Corporation Drive
    {"lat": 1.3380, "lng": 103.7400},  # Jurong Gateway Road
    {"lat": 1.3210, "lng": 103.7350},  # Jurong West Avenue 1
    {"lat": 1.3350, "lng": 103.7280},  # Jurong West Avenue 2
    {"lat": 1.3290, "lng": 103.7320},  # Jurong West Avenue 3
    {"lat": 1.3230, "lng": 103.7220},  # Jurong West Avenue 4
    {"lat": 1.3320, "lng": 103.7180},  # Jurong West Avenue 5
    {"lat": 1.3260, "lng": 103.7360},  # Jurong West Central 1
    {"lat": 1.3340, "lng": 103.7320},  # Jurong West Central 2
    {"lat": 1.3180, "lng": 103.7280},  # Jurong West Central 3
    {"lat": 1.3220, "lng": 103.7180},  # Pioneer Road North
    {"lat": 1.3160, "lng": 103.7320},  # Pioneer Road
    {"lat": 1.3120, "lng": 103.7380},  # Joo Koon Road
    {"lat": 1.3380, "lng": 103.7120},  # Upper Jurong Road
    {"lat": 1.3420, "lng": 103.7260},  # Clementi Road
    {"lat": 1.3270, "lng": 103.7080},  # Jurong Town Hall Road
    {"lat": 1.3310, "lng": 103.7250},  # Boon Lay Way
    {"lat": 1.3240, "lng": 103.7300},  # Boon Lay Place
    {"lat": 1.3190, "lng": 103.7240},  # Boon Lay Avenue
    {"lat": 1.3350, "lng": 103.7140},  # Jurong East Avenue 1
    {"lat": 1.3290, "lng": 103.7200},  # Jurong East Street 24
    {"lat": 1.3360, "lng": 103.7220},  # Jurong East Street 32
    {"lat": 1.3250, "lng": 103.7120},  # Teban Gardens Road
    {"lat": 1.3380, "lng": 103.7380},  # Jurong West Street 23
    {"lat": 1.3200, "lng": 103.7160},  # Jurong West Street 52
    {"lat": 1.3330, "lng": 103.7300},  # Jurong West Street 62
    {"lat": 1.3270, "lng": 103.7360},  # Jurong West Street 72
    {"lat": 1.3210, "lng": 103.7280},  # Jurong West Street 82
    {"lat": 1.3340, "lng": 103.7360},  # Jurong West Street 92
    {"lat": 1.3300, "lng": 103.7140},  # Lakeside Drive
    {"lat": 1.3230, "lng": 103.7120},  # Lakeside Road
    {"lat": 1.3170, "lng": 103.7220},  # Corporation Road
    {"lat": 1.3140, "lng": 103.7300},  # Shipyard Road
    {"lat": 1.3410, "lng": 103.7340},  # Jurong Gateway
    {"lat": 1.3250, "lng": 103.7200},  # Yuhua Avenue
    {"lat": 1.3180, "lng": 103.7360},  # Tah Ching Road
    {"lat": 1.3220, "lng": 103.7320},  # Taman Jurong Road
    {"lat": 1.3360, "lng": 103.7160}   # International Road
]

def generate_senior_data(name, coordinate):
    """Generate a single senior's data with specific name and coordinate"""
    return {
        "name": name,
        "coords": coordinate,
        "physical": random.randint(1, 5),
        "mental": random.randint(1, 5),
        "community": random.randint(1, 5),
        "last_visit": (datetime.now() - timedelta(days=random.randint(1, 365 * 2))).isoformat(),
        "dl_intervention": random.choice([0, 1]),
        "rece_gov_sup": random.choice([0, 1]),
        "making_ends_meet": random.randint(1, 5),
        "living_situation": random.randint(1, 5),
        "age": random.randint(67, 100)
    }

def insert_seniors_data(num_seniors=60):
    """Insert senior data into the database"""
    try:
        print(f"Generating {num_seniors} seniors data...")
        
        # Ensure we don't exceed available names or coordinates
        max_available = min(len(SENIOR_NAMES), len(JURONG_COORDINATES))
        if num_seniors > max_available:
            print(f"Warning: Requested {num_seniors} seniors but only {max_available} unique combinations available.")
            num_seniors = max_available
        
        seniors_data = []
        
        # Use random sampling to ensure unique combinations
        name_indices = random.sample(range(len(SENIOR_NAMES)), num_seniors)
        coord_indices = random.sample(range(len(JURONG_COORDINATES)), num_seniors)
        
        for i in range(num_seniors):
            name = SENIOR_NAMES[name_indices[i]]
            coordinate = JURONG_COORDINATES[coord_indices[i]]
            senior = generate_senior_data(name, coordinate)
            seniors_data.append(senior)
        
        print("Inserting data into Supabase...")
        
        # Insert data in batches to avoid potential size limits
        batch_size = 10
        for i in range(0, len(seniors_data), batch_size):
            batch = seniors_data[i:i+batch_size]
            response = supabase.table("seniors").insert(batch).execute()
            
            if response.data:
                print(f"Successfully inserted batch {i//batch_size + 1}")
            else:
                print(f"Error inserting batch {i//batch_size + 1}: {response}")
        
        print(f"Successfully inserted {num_seniors} seniors into the database!")
        
        # Display sample of inserted data
        print("\nSample of inserted data:")
        for i, senior in enumerate(seniors_data[:3]):
            print(f"\nSenior {i+1}:")
            for key, value in senior.items():
                print(f"  {key}: {value}")
                
    except Exception as e:
        print(f"Error inserting seniors data: {str(e)}")
        return False
    
    return True

def main():
    """Main function to run the script"""
    print("=== Seniors Data Insertion Script ===")
    print("This script will insert sample data for seniors in the Jurong area.")
    
    # Get number of seniors to insert
    try:
        num_seniors = int(input("Enter number of seniors to insert (default 60): ") or "60")
    except ValueError:
        num_seniors = 60
    
    # Confirm before insertion
    confirm = input(f"Insert {num_seniors} seniors? (y/N): ").lower().strip()
    if confirm != 'y':
        print("Operation cancelled.")
        return
    
    # Insert the data
    success = insert_seniors_data(num_seniors)
    
    if success:
        print("\n✅ Data insertion completed successfully!")
    else:
        print("\n❌ Data insertion failed. Please check your configuration and try again.")

if __name__ == "__main__":
    main()