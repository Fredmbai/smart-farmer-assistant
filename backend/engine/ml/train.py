"""
Potato health XGBoost training script.
Run from project root: python engine/ml/train.py
"""
import os
import sys

import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
from xgboost import XGBClassifier

# Resolve paths relative to this file so the script works from any cwd
ML_DIR = os.path.dirname(os.path.abspath(__file__))

FEATURE_NAMES = [
    'moisture', 'ph', 'temperature', 'humidity',
    'npk_n', 'npk_p', 'npk_k',
    'rainfall_probability_48h', 'rainfall_mm_expected',
    'frost_probability', 'growth_stage_encoded',
    'days_since_planting', 'market_price_trend_encoded',
]

N_SAMPLES = 3000
np.random.seed(42)


def generate_data():
    rng = np.random
    moisture       = rng.uniform(0, 100, N_SAMPLES)
    ph             = rng.uniform(4.0, 9.0, N_SAMPLES)
    temperature    = rng.uniform(5, 35, N_SAMPLES)
    humidity       = rng.uniform(30, 100, N_SAMPLES)
    npk_n          = rng.uniform(0, 140, N_SAMPLES)
    npk_p          = rng.uniform(0, 80, N_SAMPLES)
    npk_k          = rng.uniform(0, 100, N_SAMPLES)
    rain_prob_48h  = rng.uniform(0, 1, N_SAMPLES)
    rain_mm        = rng.uniform(0, 50, N_SAMPLES)
    frost_prob     = rng.uniform(0, 1, N_SAMPLES)
    growth_enc     = rng.randint(0, 5, N_SAMPLES)
    days_planted   = rng.uniform(0, 150, N_SAMPLES)
    market_enc     = rng.randint(0, 3, N_SAMPLES)

    labels = []
    for i in range(N_SAMPLES):
        if moisture[i] < 15 and rain_prob_48h[i] < 0.5:
            label = 'irrigate_now'
        elif moisture[i] < 15 and rain_prob_48h[i] >= 0.7:
            label = 'partial_irrigate'
        elif frost_prob[i] >= 1.0 or temperature[i] <= 2:
            label = 'frost_protection'
        elif temperature[i] <= 18 and humidity[i] >= 80:
            label = 'apply_fungicide'
        elif ph[i] < 5.0:
            label = 'apply_lime'
        elif ph[i] > 7.0:
            label = 'apply_sulfur'
        elif moisture[i] < 25:
            label = 'irrigate_soon'
        elif npk_n[i] < 40:
            label = 'apply_nitrogen'
        elif npk_p[i] < 20:
            label = 'apply_phosphorus'
        elif npk_k[i] < 30:
            label = 'apply_potassium'
        elif growth_enc[i] >= 3 and market_enc[i] == 2:
            label = 'harvest_soon'
        else:
            label = 'no_action'
        labels.append(label)

    df = pd.DataFrame({
        'moisture': moisture, 'ph': ph, 'temperature': temperature,
        'humidity': humidity, 'npk_n': npk_n, 'npk_p': npk_p,
        'npk_k': npk_k, 'rainfall_probability_48h': rain_prob_48h,
        'rainfall_mm_expected': rain_mm, 'frost_probability': frost_prob,
        'growth_stage_encoded': growth_enc,
        'days_since_planting': days_planted,
        'market_price_trend_encoded': market_enc,
        'label': labels,
    })
    return df


def train():
    print("Generating synthetic potato training data...")
    df = generate_data()
    print(f"  {len(df)} samples | {df['label'].nunique()} classes")
    print(df['label'].value_counts().to_string())

    X = df[FEATURE_NAMES]
    y_raw = df['label']

    le = LabelEncoder()
    y = le.fit_transform(y_raw)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print("\nTraining XGBClassifier...")
    model = XGBClassifier(
        n_estimators=200,
        max_depth=6,
        learning_rate=0.1,
        eval_metric='mlogloss',
        use_label_encoder=False,
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"\nAccuracy: {acc:.4f}")
    print("\nClassification Report:")
    print(classification_report(y_test, y_pred, target_names=le.classes_))

    model_path = os.path.join(ML_DIR, 'xgboost_potato.pkl')
    le_path    = os.path.join(ML_DIR, 'label_encoder.pkl')
    fn_path    = os.path.join(ML_DIR, 'feature_names.pkl')

    joblib.dump(model, model_path)
    joblib.dump(le, le_path)
    joblib.dump(FEATURE_NAMES, fn_path)

    print(f"\nSaved model       → {model_path}")
    print(f"Saved encoder     → {le_path}")
    print(f"Saved feature list → {fn_path}")
    return acc


if __name__ == '__main__':
    # Make sure we can import project packages if needed
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if project_root not in sys.path:
        sys.path.insert(0, project_root)
    train()
