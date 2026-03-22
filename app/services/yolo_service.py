import numpy as np
import cv2
import threading
import warnings
import os

warnings.filterwarnings("ignore", category=FutureWarning, message=".*torch.cuda.amp.autocast.*")

_MODEL = None
_MODEL_LOCK = threading.Lock()

def get_model():
    global _MODEL
    if _MODEL is None:
        with _MODEL_LOCK:
            if _MODEL is None:
                from ultralytics import YOLO
                model_path = 'yolov5s.pt'
                if not os.path.exists(model_path):
                    model_path = os.path.join(os.path.dirname(__file__), '..', 'yolov5s.pt')
                _MODEL = YOLO(model_path)
    return _MODEL

class YoloService:
    @staticmethod
    def identify(images, classes):
        model = get_model()
        results = model(images, verbose=False)

        if not results:
            return 0

        r = results[0]
        detected_classes = r.boxes.cls.cpu().numpy()

        count = 0
        if classes is not None and len(classes) > 0:
            for cls_id in detected_classes:
                if int(cls_id) in classes:
                    count += 1
        else:
            count = len(detected_classes)

        return count