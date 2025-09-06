#!/usr/bin/env python3
"""
Script to update seniors table with addresses based on coordinates.
This script fetches all seniors from the database, converts their coordinates to addresses,
and updates the address column in the database.
"""

import os
import sys
import time
from typing import Optional, Dict, Any
from dotenv import load_dotenv
from supabase import create_client, Client

# Add the app directory to the Python path to import utils
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'app'))

from utils.geocoding import geocoder
from config.settings import logger

# Load environment variables
load_dotenv('.env.local')

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Validate environment variables
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env.local")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def fetch_all_seniors():
    """Fetch all seniors from the database"""
    try:
        print("Fetching all seniors from the database...")
        response = supabase.table("seniors").select("*").execute()
        
        if response.data:
            print(f"Found {len(response.data)} seniors in the database")
            return response.data
        else:
            print("No seniors found in the database")
            return []
    except Exception as e:
        print(f"Error fetching seniors: {str(e)}")
        return []

def extract_coordinates(senior: Dict[Any, Any]) -> Optional[tuple]:
    """Extract coordinates from senior data"""
    try:
        coords = senior.get('coords', {})
        if isinstance(coords, dict) and 'lat' in coords and 'lng' in coords:
            return (float(coords['lat']), float(coords['lng']))
        else:
            print(f"Invalid coordinates for senior {senior.get('name', 'Unknown')}: {coords}")
            return None
    except (ValueError, TypeError) as e:
        print(f"Error extracting coordinates for senior {senior.get('name', 'Unknown')}: {str(e)}")
        return None

def get_address_from_coordinates(lat: float, lng: float) -> Optional[str]:
    """Get address from coordinates using the geocoding service"""
    try:
        address = geocoder.get_singapore_address(lat, lng)
        if address:
            print(f"  Coordinates ({lat:.4f}, {lng:.4f}) -> {address}")
            return address
        else:
            print(f"  No address found for coordinates ({lat:.4f}, {lng:.4f})")
            return None
    except Exception as e:
        print(f"  Error getting address for coordinates ({lat:.4f}, {lng:.4f}): {str(e)}")
        return None

def update_senior_address(senior_id: int, address: str) -> bool:
    """Update a senior's address in the database"""
    try:
        response = supabase.table("seniors").update({"address": address}).eq("id", senior_id).execute()
        
        if response.data:
            return True
        else:
            print(f"  Warning: No data returned when updating senior ID {senior_id}")
            return False
    except Exception as e:
        print(f"  Error updating senior ID {senior_id}: {str(e)}")
        return False

def process_seniors_addresses(batch_size: int = 1, delay_between_batches: float = 0.5):
    """Process all seniors and update their addresses with interactive confirmation"""
    print("=== Interactive Senior Address Update ===")
    print("This script will fetch coordinates from the seniors table and update addresses.")
    print("You will be asked to confirm each address before updating.")
    print()
    
    # Fetch all seniors
    seniors = fetch_all_seniors()
    if not seniors:
        print("No seniors to process. Exiting.")
        return False
    
    print(f"\nProcessing {len(seniors)} seniors interactively...")
    print("(You will be asked to confirm each address)")
    
    successful_updates = 0
    failed_updates = 0
    skipped_updates = 0
    
    # Process seniors one by one for interactive confirmation
    for i, senior in enumerate(seniors, 1):
        print(f"\n--- Senior {i}/{len(seniors)} ---")
        senior_name = senior.get('name', 'Unknown')
        senior_id = senior.get('id')
        
        if not senior_id:
            print(f"  Skipping senior {senior_name}: No ID found")
            skipped_updates += 1
            continue
        
        # Check if address already exists
        existing_address = senior.get('address')
        if existing_address and existing_address.strip():
            print(f"  Skipping {senior_name}: Address already exists ({existing_address})")
            skipped_updates += 1
            continue
        
        print(f"  Processing {senior_name} (ID: {senior_id})...")
        
        # Extract coordinates
        coords = extract_coordinates(senior)
        if not coords:
            failed_updates += 1
            continue
        
        lat, lng = coords
        
        # Get address from coordinates
        address = get_address_from_coordinates(lat, lng)
        if not address:
            failed_updates += 1
            continue
        
        # Ask for confirmation before updating
        print(f"    📍 Coordinates: ({lat:.4f}, {lng:.4f})")
        print(f"    🏠 Suggested address: {address}")
        
        while True:
            choice = input(f"    Update {senior_name} with this address? (y/n/e/s): ").lower().strip()
            if choice == 'y':
                # Update database
                if update_senior_address(senior_id, address):
                    print(f"    ✅ Updated {senior_name} with address: {address}")
                    successful_updates += 1
                else:
                    print(f"    ❌ Failed to update {senior_name}")
                    failed_updates += 1
                break
            elif choice == 'n':
                print(f"    ⏭️  Skipped {senior_name}")
                skipped_updates += 1
                break
            elif choice == 'e':
                custom_address = input("    Enter custom address: ").strip()
                if custom_address:
                    if update_senior_address(senior_id, custom_address):
                        print(f"    ✅ Updated {senior_name} with custom address: {custom_address}")
                        successful_updates += 1
                    else:
                        print(f"    ❌ Failed to update {senior_name}")
                        failed_updates += 1
                else:
                    print(f"    ⏭️  Skipped {senior_name} (empty address)")
                    skipped_updates += 1
                break
            elif choice == 's':
                print(f"    ⏭️  Skipped {senior_name}")
                skipped_updates += 1
                break
            else:
                print("    Please enter 'y' (yes), 'n' (no), 'e' (edit), or 's' (skip)")
        
        # Small delay between individual requests to be respectful
        time.sleep(delay_between_batches)
    
    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Total seniors processed: {len(seniors)}")
    print(f"Successfully updated: {successful_updates}")
    print(f"Failed updates: {failed_updates}")
    print(f"Skipped (already had address): {skipped_updates}")
    print("="*60)
    
    if successful_updates > 0:
        print(f"\n✅ Successfully updated {successful_updates} senior addresses!")
        
        # Show a few examples
        print("\nFetching updated records for verification...")
        try:
            sample_response = supabase.table("seniors").select("name, address").neq("address", None).limit(5).execute()
            if sample_response.data:
                print("\nSample updated records:")
                for record in sample_response.data:
                    print(f"  {record.get('name', 'Unknown')}: {record.get('address', 'No address')}")
        except Exception as e:
            print(f"  Could not fetch sample records: {str(e)}")
    
    return successful_updates > 0

def main():
    """Main function"""
    print("=== Interactive Senior Address Update Script ===")
    print("This script will convert coordinates to addresses for all seniors in the database.")
    print("It uses Singapore's OneMap API with Nominatim as fallback.")
    print("\nFor each senior, you will be asked to confirm the address before updating.")
    print("Options for each address:")
    print("  y - Accept the suggested address")
    print("  n - Reject and skip this senior")
    print("  e - Edit/enter a custom address")
    print("  s - Skip this senior")
    print()
    
    # Configuration - simplified since we're going one by one
    try:
        delay = float(input("Enter delay between requests in seconds (default 0.5): ") or "0.5")
    except ValueError:
        print("Using default value: delay=0.5")
        delay = 0.5
    
    # Confirm before processing
    confirm = input(f"\nStart interactive address processing? (y/N): ").lower().strip()
    if confirm != 'y':
        print("Operation cancelled.")
        return
    
    # Process all seniors (batch_size=1 for interactive mode)
    success = process_seniors_addresses(batch_size=1, delay_between_batches=delay)
    
    if success:
        print("\n🎉 Interactive address update process completed successfully!")
    else:
        print("\n⚠️  Address update process completed with issues. Please check the logs above.")

if __name__ == "__main__":
    main()
