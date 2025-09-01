from fastapi import FastAPI
from typing import List

app = FastAPI(title="AIC Senior Care API")

# -------------------------------
# Endpoints
# -------------------------------

@app.post("/decisionTree")
def run_decision_tree(seniors: List[dict]):
    """
    Evaluate seniors using the weighted differentiable decision tree.
    Returns a risk score and recommended action for each senior.
    """
    results = []
    for senior in seniors:
        results.append({
            "UID": senior.get("UID"),
            "RiskScore": 0.7,  # dummy value
            "NeedsAttention": True,
            "TopFactors": ["PhysicalHealthScore", "CommunityEngagementScore"]
        })
    return results

@app.post("/assignVolunteers")
def assign_volunteers(volunteers: List[dict], seniors: List[dict]):
    """
    Assign volunteers to nearby seniors based on proximity, density, and preferences.
    """
    assignments = []
    for i, senior in enumerate(seniors):
        volunteer = volunteers[i % len(volunteers)]
        assignments.append({
            "SeniorUID": senior.get("UID"),
            "VolunteerVID": volunteer.get("VID"),
            "ClusterID": i % 3,  # dummy cluster
            "Priority": 1
        })
    return assignments

@app.post("/scheduleVolunteers")
def schedule_volunteers(assignments: List[dict]):
    """
    Generate weekly schedules given volunteer availability and senior needs.
    """
    schedules = []
    for assignment in assignments:
        schedules.append({
            "VolunteerVID": assignment.get("VolunteerVID"),
            "SeniorUID": assignment.get("SeniorUID"),
            "Date": "2025-09-07",
            "TimeSlot": "09:00-10:00"
        })
    return schedules

@app.get("/fetchUser")
def fetch_user():
    return {
        "UID": 12345,
        "Name": "Ethan Lim Jin",
        "District": "Punggol West",
    }

@app.get("/fetchVolunteer")
def fetch_volunteer():
    return {
        "VID": 12346,
        "Name": "Khoo Kar Xing",
        "District": "Punggol West",
        "House": "Block 123 #12-34",
        "Availability": ["2025-09-07T09:00:00+08:00 - 2025-09-07T16:00:00+08:00"],
        "Skillset": 2
    }

@app.get("/")
def healthcheck():
    return {"statusCode": 200, "message": "OK"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
