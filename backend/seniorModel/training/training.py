import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split, cross_val_score, GridSearchCV
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import shap
import joblib
import os

def analyze_dataset(df):
    """
    Analyze dataset to understand data types and potential issues
    """
    print("=== DATASET ANALYSIS ===")
    print(f"Dataset shape: {df.shape}")
    print(f"\nColumn info:")
    
    for col in df.columns:
        print(f"\n{col}:")
        print(f"  Type: {df[col].dtype}")
        print(f"  Missing values: {df[col].isnull().sum()}")
        print(f"  Unique values: {df[col].nunique()}")
        
        if df[col].dtype == 'object':
            print(f"  Sample values: {df[col].dropna().unique()[:10]}")
        else:
            print(f"  Range: {df[col].min():.2f} to {df[col].max():.2f}")
            print(f"  Mean: {df[col].mean():.2f}")
    
    print(f"\nTarget variable distribution:")
    if 'overall_wellbeing' in df.columns:
        print(df['overall_wellbeing'].value_counts())
        print()
    return df

def load_and_prepare_data(file_path=None):
    """
    Load and prepare your dataset.
    Replace the sample data creation with your actual data loading.
    """
    if file_path:
        # Load your actual dataset
        df = pd.read_csv(file_path)

        # Analyze the loaded dataset
        df = analyze_dataset(df)
        
    else:
        print("No file path found.")
        return None

    print(f"Dataset shape: {df.shape}")
    print(f"Target distribution:\n{df['overall_wellbeing'].value_counts()}")
    
    return df

class SeniorRiskAssessment:
    def __init__(self):
        self.model = None
        self.label_encoder = LabelEncoder()
        self.feature_encoders = {}  # Store encoders for categorical features
        self.feature_names = None
        self.explainer = None

        
    def prepare_features(self, df):
        """Prepare features for training"""
        # Separate features and target
        feature_cols = [col for col in df.columns if col != 'overall_wellbeing']
        X = df[feature_cols].copy()
        y = df['overall_wellbeing'].copy()
        
        # Store feature names
        self.feature_names = list(X.columns)
        
        # Encode target variable (Low=0, Medium=1, High=2 for risk priority)
        # y_encoded = self.label_encoder.fit_transform(y)

        # encoding target value (overall_wellbeing)
        low_high_mapping = {'Low': 0, 'Medium': 1, 'High': 2}
        y_encoded = y.map(low_high_mapping).values

        # encoding categorical variables (features)
        yes_mapping = {'Yes': 1, 'No': 0}
        meeting_ends_mapping = {'Struggling': 0, 'Manageable': 1, 'Comfortable': 2}
        living_situation_mapping = {'Alone': 0, 'With Spouse': 1, 'With Family': 2, 'Assisted Living': 3}
        for col in X.select_dtypes(include=['object']).columns:
            if col == 'making_ends_meet':
                X[col] = X[col].map(meeting_ends_mapping)
            elif col == 'living_situation':
                X[col] = X[col].map(living_situation_mapping)
            elif col == 'community':
                X[col] = X[col].map(low_high_mapping)
            elif col == "dl_intervention" or col == 'rece_gov_sup':
                X[col] = X[col].map(yes_mapping)
            else:
                continue

        print("Feature columns:", self.feature_names)

        return X, y_encoded
    
    def train_model(self, X, y, test_size=0.2, random_state=42):
        """Train the Random Forest model with hyperparameter tuning"""
        # Split the data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=test_size, random_state=random_state, stratify=y
        )
        
        print(f"Training set size: {X_train.shape}")
        print(f"Test set size: {X_test.shape}")
        
        # Hyperparameter tuning
        param_grid = {
            'n_estimators': [100, 200, 300],
            'max_depth': [None, 10, 20, 30],
            'min_samples_split': [2, 5, 10],
            'min_samples_leaf': [1, 2, 4]
        }
        
        rf = RandomForestClassifier(random_state=random_state)
        
        # Grid search with cross-validation
        print("Performing hyperparameter tuning...")
        grid_search = GridSearchCV(rf, param_grid, cv=5, scoring='accuracy', n_jobs=-1)
        grid_search.fit(X_train, y_train)
        
        # Use best model
        self.model = grid_search.best_estimator_
        print(f"Best parameters: {grid_search.best_params_}")
        
        # Evaluate model
        train_score = self.model.score(X_train, y_train)
        test_score = self.model.score(X_test, y_test)
        
        print(f"Training accuracy: {train_score:.4f}")
        print(f"Test accuracy: {test_score:.4f}")
        
        # Cross-validation
        cv_scores = cross_val_score(self.model, X_train, y_train, cv=5)
        print(f"Cross-validation accuracy: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
        
        # Detailed evaluation
        y_pred = self.model.predict(X_test)
        print("\nClassification Report:")
        print(classification_report(y_test, y_pred, target_names=['Low', 'Medium', 'High']))
        
        return X_train, X_test, y_train, y_test
    
    def setup_explainer(self, X_train):
        """Setup SHAP explainer"""
        print("Setting up SHAP explainer...")
        self.explainer = shap.TreeExplainer(self.model)
        self.shap_values = self.explainer.shap_values(X_train)
        print("SHAP explainer ready!")
    
    def explain_prediction(self, sample_data, return_explanation=False):
        """
        Explain a single prediction with SHAP values
        """
        # Handle different input types
        if isinstance(sample_data, pd.Series):
            sample_df = sample_data.to_frame().T
        elif isinstance(sample_data, pd.DataFrame):
            sample_df = sample_data.copy()
        elif isinstance(sample_data, dict):
            sample_df = pd.DataFrame([sample_data])
        else:
            # Assume it's a numpy array or list
            sample_df = pd.DataFrame([sample_data], columns=self.feature_names)
        
        # Apply the same preprocessing as training
        sample_processed = self._preprocess_input(sample_df)
        
        # Get prediction
        prediction = self.model.predict(sample_processed)[0]
        # print("Raw prediction:", prediction)
        prediction_proba = self.model.predict_proba(sample_processed)[0]
        class_mapping = {0: "Low", 1: "Medium", 2: "High"}
        predicted_class = class_mapping[prediction]
        # predicted_class = self.label_encoder.inverse_transform([prediction])[0]
        
        # Get SHAP values
        shap_values = self.explainer.shap_values(sample_processed)[0]
        print("shap_values:", shap_values)
        # print(shap_values[0].shape)  # Should be (1, num_features)

        # Create explanation
        class_names = ["Low", "Medium", "High"]
        explanation = {
            'predicted_class': predicted_class,
            'prediction_confidence': {
                class_name: prob for class_name, prob in
                zip(class_names, prediction_proba)
            },
            'risk_level': 'High Risk' if predicted_class == 'Low' else 
                         'Medium Risk' if predicted_class == 'Medium' else 'Low Risk',
            'feature_importance': {}
        }
        
        # Get feature contributions for the predicted class
        
        for i, feature in enumerate(self.feature_names):
            explanation['feature_importance'][feature] = {
                'value': float(sample_processed.iloc[0, i]),
                'shap_value': float(shap_values[i][prediction]),
                'impact': 'Decrease Risk' if shap_values[i][prediction] > 0 else 'Increase Risk'
            }
        print("Explanation: ", explanation)
        # Sort by absolute SHAP value
        explanation['pos_factors'] = sorted(
            explanation['feature_importance'].items(),
            key=lambda x: x[1]['shap_value'],
            reverse=True
        )[:5]

        explanation['neg_factors'] = sorted(
            explanation['feature_importance'].items(),
            key=lambda x: x[1]['shap_value'],
            reverse=False
        )[:5]

        print("Top Risk Factors: ", explanation['pos_factors'])

        if return_explanation:
            return explanation
        else:
            self._print_explanation(explanation, sample_processed)
    
    def _preprocess_input(self, sample_df):
        """Apply the same preprocessing used during training"""
        processed_df = sample_df.copy()
        #print("Before processing\n")
        #print(processed_df)

        low_high_mapping = {'Low': 0, 'Medium': 1, 'High': 2}

        # encoding categorical variables (features)
        yes_mapping = {'Yes': 1, 'No': 0}
        meeting_ends_mapping = {'Struggling': 0, 'Manageable': 1, 'Comfortable': 2}
        living_situation_mapping = {'Alone': 0, 'With Spouse': 1, 'With Family': 2, 'Assisted Living': 3}
        for col in processed_df.select_dtypes(include=['object']).columns:
            if col == 'making_ends_meet':
                processed_df[col] = processed_df[col].map(meeting_ends_mapping)
            elif col == 'living_situation':
                processed_df[col] = processed_df[col].map(living_situation_mapping)
            elif col == 'community':
                processed_df[col] = processed_df[col].map(low_high_mapping)
            elif col == "dl_intervention" or col == 'rece_gov_sup':
                processed_df[col] = processed_df[col].map(yes_mapping)
            else:
                continue
        # Select and order features correctly
        processed_df = processed_df[self.feature_names]

        #print("\nAfter processing\n")
        #print(processed_df)
        return processed_df
    
    def _print_explanation(self, explanation, sample_data):
        """Print human-readable explanation"""
        print(f"\n{'='*50}")
        print(f"SENIOR RISK ASSESSMENT EXPLANATION")
        print(f"{'='*50}")
        
        print(f"Predicted Well-being Level: {explanation['predicted_class']}")
        print(f"Risk Classification: {explanation['risk_level']}")
        
        print(f"\nPrediction Confidence:")
        for class_name, prob in explanation['prediction_confidence'].items():
            print(f"  {class_name}: {prob:.2%}")
        
        print(f"\nTop 5 Positive Factors:")
        for i, (feature, info) in enumerate(explanation['pos_factors'], 1):
            impact_symbol = "↑" if info['impact'] == 'Increase Risk' else "↓"
            print(f"  {i}. {feature}: {info['value']:.2f} {impact_symbol}")
            print(f"     Impact: {info['impact']} (SHAP: {info['shap_value']:.3f})\n")

        print(f"\nTop 5 Negative Factors:")
        for i, (feature, info) in enumerate(explanation['neg_factors'], 1):
            impact_symbol = "↑" if info['impact'] == 'Increase Risk' else "↓"
            print(f"  {i}. {feature}: {info['value']:.2f} {impact_symbol}")
            print(f"     Impact: {info['impact']} (SHAP: {info['shap_value']:.3f})\n")

    def save_model(self, filepath):
        """Save the trained model"""
        model_data = {
            'model': self.model,
            'label_encoder': self.label_encoder,
            'feature_names': self.feature_names,
            'explainer': self.explainer
        }
        joblib.dump(model_data, filepath)
        print(f"Model saved to {filepath}")
    
    def load_model(self, filepath):
        """Load a saved model"""
        model_data = joblib.load(filepath)
        self.model = model_data['model']
        self.label_encoder = model_data['label_encoder']
        self.feature_names = model_data['feature_names']
        self.explainer = model_data['explainer']
        print(f"Model loaded from {filepath}")

def main():
    """Main function demonstrating the complete workflow"""
    
    print("=== SENIOR RISK ASSESSMENT MODEL TUTORIAL ===\n")
    
    # 1. Load and prepare data
    print("1. Loading and preparing data...")
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    data_dir = os.path.join(parent_dir, 'data')
    df = load_and_prepare_data(os.path.join(data_dir, 'v3_seniors_wellbeing_dataset.csv'))  # Replace with your actual data file

    # 2. Initialize and train model
    print("\n2. Training Random Forest model...")
    risk_model = SeniorRiskAssessment()
    X, y = risk_model.prepare_features(df)
    X_train, X_test, y_train, y_test = risk_model.train_model(X, y)
    
    # 3. Setup SHAP explainer
    print("\n3. Setting up SHAP explainer...")
    risk_model.setup_explainer(X_train)
    
    # 4. Test individual prediction with explanation
    print("\n4. Testing individual prediction...")
    # sample_senior = X_test.iloc[0]  # Take first test sample
    # risk_model.explain_prediction(sample_senior)

    # Get original data row instead of processed data
    sample_senior_idx = X_test.index[0]
    # print("sample senior idx: ", sample_senior_idx)

    sample_senior_original = df.loc[sample_senior_idx]
    # print("sample senior original:\n", sample_senior_original)

    # Remove target column and use original features
    feature_cols = [col for col in df.columns if col != 'overall_wellbeing']
    sample_features = sample_senior_original[feature_cols]
    # print("sample features:\n", sample_features)

    # This will now work with the updated explain_prediction method
    risk_model.explain_prediction(sample_features)
    'Alone' 'With Family' 'Assisted Living' 'With Spouse'
    # 5. Save model for production use
    print("\n5. Saving model...")
    risk_model.save_model('senior_risk_model.pkl')
    
    # # 6. Demonstrate API usage
    # print("\n6. Demonstrating API usage for backend integration...")
    # api = SeniorRiskAPI('senior_risk_model.pkl')
    
    # # Example API call
    # senior_input = {
    #     'age': 78,
    #     'mobility_score': 3.5,
    #     'social_connections': 1,
    #     'medical_visits_per_month': 4,
    #     'medication_count': 6,
    #     'cognitive_assessment': 18.5,
    #     'independence_level': 2.1,
    #     'chronic_conditions': 3,
    #     'family_support': 2.2,
    #     'financial_stress': 4.1,
    #     'physical_activity_hours': 1.2,
    #     'sleep_quality': 2.8
    # }
    
    # result = api.predict_risk(senior_input)
    # print(f"\nAPI Response for sample senior:")
    # print(f"Risk Level: {result['risk_level']}")
    # print(f"Predicted Class: {result['predicted_class']}")
    # print(f"Confidence: {max(result['prediction_confidence'].values()):.2%}")

if __name__ == "__main__":
    main()