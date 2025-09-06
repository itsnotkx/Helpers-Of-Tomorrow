#!/usr/bin/env python3
"""
Script to convert coordinates in the seniors table to addresses using Google Maps API.
This script fetches all seniors from the database, converts their coordinates to addresses,
and updates the address column in the database after user confirmation.
"""

import os
import sys
import time
import requests
from typing import Optional, Dict, Any, List
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv('.env.local')

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY")

# Validate environment variables
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in .env.local")

if not GOOGLE_MAPS_API_KEY:
    raise ValueError("GOOGLE_MAPS_API_KEY must be set in .env.local. Please get one from Google Cloud Console.")

# Initialize Supabase client
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

class GoogleMapsGeocoder:
    """Google Maps reverse geocoding service"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://maps.googleapis.com/maps/api/geocode/json"
    
    def get_address_from_coordinates(self, lat: float, lng: float) -> Optional[str]:
        """
        Get address from coordinates using Google Maps Geocoding API
        """
        try:
            params = {
                'latlng': f"{lat},{lng}",
                'key': self.api_key,
                'result_type': 'street_address|premise|subpremise',  # Prioritize specific addresses
                'language': 'en'
            }
            
            print(f"  Geocoding coordinates: {lat}, {lng}")
            response = requests.get(self.base_url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if data['status'] == 'OK' and data['results']:
                    # Get the most specific address (first result)
                    best_result = data['results'][0]
                    formatted_address = best_result.get('formatted_address', '')
                    
                    # Clean up the address for Singapore
                    if formatted_address:
                        # Remove country from the end if it's there
                        if formatted_address.endswith(', Singapore'):
                            formatted_address = formatted_address[:-11]
                        elif formatted_address.endswith('Singapore'):
                            formatted_address = formatted_address[:-9].strip(', ')
                        
                        return formatted_address
                
                elif data['status'] == 'ZERO_RESULTS':
                    print(f"    No results found for coordinates {lat}, {lng}")
                    return None
                elif data['status'] == 'OVER_QUERY_LIMIT':
                    print(f"    Google Maps API quota exceeded")
                    return None
                else:
                    print(f"    Google Maps API error: {data['status']}")
                    return None
            else:
                print(f"    HTTP error: {response.status_code}")
                return None
                
        except Exception as e:
            print(f"    Error geocoding coordinates {lat}, {lng}: {str(e)}")
            return None
    
    def get_nearest_address(self, lat: float, lng: float) -> Optional[str]:
        """
        Get nearest address by expanding search radius
        """
        try:
            params = {
                'latlng': f"{lat},{lng}",
                'key': self.api_key,
                'language': 'en'  # Don't restrict result types for broader search
            }
            
            print(f"  Finding nearest address for coordinates: {lat}, {lng}")
            response = requests.get(self.base_url, params=params, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                
                if data['status'] == 'OK' and data['results']:
                    # Find the best address from results
                    for result in data['results']:
                        address = result.get('formatted_address', '')
                        types = result.get('types', [])
                        
                        # Prefer specific addresses over general areas
                        if any(t in types for t in ['street_address', 'premise', 'subpremise']):
                            if address.endswith(', Singapore'):
                                address = address[:-11]
                            elif address.endswith('Singapore'):
                                address = address[:-9].strip(', ')
                            return address
                    
                    # If no specific address found, use the first result
                    address = data['results'][0].get('formatted_address', '')
                    if address:
                        if address.endswith(', Singapore'):
                            address = address[:-11]
                        elif address.endswith('Singapore'):
                            address = address[:-9].strip(', ')
                        return address
                
        except Exception as e:
            print(f"    Error finding nearest address for {lat}, {lng}: {str(e)}")
            return None

def fetch_seniors_with_coordinates() -> List[Dict[str, Any]]:
    """Fetch all seniors from the database that have coordinates"""
    try:
        print("Fetching seniors from the database...")
        response = supabase.table("seniors").select("*").execute()
        
        if response.data:
            seniors_with_coords = []
            for senior in response.data:
                coords = senior.get('coords')
                if coords and isinstance(coords, dict) and 'lat' in coords and 'lng' in coords:
                    seniors_with_coords.append(senior)
            
            print(f"Found {len(seniors_with_coords)} seniors with coordinates (out of {len(response.data)} total)")
            return seniors_with_coords
        else:
            print("No seniors found in the database")
            return []
            
    except Exception as e:
        print(f"Error fetching seniors: {str(e)}")
        return []

def update_senior_address(senior_id: str, address: str) -> bool:
    """Update a senior's address in the database"""
    try:
        response = supabase.table("seniors").update({"address": address}).eq("uid", senior_id).execute()
        return True
    except Exception as e:
        print(f"Error updating senior {senior_id}: {str(e)}")
        return False

def main():
    """Main function to process all seniors"""
    print("=== Seniors Address Geocoding Script ===")
    print("This script will convert coordinates to addresses using Google Maps API")
    print("You will be asked to confirm each address before it's saved.\n")
    
    # Initialize geocoder
    geocoder = GoogleMapsGeocoder(GOOGLE_MAPS_API_KEY)
    
    # Fetch seniors
    seniors = fetch_seniors_with_coordinates()
    
    if not seniors:
        print("No seniors with coordinates found. Exiting.")
        return
    
    print(f"\nProcessing {len(seniors)} seniors...\n")
    
    updated_count = 0
    skipped_count = 0
    
    for i, senior in enumerate(seniors, 1):
        if(i <30): # --- IGNORE ---
            continue
        print(f"--- Processing senior {i}/{len(seniors)} ---")
        print(f"Name: {senior.get('name', 'Unknown')}")
        print(f"ID: {senior.get('uid', 'Unknown')}")
        
        coords = senior['coords']
        lat = coords['lat']
        lng = coords['lng']
        current_address = senior.get('address', 'None')
        
        print(f"Current address: {current_address}")
        print(f"Coordinates: {lat}, {lng}")
        
        # Skip if address already exists and user doesn't want to overwrite
        if current_address and current_address.strip() and current_address != 'None':
            overwrite = input(f"Address already exists. Overwrite? (y/N): ").strip().lower()
            if overwrite != 'y':
                print("Skipping...")
                skipped_count += 1
                continue
        
        # Try to get specific address first
        address = geocoder.get_address_from_coordinates(lat, lng)
        
        # If no specific address, try nearest address
        if not address:
            print("  No specific address found, searching for nearest address...")
            address = geocoder.get_nearest_address(lat, lng)
        
        if address:
            print(f"Found address: {address}")
            
            # Ask user for confirmation
            confirm = 'y'
            
            if confirm == 'y':
                # Update in database
                if update_senior_address(senior['uid'], address):
                    print("✓ Address updated successfully!")
                    updated_count += 1
                else:
                    print("✗ Failed to update address")
            elif confirm == 'e':
                # Allow user to edit the address
                custom_address = input(f"Enter custom address (or press Enter to use '{address}'): ").strip()
                final_address = custom_address if custom_address else address
                
                if update_senior_address(senior['uid'], final_address):
                    print(f"✓ Address updated to: {final_address}")
                    updated_count += 1
                else:
                    print("✗ Failed to update address")
            else:
                print("Skipping...")
                skipped_count += 1
        else:
            print("✗ Could not find address for these coordinates")
            skipped_count += 1
        
        print()  # Empty line for readability
        
        # Rate limiting - be respectful to Google's API
        time.sleep(0.5)
    
    print("=== Summary ===")
    print(f"Total seniors processed: {len(seniors)}")
    print(f"Addresses updated: {updated_count}")
    print(f"Skipped: {skipped_count}")
    print("Done!")

if __name__ == "__main__":
    main()
