"""
Smart Farmer — XGBoost v2 training script.
Combines real Kaggle crop data (potato rows) with variety-aware synthetic
data for 5 Kenyan potato varieties.

Run from backend/ directory:
    python engine/ml/train_v2.py
"""
import os, sys
import joblib
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.metrics import accuracy_score, classification_report
from xgboost import XGBClassifier

ML_DIR      = os.path.dirname(os.path.abspath(__file__))
DATASET_DIR = os.path.join(os.path.dirname(os.path.dirname(ML_DIR)), 'ml', 'datasets')

FEATURE_NAMES = [
    'moisture', 'ph', 'temperature', 'humidity',
    'npk_n', 'npk_p', 'npk_k',
    'rainfall_probability_48h', 'rainfall_mm_expected',
    'frost_probability', 'growth_stage_encoded',
    'days_since_planting', 'market_price_trend_encoded',
    'variety_encoded',           # NEW in v2
]

# ── Variety profiles ──────────────────────────────────────────────────
VARIETY_PROFILES = {
    'shangi': {
        'maturity_days': 90,
        'moisture_optimal': (55, 75),
        'ph_optimal': (5.5, 6.5),
        'temp_optimal': (15, 20),
        'humidity_optimal': (60, 80),
        'npk_n_optimal': (80, 120),
        'npk_p_optimal': (40, 60),
        'npk_k_optimal': (60, 80),
        'late_blight_susceptibility': 'high',
        'drought_tolerance': 'low',
        'variety_encoded': 0,
    },
    'dutch_robijn': {
        'maturity_days': 105,
        'moisture_optimal': (60, 80),
        'ph_optimal': (5.5, 6.5),
        'temp_optimal': (14, 19),
        'humidity_optimal': (65, 80),
        'npk_n_optimal': (70, 100),
        'npk_p_optimal': (50, 70),
        'npk_k_optimal': (80, 110),
        'late_blight_susceptibility': 'low',
        'drought_tolerance': 'medium',
        'variety_encoded': 1,
    },
    'markies': {
        'maturity_days': 115,
        'moisture_optimal': (60, 80),
        'ph_optimal': (5.5, 6.5),
        'temp_optimal': (14, 20),
        'humidity_optimal': (65, 85),
        'npk_n_optimal': (90, 130),
        'npk_p_optimal': (45, 65),
        'npk_k_optimal': (70, 100),
        'late_blight_susceptibility': 'medium',
        'drought_tolerance': 'medium',
        'variety_encoded': 2,
    },
    'kenya_mpya': {
        'maturity_days': 105,
        'moisture_optimal': (55, 75),
        'ph_optimal': (5.5, 7.0),
        'temp_optimal': (15, 22),
        'humidity_optimal': (60, 80),
        'npk_n_optimal': (75, 110),
        'npk_p_optimal': (40, 60),
        'npk_k_optimal': (65, 85),
        'late_blight_susceptibility': 'very_low',
        'drought_tolerance': 'high',
        'variety_encoded': 3,
    },
    'tigoni': {
        'maturity_days': 105,
        'moisture_optimal': (60, 80),
        'ph_optimal': (5.5, 6.5),
        'temp_optimal': (14, 19),
        'humidity_optimal': (65, 80),
        'npk_n_optimal': (80, 110),
        'npk_p_optimal': (45, 65),
        'npk_k_optimal': (75, 100),
        'late_blight_susceptibility': 'medium',
        'drought_tolerance': 'low',
        'variety_encoded': 4,
    },
}

VARIETY_ENCODER = {name: p['variety_encoded'] for name, p in VARIETY_PROFILES.items()}
SAMPLES_PER_VARIETY = 2000
np.random.seed(42)


# ── Helpers ───────────────────────────────────────────────────────────

def biased(n, lo, hi, opt_lo, opt_hi, p_opt=0.7):
    """n samples; p_opt fraction within [opt_lo, opt_hi], rest in [lo, hi]."""
    n_opt  = int(n * p_opt)
    n_rest = n - n_opt
    in_range  = np.random.uniform(max(lo, opt_lo), min(hi, opt_hi), n_opt)
    out_range = np.random.uniform(lo, hi, n_rest)
    arr = np.concatenate([in_range, out_range])
    np.random.shuffle(arr)
    return arr


def assign_label(row, profile):
    """Assign a recommendation label using variety-aware priority rules."""
    frost     = row['frost_probability']
    temp      = row['temperature']
    moisture  = row['moisture']
    rain_48h  = row['rainfall_probability_48h']
    hum       = row['humidity']
    ph        = row['ph']
    n, p, k   = row['npk_n'], row['npk_p'], row['npk_k']
    g_enc     = row['growth_stage_encoded']
    days      = row['days_since_planting']
    market    = row['market_price_trend_encoded']
    susc      = profile['late_blight_susceptibility']

    # 1. Frost
    if frost >= 0.8 or temp <= 2:
        return 'frost_protection'

    # 2-3. Critical moisture
    if moisture < 15 and rain_48h < 0.5:
        return 'irrigate_now'
    if moisture < 15 and rain_48h >= 0.7:
        return 'partial_irrigate'

    # 4. Late blight (variety-aware thresholds)
    if temp <= 18 and hum >= 80:
        if susc == 'high':                             # shangi — most sensitive
            return 'apply_fungicide'
        elif susc in ('medium', 'low') and hum >= 85:  # markies / dutch_robijn / tigoni
            return 'apply_fungicide'
        elif susc == 'very_low':                       # kenya_mpya — resistant
            return 'monitor_blight'

    # 5-6. pH
    if ph < 5.0:
        return 'apply_lime'
    if ph > 7.5:
        return 'apply_sulfur'

    # 7. Moisture warning
    if moisture < 25:
        return 'irrigate_soon'

    # 8-10. Nutrient deficiency (variety-specific thresholds)
    n_thresh = profile['npk_n_optimal'][0] * 0.5
    p_thresh = profile['npk_p_optimal'][0] * 0.5
    k_thresh = profile['npk_k_optimal'][0] * 0.5

    if n < n_thresh:
        return 'apply_nitrogen'
    if p < p_thresh:
        return 'apply_phosphorus'
    if k < k_thresh:
        return 'apply_potassium'

    # 11. Harvest timing
    if (g_enc >= 3 and market == 2 and
            days >= profile['maturity_days'] * 0.85):
        return 'harvest_soon'

    return 'no_action'


# ── Step 1: Kaggle data ───────────────────────────────────────────────

def load_kaggle_data():
    csv_path = os.path.join(DATASET_DIR, 'Crop_recommendation.csv')
    if not os.path.exists(csv_path):
        print(f"WARNING: Dataset not found at {csv_path} — skipping real data.")
        return pd.DataFrame()

    df_raw = pd.read_csv(csv_path)
    potato_df = df_raw[df_raw['label'] == 'potato'].copy()

    if potato_df.empty:
        print("WARNING: No potato rows found in Kaggle dataset — using synthetic data only.")
        return pd.DataFrame()

    print(f"  Loaded {len(potato_df)} real potato rows from Kaggle dataset.")
    rows = []
    for _, r in potato_df.iterrows():
        rainfall = float(r['rainfall'])
        row = {
            'npk_n':                   float(r['N']),
            'npk_p':                   float(r['P']),
            'npk_k':                   float(r['K']),
            'temperature':             float(r['temperature']),
            'humidity':                float(r['humidity']),
            'ph':                      float(r['ph']),
            'rainfall_mm_expected':    min(rainfall / 10, 50),
            'rainfall_probability_48h': 0.4 if rainfall > 100 else 0.1,
            'moisture':                float(r['humidity']) * 0.7,
            'frost_probability':       1.0 if float(r['temperature']) < 5 else 0.0,
            'growth_stage_encoded':    np.random.randint(0, 5),
            'days_since_planting':     np.random.uniform(0, 120),
            'market_price_trend_encoded': np.random.randint(0, 3),
            'variety_encoded':         0,   # default shangi for Kaggle rows
        }
        # Use the same label logic for consistency
        profile = VARIETY_PROFILES['shangi']
        row['label'] = assign_label(row, profile)
        rows.append(row)

    return pd.DataFrame(rows)


# ── Step 2: Synthetic variety-aware data ─────────────────────────────

def generate_variety_data(variety_name, profile, n=SAMPLES_PER_VARIETY):
    high_alt = variety_name in ('tigoni', 'dutch_robijn')

    moisture  = biased(n, 0, 100,   *profile['moisture_optimal'])
    ph        = biased(n, 4.0, 9.0, *profile['ph_optimal'])
    temp      = biased(n, 5, 35,    *profile['temp_optimal'])
    humidity  = biased(n, 30, 100,  *profile['humidity_optimal'])
    npk_n     = biased(n, 0, 150,   *profile['npk_n_optimal'])
    npk_p     = biased(n, 0, 90,    *profile['npk_p_optimal'])
    npk_k     = biased(n, 0, 120,   *profile['npk_k_optimal'])
    rain_48h  = np.random.uniform(0, 1, n)
    rain_mm   = np.random.uniform(0, 50, n)

    # Higher-altitude varieties have greater frost probability
    if high_alt:
        frost_raw = np.random.uniform(0, 1, n)
        frost = np.where(np.random.random(n) < 0.4, frost_raw, 0.0)
    else:
        frost = np.where(np.random.random(n) < 0.3, np.random.uniform(0, 1, n), 0.0)

    growth_enc = np.random.randint(0, 5, n)
    days       = np.random.uniform(0, profile['maturity_days'] * 1.2, n)
    market_enc = np.random.randint(0, 3, n)
    var_enc    = np.full(n, profile['variety_encoded'], dtype=float)

    rows = []
    for i in range(n):
        row = {
            'moisture':                   float(moisture[i]),
            'ph':                         float(ph[i]),
            'temperature':                float(temp[i]),
            'humidity':                   float(humidity[i]),
            'npk_n':                      float(npk_n[i]),
            'npk_p':                      float(npk_p[i]),
            'npk_k':                      float(npk_k[i]),
            'rainfall_probability_48h':   float(rain_48h[i]),
            'rainfall_mm_expected':       float(rain_mm[i]),
            'frost_probability':          float(frost[i]),
            'growth_stage_encoded':       int(growth_enc[i]),
            'days_since_planting':        float(days[i]),
            'market_price_trend_encoded': int(market_enc[i]),
            'variety_encoded':            float(var_enc[i]),
        }
        row['label'] = assign_label(row, profile)
        rows.append(row)
    return pd.DataFrame(rows)


# ── Steps 3-5: Combine, train, save ──────────────────────────────────

def train():
    print("=" * 60)
    print("Smart Farmer XGBoost v2 — training")
    print("=" * 60)

    # Step 1
    print("\n[Step 1] Loading Kaggle data...")
    kaggle_df = load_kaggle_data()

    # Step 2
    print("\n[Step 2] Generating variety-aware synthetic data...")
    variety_dfs = []
    for name, profile in VARIETY_PROFILES.items():
        vdf = generate_variety_data(name, profile, SAMPLES_PER_VARIETY)
        print(f"  {name:15s} → {len(vdf):5d} samples  "
              f"| labels: {vdf['label'].nunique()}")
        variety_dfs.append(vdf)

    # Step 3: Combine
    all_dfs = [d for d in [kaggle_df] + variety_dfs if not d.empty]
    df = pd.concat(all_dfs, ignore_index=True)

    print("\n[Step 3] Dataset statistics:")
    print(f"  Total samples  : {len(df)}")
    print(f"  Total classes  : {df['label'].nunique()}")
    print("\n  Label distribution:")
    for label, cnt in df['label'].value_counts().items():
        pct = cnt / len(df) * 100
        print(f"    {label:30s} {cnt:5d}  ({pct:.1f}%)")

    # Check balance
    counts = df['label'].value_counts()
    ratio  = counts.max() / counts.min()
    if ratio > 5:
        print(f"\n  WARNING: Class imbalance ratio {ratio:.1f}x — consider resampling.")
    else:
        print(f"\n  Class balance ratio: {ratio:.1f}x (acceptable)")

    # Step 4: Train
    print("\n[Step 4] Training XGBClassifier (v2)...")
    X = df[FEATURE_NAMES]
    le = LabelEncoder()
    y  = le.fit_transform(df['label'])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = XGBClassifier(
        n_estimators=300,
        max_depth=7,
        learning_rate=0.08,
        min_child_weight=3,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric='mlogloss',
        random_state=42,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    acc    = accuracy_score(y_test, y_pred)

    print(f"\n  Accuracy: {acc:.4f}")
    print("\n  Classification report:")
    print(classification_report(y_test, y_pred, target_names=le.classes_))

    print("  Top 5 feature importances:")
    importances = pd.Series(model.feature_importances_, index=FEATURE_NAMES)
    for feat, imp in importances.nlargest(5).items():
        print(f"    {feat:35s} {imp:.4f}")

    # Step 5: Save
    print("\n[Step 5] Saving models...")
    paths = {
        'xgboost_potato_v2.pkl': model,
        'label_encoder_v2.pkl':  le,
        'feature_names_v2.pkl':  FEATURE_NAMES,
        'variety_encoder.pkl':   VARIETY_ENCODER,
    }
    for fname, obj in paths.items():
        path = os.path.join(ML_DIR, fname)
        joblib.dump(obj, path)
        print(f"  Saved → {path}")

    print(f"\n✅ Training complete. Accuracy: {acc:.4f}")
    print("   Variety encoder:", VARIETY_ENCODER)
    return acc


if __name__ == '__main__':
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    if root not in sys.path:
        sys.path.insert(0, root)
    train()
