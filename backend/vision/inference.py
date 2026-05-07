import random
from pathlib import Path

import numpy as np
from PIL import Image

BASE_DIR = Path(__file__).resolve().parent.parent
MODEL_PATH = BASE_DIR / 'vision' / 'ml' / 'model.h5'

CLASS_LABELS = ['early_blight', 'healthy', 'late_blight']

RECOMMENDATIONS = {
    'healthy': (
        'Your potato crop looks healthy. Continue current '
        'care routine. Monitor regularly for any changes.'
    ),
    'early_blight': (
        'Early Blight (Alternaria solani) detected. '
        'Remove affected leaves immediately. Apply mancozeb '
        'or chlorothalonil fungicide. Avoid overhead irrigation. '
        'Ensure good air circulation between plants.'
    ),
    'late_blight': (
        'Late Blight (Phytophthora infestans) detected. '
        'This is a serious threat — act immediately. '
        'Apply metalaxyl or cymoxanil fungicide. '
        'Remove and destroy all infected plant material. '
        'Do not compost infected material. '
        'Isolate affected area and monitor neighbouring plants daily.'
    ),
    'unknown': (
        'Unable to determine disease status from this image. '
        'Please take a clearer photo of the affected leaf '
        'in good lighting, or consult an agronomist.'
    ),
}

_MOCK_LABELS = ['healthy', 'late_blight', 'early_blight']
_MOCK_WEIGHTS = [0.60, 0.25, 0.15]


class PotatoDiseaseClassifier:

    def __init__(self):
        if MODEL_PATH.exists():
            try:
                from tensorflow.keras.models import load_model
                self.model = load_model(str(MODEL_PATH))
                self.mode = 'real'
                print("Vision model loaded — real inference mode")
            except Exception as e:
                print(f"Failed to load model ({e}) — falling back to mock mode")
                self.model = None
                self.mode = 'mock'
        else:
            self.model = None
            self.mode = 'mock'
            print("No model file found — running in mock mode")

    def preprocess_image(self, image_path):
        img = Image.open(image_path).convert('RGB').resize((224, 224))
        arr = np.array(img, dtype=np.float32) / 255.0
        return np.expand_dims(arr, axis=0)

    def predict(self, image_path):
        try:
            if self.mode == 'mock':
                diagnosis = random.choices(_MOCK_LABELS, weights=_MOCK_WEIGHTS, k=1)[0]
                confidence = round(random.uniform(0.75, 0.97), 4)
                return {
                    'diagnosis': diagnosis,
                    'confidence': confidence,
                    'recommendation': RECOMMENDATIONS[diagnosis],
                    'model_version': 'mock_v1',
                }

            preprocessed = self.preprocess_image(image_path)
            predictions = self.model.predict(preprocessed, verbose=0)
            class_idx = int(predictions.argmax())
            confidence = float(predictions.max())
            diagnosis = CLASS_LABELS[class_idx]
            return {
                'diagnosis': diagnosis,
                'confidence': round(confidence, 4),
                'recommendation': RECOMMENDATIONS.get(diagnosis, RECOMMENDATIONS['unknown']),
                'model_version': 'mobilenetv3_v1',
            }

        except Exception as e:
            print(f"[Vision] Inference error: {e}")
            return {
                'diagnosis': 'unknown',
                'confidence': 0.0,
                'recommendation': RECOMMENDATIONS['unknown'],
                'model_version': self.mode + '_error',
            }
