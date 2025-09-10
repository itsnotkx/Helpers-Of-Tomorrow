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
            return {}

        # Create DataFrame with required features
        df = pd.DataFrame(seniors)
        features = ['age', 'physical', 'mental', 'dl_intervention', 'rece_gov_sup', 
                   'community', 'making_ends_meet', 'living_situation']
        X = df[features]

        # Get predictions
        predictions = model.predict(X)

        changes = {}
        # Update wellbeing scores in database
        for i, senior in enumerate(seniors):
            try:
                # get old wellbeing
                old_row = supabase.table("seniors") \
                    .select("overall_wellbeing") \
                    .eq("uid", senior["uid"]) \
                    .single() \
                    .execute()
                if (old_row.data is None) or (len(old_row.data) == 0):
                    old_value = None
                else:
                    old_value = old_row.data["overall_wellbeing"]

                (supabase.table("seniors")
                .update({"overall_wellbeing": int(predictions[i])})
                .eq("uid", senior['uid'])
                .execute())

                new_row = supabase.table("seniors") \
                  .select("name, uid, overall_wellbeing") \
                  .eq("uid", senior['uid']) \
                  .single() \
                  .execute()
                new_value = new_row.data["overall_wellbeing"]
                name = new_row.data["name"]

                if old_value != new_value:
                    changes[name] = [old_value, new_value, new_row.data["uid"]]

            except Exception as e:
                logger.error(f"Failed to update wellbeing for senior {senior['uid']}: {str(e)}")

        logger.info(f"Wellbeing updates completed. Total changes: {len(changes)}")
        return changes

    except Exception as e:
        logger.error(f"Error in classify_seniors: {str(e)}", exc_info=True)
        return {}