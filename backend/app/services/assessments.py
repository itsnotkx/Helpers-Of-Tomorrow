import os
import joblib
import pandas as pd
from config.settings import supabase, logger

def classify_seniors(data: dict):
    try:
        # Load the model
        current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        model_data = joblib.load(os.path.join(current_dir, 'seniorModel', 'training', 'senior_risk_model.pkl'))
        model = model_data["model"]

        # Get seniors data and prepare features
        seniors = data.get("seniors", [])
        if not seniors:
            return {"assessments": []}

        # Create DataFrame with required features
        df = pd.DataFrame(seniors)
        features = ['age', 'physical', 'mental', 'dl_intervention', 'rece_gov_sup', 
                   'community', 'making_ends_meet', 'living_situation']
        X = df[features]

        # Get predictions and probabilities
        predictions = model.predict(X)
        probabilities = model.predict_proba(X)

        # Update wellbeing scores in database
        for i, senior in enumerate(seniors):
            try:
                supabase.table("seniors").update(
                    {"overall_wellbeing": int(predictions[i])}
                ).eq("uid", senior['uid']).execute()
            except Exception as e:
                logger.error(f"Failed to update wellbeing for senior {senior['uid']}: {str(e)}")

        # Create assessments
        assessments = []
        wellbeing_to_priority = {1: "HIGH", 2: "MEDIUM", 3: "LOW"}
        
        for i, senior in enumerate(seniors):
            prediction = int(predictions[i])
            probs = probabilities[i]
            max_prob = max(probs)
            
            risk_score = (
                float(senior.get('physical', 0)) + 
                float(senior.get('mental', 0)) + 
                float(senior.get('community', 0))
            ) / 15

            assessments.append({
                "uid": senior['uid'],
                "risk": round(risk_score, 2),
                "priority": wellbeing_to_priority.get(prediction, "MEDIUM"),
                "needscare": risk_score > 0.6 or prediction == 1,
                "confidence": round(float(max_prob), 2),
                "wellbeing": prediction
            })

        return {"assessments": assessments}

    except Exception as e:
        logger.error(f"Error in classify_seniors: {str(e)}", exc_info=True)
        return {"error": str(e), "assessments": []}