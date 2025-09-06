#!/usr/bin/env python3
"""
Quick test to see what seniors exist in the database and their coordinate structure
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv('.env.local')

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_KEY must be set in .env.local")
    sys.exit(1)

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def check_seniors():
    """Check what seniors exist and their structure"""
    try:
        print("Fetching seniors from database...")
        response = supabase.table("seniors").select("id, name, coords, address").limit(5).execute()
        
        if response.data:
            print(f"\nFound {len(response.data)} seniors (showing first 5):")
            print("-" * 80)
            
            for i, senior in enumerate(response.data, 1):
                print(f"Senior #{i}:")
                print(f"  ID: {senior.get('id', 'N/A')}")
                print(f"  Name: {senior.get('name', 'N/A')}")
                print(f"  Coords: {senior.get('coords', 'N/A')}")
                print(f"  Address: {senior.get('address', 'None')}")
                print()
        else:
            print("No seniors found in database")
            
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    check_seniors()
