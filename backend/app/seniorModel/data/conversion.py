# encoding the data 
import pandas as pd
import os

def main(file):
        """Prepare features for training"""
        df = pd.read_csv(file)
        print(df.head())
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

        low_high_mapping = {'Low': 0, 'Moderate': 1, 'High': 2}
        yes_mapping = {'Yes': 1, 'No': 0}
        meeting_ends_mapping = {'Struggling': 0, 'Adequate': 1, 'Comfortable': 2}
        living_situation_mapping = {'Alone': 0, 'With Spouse': 1, 'With Family': 2, 'Assisted Living': 3}

        for col in df.select_dtypes(include=['object']).columns:
            if col == 'Making Ends Meet':
                df[col] = df[col].map(meeting_ends_mapping)
            elif col == 'Living Situation':
                df[col] = df[col].map(living_situation_mapping)
            elif col == 'Community Engagement':
                df[col] = df[col].map(low_high_mapping)
            elif col == "Previous District Leader's Intervention" or col == 'Received Government Support':
                df[col] = df[col].map(yes_mapping)
            else:
                continue

        print("Feature columns:", df.head())
        return df

if __name__ == "__main__":
    current_dir = os.path.dirname(os.path.abspath(__file__))
    df = main(os.path.join(current_dir, 'senior_mock.csv'))
    df.to_csv(os.path.join(current_dir, 'senior_mock_converted.csv'), index=False)