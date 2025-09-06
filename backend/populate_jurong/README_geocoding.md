# Geocode Seniors Addresses Script

This script converts coordinates in the "seniors" table to human-readable addresses using the Google Maps Geocoding API.

## Prerequisites

1. **Google Maps API Key**: You need a Google Cloud Platform account with the Geocoding API enabled.
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one
   - Enable the "Geocoding API"
   - Create an API key with access to the Geocoding API
   - (Optional) Restrict the API key to your IP address for security

2. **Environment Variables**: Add your Google Maps API key to your `.env.local` file:
   ```
   GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

## What the Script Does

1. **Fetches Seniors**: Retrieves all seniors from the database that have coordinates
2. **Geocodes Coordinates**: For each senior, converts their lat/lng coordinates to a readable address using Google Maps API
3. **User Confirmation**: For each address found, asks you to confirm before updating
4. **Updates Database**: Updates the `address` column in the seniors table

## Features

- **Two-tier Address Resolution**:
  - First tries to find specific addresses (street addresses, premises)
  - If none found, searches for nearest addresses with broader criteria
  
- **Interactive Confirmation**:
  - Shows current address (if any) vs. found address
  - Allows you to skip, accept, or edit addresses before saving
  - Handles existing addresses (asks if you want to overwrite)

- **Rate Limiting**: Includes delays between API calls to respect Google's usage limits

- **Error Handling**: Gracefully handles API errors, network issues, and missing data

## Usage

1. **Navigate to the script directory**:
   ```bash
   cd /Users/zin/SMU/y2/y2s1/techseries/TechSeries2025/backend/populate_jurong
   ```

2. **Run the script**:
   ```bash
   /Users/zin/SMU/y2/y2s1/techseries/TechSeries2025/.venv/bin/python geocode_seniors_addresses.py
   ```

## Interactive Prompts

For each senior, you'll see:
```
--- Processing senior 1/10 ---
Name: Ah Beng Tan
ID: 123e4567-e89b-12d3-a456-426614174000
Current address: None
Coordinates: 1.3390, 103.7057
  Geocoding coordinates: 1.3390, 103.7057
Found address: 3 Gateway Drive, Westgate
Update address to '3 Gateway Drive, Westgate'? (y/N/e to edit):
```

**Response options**:
- `y` - Accept and save the address
- `N` or Enter - Skip this senior
- `e` - Edit the address before saving

## Cost Considerations

- Google Maps Geocoding API charges per request
- Current pricing (as of 2024): $5 per 1000 requests
- First 200 requests per month are free
- The script includes rate limiting (0.5 seconds between requests) to be respectful

## Troubleshooting

**"GOOGLE_MAPS_API_KEY must be set"**: 
- Add your API key to `.env.local`

**"OVER_QUERY_LIMIT"**: 
- You've exceeded your API quota
- Check your Google Cloud Console billing and quotas

**"HTTP error: 403"**: 
- API key might be invalid or restricted
- Check your API key permissions in Google Cloud Console

**Network timeouts**: 
- The script will continue with the next senior
- You can re-run the script as it skips seniors that already have addresses
