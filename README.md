# Helpers of Tomorrow (HOT)

*A Volunteer Management System for Efficient, Inclusive, and Scalable Senior Care*

## 🌍 Problem Statement

Volunteer organisations often coordinate using WhatsApp groups, leading to:

* Messy scheduling and miscommunication.
* Volunteers feeling frustrated or dropping out.
* Seniors going months without proper care.

For many seniors, these visits are **essential** - not just for companionship, but also for wellbeing check-ins and early detection of risks. Without a better system, seniors fall through the cracks.

## 💡 Our Solution

**Helpers of Tomorrow (HOT)** is an AI-powered volunteer management platform that:

* Ensures **timely, equitable senior care**.
* Reduces **friction for volunteers**.
* Gives **district leaders (DLs)** a bird’s-eye view for smarter coordination.

HOT has three pillars of intelligence:

1. **Senior Scoring & Classification**

   * Factors: physical health, mental health, living situation, past visits, community participation.
   * Model: Random Forest coupled with SP
   * Output: Seniors are classified into care levels, flagging urgent cases automatically, while emphasising the importance of explainable AI.

2. **Proximity & Density Clustering**

   * Step 1: Use **K-means clustering** to group housing blocks by distance.
   * Step 2: Compute **density score** = seniors not yet visited ÷ cluster area.
   * Step 3: Run weighted clustering using volunteer addresses.
   * Benefit: Minimises travel costs, prioritises high-need clusters, builds neighbourhood continuity.

3. **Smart Scheduling**

   * Inputs: senior classifications, cluster density, volunteer availability.
   * Outputs: Weekly schedules that:

     * Match senior volunteers/DLs to complex cases.
     * Balance workload among regular volunteers.
     * Guarantee every senior gets at least one visit a year.

## 🎯 Features

### Volunteer Page

* Submit availability weekly (until Sat 11:59 PM).
* View personal schedule at a glance.
* No more endless WhatsApp back-and-forth.

### District Leader Dashboard

* Total seniors and high-priority seniors.
* Seniors needing immediate care.
* Interactive maps with drill-downs into volunteers/seniors.
* Search volunteer schedules instantly.

## 🛠️ Technical Implementation

* **Frontend:** React + Tailwind (map visualisation via Mapbox).
* **Backend:** Python (FastAPI), PostgreSQL.
* **Models:**

  * Random Forest + SHAP (classification).
  * Modified K-Means clustering (Radius Thresholding, Centroid based assignments, automated cluster splitting using farthest point heuristic).
  * Scheduler

## 📈 Impact

* **For Seniors:** Faster, more consistent care. Fewer left behind.
* **For Volunteers:** Lower transport costs, clearer schedules, better satisfaction.
* **For District Leaders:** Less admin overhead, more focus on critical seniors.

## 🚀 Future Vision

HOT is designed to be **scalable and inclusive**:

* Multi-language support (Mandarin, Malay, Tamil).
* Expansion to other groups (migrant workers, persons with disabilities).
* Strong data privacy safeguards — seniors may opt out of data usage.

## ⚖️ Considerations

* **Costs:** Ongoing retraining of models, data cleaning, audits.
* **Social Risks:** Volunteers feeling “locked in” to schedules; DLs need training.
* **Mitigation:** Human overrides, retraining of volunteers/DLs, phased pilot rollout.

## 📊 Alignment with Judging Rubric

* **Innovation:** Combines explainable AI + clustering + scheduling for social care.
* **Impact:** Directly addresses Singapore’s ageing population challenge.
* **Technical Depth:** End-to-end system with classification, clustering, optimisation, and AWS deployment.
* **Scalability:** Lightweight, modular design; can expand to new communities.
* **Feasibility:** Built with existing datasets (AIC/MOH), tested with volunteer workflows.

----
To run the project:

Prerequisites:
- Supabase API Key + Database Link
- Clerk API Key
- Gmail + App Password
- Mapbox token

1) Fork the repo
2) Create(and activate) a virtual environment
```
py -m venv .venv
.venv\scripts\activate
```
3) Install backend requirements
```
cd backend
pip install -r requirements.txt
```
4) Move .env.local file into backend/app
5) Launch backend
```
cd app
fastapi run
```
6) Install frontend requirements
```
cd ..
cd .. # should be in /Helpers-Of-Tomorrow directory
cd hot_front
npm install
```
7) Move frontend's .venv file to /hot_front
7) Launch frontend
```
npm run dev
```
