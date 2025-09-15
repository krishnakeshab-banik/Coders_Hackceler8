"""
YOLOv8 Model Utilities and Detection Engine for AI Crowd Detection
Handles model loading, inference, and person detection
"""

import torch
import cv2
import numpy as np
import logging
import time
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Union
from ultralytics import YOLO
from config import config


class YOLOv8Detector:
    """YOLOv8-based person detection engine"""
    
    def __init__(self, model_path: Optional[str] = None, device: Optional[str] = None):
        """
        Initialize YOLOv8 detector
        
        Args:
            model_path: Path to YOLOv8 model file
            device: Device to run inference on ('cuda', 'cpu', or 'auto')
        """
        self.model_path = model_path or config.get('model.model_path', 'yolov8n.pt')
        
        # Model and performance settings
        self.model = None
        self.half_precision = config.get('performance.half_precision', False)
        
        # Person class ID in COCO dataset (YOLOv8 default)
        self.person_class_id = 0
        
        # Statistics
        self.inference_times = []
        self.total_detections = 0
        
        # Setup logging first
        self._setup_logging()
        
        # Then setup device and other configurations
        self.device = self._setup_device(device or config.get('model.device', 'auto'))
        self.confidence_threshold = config.get('model.confidence_threshold', 0.5)
        self.input_size = config.get('model.input_size', 640)
        self.max_det = config.get('model.max_det', 300)
        
        self._load_model()
    
    def _setup_logging(self):
        """Setup logging for model utilities"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
    
    def _setup_device(self, device: str) -> str:
        """
        Setup and validate device for inference
        
        Args:
            device: Requested device
            
        Returns:
            Validated device string
        """
        if device == 'auto':
            if torch.cuda.is_available():
                device = 'cuda'
                self.logger.info(f"CUDA available, using GPU: {torch.cuda.get_device_name(0)}")
            else:
                device = 'cpu'
                self.logger.info("CUDA not available, using CPU")
        elif device == 'cuda':
            if not torch.cuda.is_available():
                self.logger.warning("CUDA requested but not available, falling back to CPU")
                device = 'cpu'
        
        return device
    
    def _load_model(self):
        """Load YOLOv8 model"""
        try:
            self.logger.info(f"Loading YOLOv8 model: {self.model_path}")
            
            # Load model
            self.model = YOLO(self.model_path)
            
            # Move to device
            self.model.to(self.device)
            
            # Enable half precision if requested and supported
            if self.half_precision and self.device == 'cuda':
                self.model.half()
                self.logger.info("Half precision enabled")
            
            self.logger.info(f"Model loaded successfully on {self.device}")
            
            # Warm up the model
            self._warmup_model()
            
        except Exception as e:
            self.logger.error(f"Error loading model: {e}")
            raise RuntimeError(f"Failed to load YOLOv8 model: {e}")
    
    def _warmup_model(self):
        """Warm up model with dummy input"""
        try:
            if self.model is None:
                self.logger.warning("Model not loaded, skipping warmup")
                return
                
            dummy_input = torch.randn(1, 3, self.input_size, self.input_size)
            if self.device == 'cuda':
                dummy_input = dummy_input.cuda()
            
            with torch.no_grad():
                _ = self.model(dummy_input, verbose=False)
            
            self.logger.info("Model warmup completed")
            
        except Exception as e:
            self.logger.warning(f"Model warmup failed: {e}")
    
    def detect_persons(self, frame: np.ndarray, return_crops: bool = False) -> Dict:
        """
        Detect persons in frame using YOLOv8
        
        Args:
            frame: Input frame (BGR format)
            return_crops: Whether to return cropped person images
            
        Returns:
            Dictionary with detection results
        """
        start_time = time.time()
        
        try:
            if self.model is None:
                self.logger.error("Model not loaded")
                return {
                    'boxes': [],
                    'scores': [],
                    'person_count': 0,
                    'inference_time': 0.0,
                    'avg_inference_time': 0.0,
                    'crops': [] if return_crops else None
                }
                
            # Run inference
            results = self.model(
                frame,
                conf=self.confidence_threshold,
                classes=[self.person_class_id],  # Only detect persons
                max_det=self.max_det,
                verbose=False
            )
            
            # Process results
            detections = self._process_results(results[0], frame, return_crops)
            
            # Update statistics
            inference_time = time.time() - start_time
            self.inference_times.append(inference_time)
            self.total_detections += len(detections['boxes'])
            
            # Keep only last 100 inference times for averaging
            if len(self.inference_times) > 100:
                self.inference_times = self.inference_times[-100:]
            
            detections['inference_time'] = inference_time
            detections['avg_inference_time'] = np.mean(self.inference_times)
            
            return detections
            
        except Exception as e:
            self.logger.error(f"Error during detection: {e}")
            return {
                'boxes': [],
                'scores': [],
                'person_count': 0,
                'inference_time': 0.0,
                'avg_inference_time': 0.0,
                'crops': [] if return_crops else None
            }
    
    def _process_results(self, result, frame: np.ndarray, return_crops: bool) -> Dict:
        """
        Process YOLOv8 detection results
        
        Args:
            result: YOLOv8 result object
            frame: Original frame
            return_crops: Whether to return person crops
            
        Returns:
            Processed detection data
        """
        boxes = []
        scores = []
        crops = [] if return_crops else None
        
        if result.boxes is not None and len(result.boxes) > 0:
            # Get bounding boxes and scores
            for box in result.boxes:
                # Extract box coordinates (xyxy format)
                x1, y1, x2, y2 = box.xyxy[0].cpu().numpy()
                confidence = box.conf[0].cpu().numpy()
                
                # Convert to integer coordinates
                x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
                
                # Ensure coordinates are within frame bounds
                h, w = frame.shape[:2]
                x1 = max(0, min(x1, w-1))
                y1 = max(0, min(y1, h-1))
                x2 = max(0, min(x2, w-1))
                y2 = max(0, min(y2, h-1))
                
                # Skip invalid boxes
                if x2 <= x1 or y2 <= y1:
                    continue
                
                boxes.append([x1, y1, x2, y2])
                scores.append(float(confidence))
                
                # Extract crop if requested
                if return_crops and crops is not None:
                    crop = frame[y1:y2, x1:x2]
                    crops.append(crop)
        
        return {
            'boxes': boxes,
            'scores': scores,
            'person_count': len(boxes),
            'crops': crops
        }
    
    def draw_detections(self, frame: np.ndarray, detections: Dict, 
                       draw_boxes: bool = True, draw_count: bool = True) -> np.ndarray:
        """
        Draw detection results on frame
        
        Args:
            frame: Input frame
            detections: Detection results from detect_persons
            draw_boxes: Whether to draw bounding boxes
            draw_count: Whether to draw person count
            
        Returns:
            Frame with annotations
        """
        annotated_frame = frame.copy()
        
        if draw_boxes:
            # Draw bounding boxes
            for i, (box, score) in enumerate(zip(detections['boxes'], detections['scores'])):
                x1, y1, x2, y2 = box
                
                # Choose color based on confidence
                if score > 0.8:
                    color = (0, 255, 0)  # Green for high confidence
                elif score > 0.6:
                    color = (0, 255, 255)  # Yellow for medium confidence
                else:
                    color = (0, 165, 255)  # Orange for low confidence
                
                # Draw rectangle
                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
                
                # Draw confidence score
                label = f"Person {score:.2f}"
                label_size = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)[0]
                cv2.rectangle(annotated_frame, (x1, y1 - label_size[1] - 10), 
                            (x1 + label_size[0], y1), color, -1)
                cv2.putText(annotated_frame, label, (x1, y1 - 5), 
                          cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        if draw_count:
            # Draw person count
            count_text = f"Person Count: {detections['person_count']}"
            cv2.putText(annotated_frame, count_text, (10, 30), 
                       cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            
            # Draw FPS info
            fps_text = f"FPS: {1.0/detections['inference_time']:.1f}"
            cv2.putText(annotated_frame, fps_text, (10, 70), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)
        
        return annotated_frame
    
    def get_model_info(self) -> Dict:
        """
        Get model information
        
        Returns:
            Dictionary with model details
        """
        return {
            'model_path': self.model_path,
            'device': self.device,
            'confidence_threshold': self.confidence_threshold,
            'input_size': self.input_size,
            'max_detections': self.max_det,
            'half_precision': self.half_precision,
            'total_detections': self.total_detections,
            'avg_inference_time': np.mean(self.inference_times) if self.inference_times else 0.0
        }
    
    def update_confidence_threshold(self, new_threshold: float):
        """
        Update confidence threshold
        
        Args:
            new_threshold: New confidence threshold (0-1)
        """
        if 0 <= new_threshold <= 1:
            self.confidence_threshold = new_threshold
            self.logger.info(f"Confidence threshold updated to {new_threshold}")
        else:
            self.logger.warning("Confidence threshold must be between 0 and 1")
    
    def benchmark_performance(self, frame: np.ndarray, num_runs: int = 100) -> Dict:
        """
        Benchmark model performance
        
        Args:
            frame: Test frame
            num_runs: Number of inference runs
            
        Returns:
            Performance statistics
        """
        self.logger.info(f"Benchmarking performance with {num_runs} runs...")
        
        times = []
        person_counts = []
        
        # Warm up
        for _ in range(10):
            _ = self.detect_persons(frame)
        
        # Benchmark
        start_total = time.time()
        for i in range(num_runs):
            start_time = time.time()
            result = self.detect_persons(frame)
            end_time = time.time()
            
            times.append(end_time - start_time)
            person_counts.append(result['person_count'])
            
            if (i + 1) % 20 == 0:
                self.logger.info(f"Completed {i + 1}/{num_runs} runs")
        
        total_time = time.time() - start_total
        
        stats = {
            'num_runs': num_runs,
            'total_time': total_time,
            'avg_inference_time': np.mean(times),
            'min_inference_time': np.min(times),
            'max_inference_time': np.max(times),
            'std_inference_time': np.std(times),
            'avg_fps': 1.0 / np.mean(times),
            'avg_person_count': np.mean(person_counts),
            'frame_shape': frame.shape
        }
        
        self.logger.info(f"Benchmark complete: Avg FPS = {stats['avg_fps']:.1f}")
        return stats


def test_detector():
    """Test function for YOLOv8 detector"""
    print("Testing YOLOv8 Detector...")
    
    try:
        # Initialize detector
        detector = YOLOv8Detector()
        
        # Create a test frame
        test_frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        
        # Test detection
        detections = detector.detect_persons(test_frame)
        print(f"Detection results: {detections}")
        
        # Test drawing
        annotated = detector.draw_detections(test_frame, detections)
        print(f"Annotated frame shape: {annotated.shape}")
        
        # Get model info
        info = detector.get_model_info()
        print(f"Model info: {info}")
        
        print("YOLOv8 Detector test completed successfully!")
        
    except Exception as e:
        print(f"Error testing detector: {e}")


if __name__ == "__main__":
    test_detector()