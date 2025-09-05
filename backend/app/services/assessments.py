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
            return

        # Create DataFrame with required features
        df = pd.DataFrame(seniors)
        features = ['age', 'physical', 'mental', 'dl_intervention', 'rece_gov_sup', 
                   'community', 'making_ends_meet', 'living_situation']
        X = df[features]

        # Get predictions
        predictions = model.predict(X)

        # Update wellbeing scores in database
        for i, senior in enumerate(seniors):
            try:
                supabase.table("seniors").update(
                    {"overall_wellbeing": int(predictions[i])}
                ).eq("uid", senior['uid']).execute()
            except Exception as e:
                logger.error(f"Failed to update wellbeing for senior {senior['uid']}: {str(e)}")

    except Exception as e:
        logger.error(f"Error in classify_seniors: {str(e)}", exc_info=True)