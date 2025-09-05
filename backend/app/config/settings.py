import os
from dotenv import load_dotenv
from supabase import create_client
import logging

# Load environment variables
load_dotenv('.env.local')

# Supabase configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Validate environment variables
if not SUPABASE_URL:
    raise ValueError("SUPABASE_URL environment variable is required. Please check your .env.local file.")
if not SUPABASE_KEY:
    raise ValueError("SUPABASE_KEY environment variable is required. Please check your .env.local file.")

try:
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
except Exception as e:
    raise ValueError(f"Failed to create Supabase client: {e}")

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# CORS origins
CORS_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Set OpenMP threads
os.environ['OMP_NUM_THREADS'] = '1'