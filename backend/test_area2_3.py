import requests
from pprint import pprint

BASE = "http://127.0.0.1:8000"

# -------------------------
# API Helpers
# -------------------------
def fetch_demo_seniors(count=10):
    resp = requests.get(f"{BASE}/demo/seniors?count={count}")
    resp.raise_for_status()
    return resp.json()["seniors"]

def fetch_demo_volunteers(count=5):
    resp = requests.get(f"{BASE}/demo/volunteers?count={count}")
    resp.raise_for_status()
    return resp.json()["volunteers"]

def assess_seniors(seniors):
    resp = requests.post(f"{BASE}/assess", json=seniors)
    resp.raise_for_status()
    assessments = resp.json()["assessments"]

    for s in seniors:
        matching = next((a for a in assessments if a["uid"] == s["uid"]), {})
        s["risk"] = matching.get("risk", 0)
    return seniors, assessments

def allocate_volunteers(volunteers, seniors):
    data = {"volunteers": volunteers, "seniors": seniors}
    resp = requests.post(f"{BASE}/allocate", json=data)
    resp.raise_for_status()
    res = resp.json()
    assignments = res["assignments"]
    seniors = res["seniors"]
    cluster_map = {}
    for assign in assignments:
        cluster_map.setdefault(assign["cluster"], []).append(assign["volunteer"])
    return assignments, seniors, cluster_map

def create_schedule(assignments, seniors, volunteers):
    """Include volunteers in payload for availability check."""
    data = {"assignments": assignments, "seniors": seniors, "volunteers": volunteers}
    resp = requests.post(f"{BASE}/schedule", json=data)
    resp.raise_for_status()
    return resp.json()["schedules"]

# -------------------------
# Test Runner
# -------------------------
if __name__ == "__main__":
    seniors = fetch_demo_seniors(15)
    volunteers = fetch_demo_volunteers(6)

    seniors, assessments = assess_seniors(seniors)
    assignments, seniors, cluster_map = allocate_volunteers(volunteers, seniors)
    schedules = create_schedule(assignments, seniors, volunteers)  # pass volunteers here

    print("\n=== Risk Assessments (sample) ===")
    pprint(assessments[:5])

    print("\n=== Cluster Assignments ===")
    pprint(cluster_map)

    print("\n=== Volunteer Assignments ===")
    pprint(assignments)

    print("\n=== Scheduled Visits ===")
    pprint(schedules if schedules else "⚠️ No schedules generated. Check availability overlaps!")
