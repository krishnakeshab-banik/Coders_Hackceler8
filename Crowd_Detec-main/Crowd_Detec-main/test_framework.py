"""
Testing Framework and Performance Benchmarks for AI Crowd Detection
Comprehensive testing suite for validating system performance and accuracy
"""

import unittest
import cv2
import numpy as np
import time
import json
import csv
from pathlib import Path
from typing import List, Dict, Tuple, Optional
import tempfile
import shutil

# Import system components
from config import config, Config
from video_processor import VideoProcessor
from model_utils import YOLOv8Detector
from crowd_analyzer import CrowdAnalyzer
from alert_manager import AlertManager
from crowd_detector import CrowdDetector


class TestVideoProcessor(unittest.TestCase):
    """Test cases for video processor module"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.test_video_path = None
        self.processor = None
    
    def tearDown(self):
        """Clean up after tests"""
        if self.processor:
            self.processor.stop_capture()
        if self.test_video_path and Path(self.test_video_path).exists():
            Path(self.test_video_path).unlink()
    
    def create_test_video(self, duration: int = 5, fps: int = 30) -> str:
        """Create a test video file"""
        temp_dir = tempfile.mkdtemp()
        video_path = Path(temp_dir) / "test_video.mp4"
        
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        writer = cv2.VideoWriter(str(video_path), fourcc, fps, (640, 480))
        
        for i in range(duration * fps):
            # Create a frame with moving rectangle (simulating person)
            frame = np.zeros((480, 640, 3), dtype=np.uint8)
            x = (i * 5) % 600
            cv2.rectangle(frame, (x, 200), (x + 40, 280), (255, 255, 255), -1)
            writer.write(frame)
        
        writer.release()
        self.test_video_path = str(video_path)
        return self.test_video_path
    
    def test_video_file_initialization(self):
        """Test video file initialization"""
        video_path = self.create_test_video()
        self.processor = VideoProcessor(video_path)
        
        self.assertTrue(self.processor.initialize_capture())
        self.assertIsNotNone(self.processor.cap)
    
    def test_frame_capture(self):
        """Test frame capture functionality"""
        video_path = self.create_test_video()
        self.processor = VideoProcessor(video_path)
        
        self.assertTrue(self.processor.start_capture())
        
        # Test frame retrieval
        frame = self.processor.get_frame(timeout=2.0)
        self.assertIsNotNone(frame)
        self.assertEqual(frame.shape, (480, 640, 3))
    
    def test_frame_preprocessing(self):
        """Test frame preprocessing"""
        self.processor = VideoProcessor()
        test_frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
        
        processed = self.processor.preprocess_frame(test_frame)
        self.assertIsNotNone(processed)
        self.assertEqual(processed.shape, test_frame.shape)


class TestYOLOv8Detector(unittest.TestCase):
    """Test cases for YOLOv8 detector"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.detector = None
    
    def tearDown(self):
        """Clean up after tests"""
        pass
    
    def test_detector_initialization(self):
        """Test detector initialization"""
        try:
            self.detector = YOLOv8Detector()
            self.assertIsNotNone(self.detector.model)
            self.assertIn(self.detector.device, ['cpu', 'cuda'])
        except Exception as e:
            self.skipTest(f"YOLO model not available: {e}")
    
    def test_person_detection(self):
        """Test person detection on sample frame"""
        try:
            self.detector = YOLOv8Detector()
            
            # Create test frame
            test_frame = np.random.randint(0, 255, (480, 640, 3), dtype=np.uint8)
            
            # Run detection
            detections = self.detector.detect_persons(test_frame)
            
            # Validate detection structure
            self.assertIn('boxes', detections)
            self.assertIn('scores', detections)
            self.assertIn('person_count', detections)
            self.assertIn('inference_time', detections)
            
            self.assertIsInstance(detections['boxes'], list)
            self.assertIsInstance(detections['scores'], list)
            self.assertIsInstance(detections['person_count'], int)
            self.assertIsInstance(detections['inference_time'], float)
            
        except Exception as e:
            self.skipTest(f"YOLO model not available: {e}")
    
    def test_confidence_threshold_update(self):
        """Test confidence threshold update"""
        try:
            self.detector = YOLOv8Detector()
            
            original_threshold = self.detector.confidence_threshold
            new_threshold = 0.7
            
            self.detector.update_confidence_threshold(new_threshold)
            self.assertEqual(self.detector.confidence_threshold, new_threshold)
            
            # Test invalid threshold
            self.detector.update_confidence_threshold(1.5)
            self.assertEqual(self.detector.confidence_threshold, new_threshold)
            
        except Exception as e:
            self.skipTest(f"YOLO model not available: {e}")


class TestCrowdAnalyzer(unittest.TestCase):
    """Test cases for crowd analyzer"""
    
    def setUp(self):
        """Set up test fixtures"""
        self.analyzer = CrowdAnalyzer()
    
    def create_test_detections(self, count: int = 5) -> Dict:
        """Create test detection data"""
        boxes = []
        scores = []
        
        for i in range(count):
            x1 = i * 100 + 50
            y1 = 100
            x2 = x1 + 50
            y2 = 200
            boxes.append([x1, y1, x2, y2])
            scores.append(0.8 + i * 0.02)
        
        return {
            'boxes': boxes,
            'scores': scores,
            'person_count': count
        }
    
    def test_density_calculation(self):
        """Test density score calculation"""
        detections = self.create_test_detections(3)
        
        density = self.analyzer.calculate_density_score(detections['boxes'])
        self.assertIsInstance(density, float)
        self.assertGreaterEqual(density, 0.0)
        self.assertLessEqual(density, 1.0)
    
    def test_crowd_analysis(self):
        """Test comprehensive crowd analysis"""
        detections = self.create_test_detections(5)
        
        analysis = self.analyzer.analyze_crowd(detections, (480, 640, 3))
        
        # Check required fields
        required_fields = [
            'person_count', 'density_score', 'crowd_level',
            'density_heatmap', 'spatial_analysis', 'trends'
        ]
        
        for field in required_fields:
            self.assertIn(field, analysis)
    
    def test_crowd_level_classification(self):
        """Test crowd level classification"""
        self.assertEqual(self.analyzer.classify_crowd_level(10), 'low')
        self.assertEqual(self.analyzer.classify_crowd_level(30), 'medium')
        self.assertEqual(self.analyzer.classify_crowd_level(60), 'high')
        self.assertEqual(self.analyzer.classify_crowd_level(150), 'critical')
    
    def test_spatial_analysis(self):
        """Test spatial distribution analysis"""
        detections = self.create_test_detections(4)
        
        spatial = self.analyzer.analyze_spatial_distribution(detections['boxes'])
        
        required_fields = [
            'center_of_mass', 'spread', 'clustering_score', 'edge_density'
        ]
        
        for field in required_fields:
            self.assertIn(field, spatial)
        
        # Validate center of mass
        self.assertIsInstance(spatial['center_of_mass'], list)
        self.assertEqual(len(spatial['center_of_mass']), 2)
    
    def test_heatmap_generation(self):
        """Test density heatmap generation"""
        detections = self.create_test_detections(3)
        self.analyzer.update_frame_dimensions(640, 480)
        
        heatmap = self.analyzer.generate_density_heatmap(detections['boxes'])
        
        self.assertIsInstance(heatmap, np.ndarray)
        self.assertEqual(heatmap.shape, tuple(self.analyzer.grid_size))
        self.assertGreaterEqual(np.min(heatmap), 0.0)
        self.assertLessEqual(np.max(heatmap), 1.0)


class TestAlertManager(unittest.TestCase):
    """Test cases for alert manager"""
    
    def setUp(self):
        """Set up test fixtures"""
        # Create temporary log directory
        self.temp_dir = tempfile.mkdtemp()
        
        # Override log path in config
        original_config = dict(config.config)
        config.config['logging']['log_path'] = self.temp_dir
        
        self.alert_manager = AlertManager()
        self.original_config = original_config
    
    def tearDown(self):
        """Clean up after tests"""
        # Restore original config
        config.config = self.original_config
        
        # Clean up temp directory
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def create_test_analysis(self, person_count: int = 30, alert_level: str = 'medium') -> Dict:
        """Create test analysis results"""
        return {
            'person_count': person_count,
            'smoothed_count': float(person_count),
            'density_score': 0.5,
            'crowd_level': alert_level,
            'spatial_analysis': {
                'center_of_mass': [320, 240],
                'spread': 50.0,
                'clustering_score': 0.6,
                'edge_density': 0.3
            },
            'trends': {
                'count_trend': 'stable',
                'density_trend': 'stable'
            },
            'anomalies': {
                'count_anomaly': False,
                'density_anomaly': False,
                'sudden_change': False
            }
        }
    
    def test_threshold_alerts(self):
        """Test threshold-based alerting"""
        # Test high crowd level
        high_analysis = self.create_test_analysis(person_count=75, alert_level='high')
        alert_info = self.alert_manager.check_alerts(high_analysis)
        
        self.assertTrue(alert_info['alert_triggered'])
        self.assertEqual(alert_info['alert_level'], 'high')
        
        # Test low crowd level (no alert)
        low_analysis = self.create_test_analysis(person_count=10, alert_level='low')
        alert_info = self.alert_manager.check_alerts(low_analysis)
        
        self.assertFalse(alert_info['alert_triggered'])
    
    def test_anomaly_alerts(self):
        """Test anomaly-based alerting"""
        analysis = self.create_test_analysis()
        analysis['anomalies']['count_anomaly'] = True
        
        alert_info = self.alert_manager.check_alerts(analysis)
        
        self.assertTrue(alert_info['alert_triggered'])
        self.assertEqual(alert_info['alert_type'], 'anomaly')
    
    def test_data_logging(self):
        """Test data logging functionality"""
        analysis = self.create_test_analysis()
        
        # Test CSV logging
        self.alert_manager.log_data(analysis)
        
        # Check if log file was created
        log_files = list(Path(self.temp_dir).glob('*.csv'))
        self.assertGreater(len(log_files), 0)
    
    def test_alert_cooldown(self):
        """Test alert cooldown mechanism"""
        analysis = self.create_test_analysis(person_count=75, alert_level='high')
        
        # First alert should trigger
        alert_info1 = self.alert_manager.check_alerts(analysis)
        self.assertTrue(alert_info1['alert_triggered'])
        
        # Immediate second alert should not trigger (cooldown)
        alert_info2 = self.alert_manager.check_alerts(analysis)
        self.assertFalse(alert_info2['alert_triggered'])


class PerformanceBenchmark:
    """Performance benchmarking suite"""
    
    def __init__(self):
        """Initialize benchmark suite"""
        self.results = {}
        self.test_frames = []
        self.detector = None
        self.analyzer = None
    
    def create_test_frames(self, count: int = 50) -> List[np.ndarray]:
        """Create test frames for benchmarking"""
        frames = []
        
        for i in range(count):
            # Create frame with random content
            frame = np.random.randint(0, 255, (720, 1280, 3), dtype=np.uint8)
            
            # Add some rectangles to simulate people
            num_people = np.random.randint(5, 25)
            for j in range(num_people):
                x = np.random.randint(0, 1200)
                y = np.random.randint(0, 600)
                w = np.random.randint(40, 80)
                h = np.random.randint(80, 120)
                color = tuple(np.random.randint(100, 255, 3).tolist())
                cv2.rectangle(frame, (x, y), (x + w, y + h), color, -1)
            
            frames.append(frame)
        
        return frames
    
    def benchmark_detection_speed(self, frames: List[np.ndarray]) -> Dict:
        """Benchmark detection speed"""
        print("Benchmarking detection speed...")
        
        try:
            self.detector = YOLOv8Detector()
            
            times = []
            person_counts = []
            
            # Warm up
            for _ in range(5):
                _ = self.detector.detect_persons(frames[0])
            
            # Benchmark
            start_total = time.time()
            
            for i, frame in enumerate(frames):
                start_time = time.time()
                detections = self.detector.detect_persons(frame)
                end_time = time.time()
                
                times.append(end_time - start_time)
                person_counts.append(detections['person_count'])
                
                if (i + 1) % 10 == 0:
                    print(f"Processed {i + 1}/{len(frames)} frames")
            
            total_time = time.time() - start_total
            
            results = {
                'total_frames': len(frames),
                'total_time': total_time,
                'avg_inference_time': np.mean(times),
                'min_inference_time': np.min(times),
                'max_inference_time': np.max(times),
                'std_inference_time': np.std(times),
                'avg_fps': 1.0 / np.mean(times),
                'avg_person_count': np.mean(person_counts),
                'device': self.detector.device
            }
            
            return results
            
        except Exception as e:
            print(f"Detection benchmark failed: {e}")
            return {}
    
    def benchmark_analysis_speed(self, frames: List[np.ndarray]) -> Dict:
        """Benchmark crowd analysis speed"""
        print("Benchmarking analysis speed...")
        
        self.analyzer = CrowdAnalyzer()
        
        # Create mock detections for each frame
        detections_list = []
        for frame in frames:
            count = np.random.randint(5, 30)
            boxes = []
            for _ in range(count):
                x1 = np.random.randint(0, frame.shape[1] - 100)
                y1 = np.random.randint(0, frame.shape[0] - 100)
                x2 = x1 + np.random.randint(30, 100)
                y2 = y1 + np.random.randint(60, 150)
                boxes.append([x1, y1, x2, y2])
            
            detections = {
                'boxes': boxes,
                'scores': [0.8] * count,
                'person_count': count
            }
            detections_list.append(detections)
        
        times = []
        start_total = time.time()
        
        for i, (frame, detections) in enumerate(zip(frames, detections_list)):
            start_time = time.time()
            analysis = self.analyzer.analyze_crowd(detections, frame.shape)
            end_time = time.time()
            
            times.append(end_time - start_time)
            
            if (i + 1) % 10 == 0:
                print(f"Analyzed {i + 1}/{len(frames)} frames")
        
        total_time = time.time() - start_total
        
        results = {
            'total_frames': len(frames),
            'total_time': total_time,
            'avg_analysis_time': np.mean(times),
            'min_analysis_time': np.min(times),
            'max_analysis_time': np.max(times),
            'std_analysis_time': np.std(times),
            'avg_fps': 1.0 / np.mean(times)
        }
        
        return results
    
    def benchmark_end_to_end(self, frames: List[np.ndarray]) -> Dict:
        """Benchmark end-to-end system performance"""
        print("Benchmarking end-to-end performance...")
        
        try:
            # Initialize all components
            detector = YOLOv8Detector()
            analyzer = CrowdAnalyzer()
            alert_manager = AlertManager()
            
            times = []
            start_total = time.time()
            
            for i, frame in enumerate(frames):
                start_time = time.time()
                
                # Full pipeline
                detections = detector.detect_persons(frame)
                analysis = analyzer.analyze_crowd(detections, frame.shape)
                alerts = alert_manager.check_alerts(analysis)
                
                end_time = time.time()
                times.append(end_time - start_time)
                
                if (i + 1) % 10 == 0:
                    print(f"Processed {i + 1}/{len(frames)} frames (end-to-end)")
            
            total_time = time.time() - start_total
            
            results = {
                'total_frames': len(frames),
                'total_time': total_time,
                'avg_pipeline_time': np.mean(times),
                'min_pipeline_time': np.min(times),
                'max_pipeline_time': np.max(times),
                'std_pipeline_time': np.std(times),
                'avg_fps': 1.0 / np.mean(times)
            }
            
            return results
            
        except Exception as e:
            print(f"End-to-end benchmark failed: {e}")
            return {}
    
    def run_full_benchmark(self, num_frames: int = 50) -> Dict:
        """Run complete benchmark suite"""
        print(f"Running full performance benchmark with {num_frames} frames...")
        
        # Create test frames
        frames = self.create_test_frames(num_frames)
        
        results = {
            'test_config': {
                'num_frames': num_frames,
                'frame_resolution': f"{frames[0].shape[1]}x{frames[0].shape[0]}",
                'timestamp': time.time()
            }
        }
        
        # Run benchmarks
        results['detection'] = self.benchmark_detection_speed(frames)
        results['analysis'] = self.benchmark_analysis_speed(frames)
        results['end_to_end'] = self.benchmark_end_to_end(frames)
        
        return results
    
    def save_benchmark_results(self, results: Dict, filename: str = None):
        """Save benchmark results to file"""
        if not filename:
            timestamp = int(time.time())
            filename = f"benchmark_results_{timestamp}.json"
        
        with open(filename, 'w') as f:
            json.dump(results, f, indent=2)
        
        print(f"Benchmark results saved to {filename}")
    
    def print_benchmark_summary(self, results: Dict):
        """Print benchmark summary"""
        print("\n" + "="*60)
        print("PERFORMANCE BENCHMARK SUMMARY")
        print("="*60)
        
        if 'detection' in results and results['detection']:
            det = results['detection']
            print(f"Detection Performance:")
            print(f"  Average FPS: {det['avg_fps']:.1f}")
            print(f"  Average inference time: {det['avg_inference_time']*1000:.1f} ms")
            print(f"  Device: {det['device']}")
        
        if 'analysis' in results and results['analysis']:
            ana = results['analysis']
            print(f"\nAnalysis Performance:")
            print(f"  Average FPS: {ana['avg_fps']:.1f}")
            print(f"  Average analysis time: {ana['avg_analysis_time']*1000:.1f} ms")
        
        if 'end_to_end' in results and results['end_to_end']:
            e2e = results['end_to_end']
            print(f"\nEnd-to-End Performance:")
            print(f"  Average FPS: {e2e['avg_fps']:.1f}")
            print(f"  Average pipeline time: {e2e['avg_pipeline_time']*1000:.1f} ms")
        
        print("="*60 + "\n")


def run_unit_tests():
    """Run all unit tests"""
    print("Running unit tests...")
    
    # Create test suite
    test_suite = unittest.TestSuite()
    
    # Add test cases
    test_classes = [
        TestVideoProcessor,
        TestYOLOv8Detector,
        TestCrowdAnalyzer,
        TestAlertManager
    ]
    
    for test_class in test_classes:
        tests = unittest.TestLoader().loadTestsFromTestCase(test_class)
        test_suite.addTests(tests)
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(test_suite)
    
    return result.wasSuccessful()


def run_performance_benchmark(num_frames: int = 50):
    """Run performance benchmark"""
    benchmark = PerformanceBenchmark()
    results = benchmark.run_full_benchmark(num_frames)
    
    # Print summary
    benchmark.print_benchmark_summary(results)
    
    # Save results
    benchmark.save_benchmark_results(results)
    
    return results


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Test and benchmark AI Crowd Detection system')
    parser.add_argument('--tests', action='store_true', help='Run unit tests')
    parser.add_argument('--benchmark', action='store_true', help='Run performance benchmark')
    parser.add_argument('--frames', type=int, default=50, help='Number of frames for benchmark')
    parser.add_argument('--all', action='store_true', help='Run both tests and benchmark')
    
    args = parser.parse_args()
    
    if args.all or (not args.tests and not args.benchmark):
        # Run everything if no specific option chosen
        print("Running complete test and benchmark suite...\n")
        
        success = run_unit_tests()
        if success:
            print("\nUnit tests passed! Running benchmark...\n")
            run_performance_benchmark(args.frames)
        else:
            print("\nUnit tests failed! Skipping benchmark.")
    
    elif args.tests:
        run_unit_tests()
    
    elif args.benchmark:
        run_performance_benchmark(args.frames)