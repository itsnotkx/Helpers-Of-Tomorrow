import random
import uuid
from datetime import datetime, timedelta

# Approximate bounding box around Sembawang, Singapore
LAT_MIN, LAT_MAX = 1.445, 1.462
LNG_MIN, LNG_MAX = 103.805, 103.83

# Sample Singaporean-style names (common Chinese, Malay, Indian names)
SURNAMES = ["Tan", "Lee", "Ng", "Lim", "Wong", "Chan", "Teo", "Goh", "Ismail", "Ahmad", "Singh", "Raj"]
GIVEN_NAMES = ["Wei", "Li", "Hui", "Ming", "Xuan", "Siew", "Hock", "Kok", "Aisyah", "Nur", "Gurpreet", "Priya"]

def fake_sg_name():
    """Return a random Singaporean-style full name."""
    return f"{random.choice(SURNAMES)} {random.choice(GIVEN_NAMES)}"

def rand_coords():
    """Return a random coordinate within Sembawang area bounding box."""
    lat = round(random.uniform(LAT_MIN, LAT_MAX), 6)
    lng = round(random.uniform(LNG_MIN, LNG_MAX), 6)
    return lat, lng

def iso_time(days_offset=0):
    """Return current time offset by given days, in ISO format."""
    return (datetime.utcnow() + timedelta(days=days_offset)).isoformat()

def create_senior(n):
    """Generate SQL INSERT statements for n seniors."""
    stmts = []
    for _ in range(n):
        uid = str(uuid.uuid4())
        name = fake_sg_name()
        lat, lng = rand_coords()
        phys = random.randint(1, 5)
        ment = random.randint(1, 5)
        comm = random.randint(1, 5)
        last_visit = iso_time(days_offset = -random.randint(0, 365))
        stmt = (
            f"INSERT INTO seniors (uid, name, coords, physical, mental, community, last_visit) VALUES "
            f"('{uid}', '{name}', '{{\"lat\": {lat}, \"lng\": {lng}}}', {phys}, {ment}, {comm}, '{last_visit}');"
        )
        stmts.append(stmt)
    return "\n".join(stmts)

def create_volunteer(n):
    """Generate SQL INSERT statements for n volunteers."""
    stmts = []
    for _ in range(n):
        vid = str(uuid.uuid4())
        name = fake_sg_name()
        lat, lng = rand_coords()
        skill = random.randint(1, 3)
        # next 7 days availability
        avail_dates = [iso_time(days_offset=i+1) for i in range(7)]
        avail_array = "{" + ",".join(f"\"{d}\"" for d in avail_dates) + "}"
        stmt = (
            f"INSERT INTO volunteers (vid, name, coords, skill, available) VALUES "
            f"('{vid}', '{name}', '{{\"lat\": {lat}, \"lng\": {lng}}}', {skill}, '{avail_array}');"
        )
        stmts.append(stmt)
    return "\n".join(stmts)

# Example usage:
if __name__ == "__main__":
    print("-- Seniors:")
    print(create_senior(20))
    # print("\n-- Volunteers:")
    # print(create_volunteer(15))
