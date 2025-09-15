"""
Main Crowd Detection Script
Integrates all components for real-time crowd detection and analysis
"""

import cv2
import numpy as np
import time
import logging
import argparse
import signal
import sys
from pathlib import Path
from typing import Optional, Dict, Any
import requests
import os
import json

# Import our modules
from config import config
from video_processor import VideoProcessor
from model_utils import YOLOv8Detector
from crowd_analyzer import CrowdAnalyzer
from alert_manager import AlertManager


class CrowdDetector:
    """Main crowd detection system that integrates all components"""
    
    def __init__(self, input_source: Optional[str] = None, config_file: Optional[str] = None, 
                 convex_http_endpoint: Optional[str] = None, pandal_id: Optional[str] = None):
        """
        Initialize crowd detection system
        
        Args:
            input_source: Video input source (webcam, file, or URL)
            config_file: Path to configuration file
            convex_http_endpoint: URL for Convex HTTP action to send crowd data
            pandal_id: The ID of the pandal to associate with the crowd data
        """
        # Load configuration if custom file provided
        if config_file:
            from config import Config
            global config
            config = Config(config_file)
        
        # Initialize components
        self.input_source = input_source or config.get('video.input_source', 0)
        self.display_output = config.get('video.display_output', True)
        
        self.convex_http_endpoint = convex_http_endpoint or os.environ.get("CONVEX_HTTP_ENDPOINT")
        self.pandal_id = pandal_id or os.environ.get("PANDAL_ID")

        if self.convex_http_endpoint and not self.pandal_id:
            self.logger.warning("PANDAL_ID not provided for Convex integration. Crowd data will not be sent.")
        
        # System components
        self.video_processor = None
        self.detector = None
        self.crowd_analyzer = None
        self.alert_manager = None
        
        # Runtime state
        self.running = False
        self.paused = False
        self.frame_count = 0
        self.start_time = None
        
        # Performance tracking
        self.fps_history = []
        self.processing_times = []
        
        # Setup logging
        self._setup_logging()
        
        # Initialize components
        self._initialize_components()
        
        # Setup signal handlers
        self._setup_signal_handlers()
    
    def _setup_logging(self):
        """Setup logging configuration"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('crowd_detector.log'),
                logging.StreamHandler(sys.stdout)
            ]
        )
        self.logger = logging.getLogger(__name__)
    
    def _initialize_components(self):
        """Initialize all system components"""
        try:
            self.logger.info("Initializing Crowd Detection System...")
            
            # Initialize video processor
            self.logger.info("Initializing video processor...")
            self.video_processor = VideoProcessor(self.input_source)
            
            # Initialize YOLOv8 detector
            self.logger.info("Initializing YOLOv8 detector...")
            self.detector = YOLOv8Detector()
            
            # Initialize crowd analyzer
            self.logger.info("Initializing crowd analyzer...")
            self.crowd_analyzer = CrowdAnalyzer()
            
            # Initialize alert manager
            self.logger.info("Initializing alert manager...")
            self.alert_manager = AlertManager()
            
            self.logger.info("All components initialized successfully!")
            
        except Exception as e:
            self.logger.error(f"Error initializing components: {e}")
            raise RuntimeError(f"Failed to initialize crowd detection system: {e}")
    
    def _setup_signal_handlers(self):
        """Setup signal handlers for graceful shutdown"""
        def signal_handler(signum, frame):
            self.logger.info("Received shutdown signal, stopping system...")
            self.stop()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
    
    def start(self) -> bool:
        """
        Start the crowd detection system
        
        Returns:
            True if started successfully, False otherwise
        """
        try:
            self.logger.info("Starting crowd detection system...")
            
            # Start video capture
            if not self.video_processor.start_capture():
                self.logger.error("Failed to start video capture")
                return False
            
            self.running = True
            self.start_time = time.time()
            
            self.logger.info("Crowd detection system started successfully!")
            self.logger.info(f"Input source: {self.input_source}")
            self.logger.info("Press 'q' to quit, 'p' to pause/resume, 's' to save frame")
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error starting system: {e}")
            return False
    
    def stop(self):
        """Stop the crowd detection system"""
        self.logger.info("Stopping crowd detection system...")
        
        self.running = False
        
        if self.video_processor:
            self.video_processor.stop_capture()
        
        # Clean up OpenCV windows
        if self.display_output:
            cv2.destroyAllWindows()
        
        self.logger.info("Crowd detection system stopped")
    
    def _send_data_to_convex(self, results: Dict[str, Any]):
        """
        Send crowd detection data to Convex HTTP endpoint
        """
        if not self.convex_http_endpoint or not self.pandal_id:
            return

        analysis = results['analysis']
        alert_info = results['alerts']
        crowd_count = analysis.get('smoothed_count', len(results['detections']))
        crowd_density = analysis.get('density_score', 0.0)
        anomaly_detected = alert_info.get('alert_triggered', False)
        anomaly_type = alert_info.get('alert_type')

        payload = {
            "pandalId": self.pandal_id,
            "peopleCount": int(crowd_count),
            "crowdDensity": float(crowd_density),
            "anomalyDetected": anomaly_detected,
            "anomalyType": anomaly_type,
        }

        try:
            response = requests.post(self.convex_http_endpoint, json=payload, timeout=2)
            response.raise_for_status() # Raise HTTPError for bad responses (4xx or 5xx)
            self.logger.debug(f"Sent data to Convex: {response.status_code}")
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Error sending data to Convex: {e}")
    
    def process_frame(self, frame: np.ndarray) -> Dict[str, Any]:
        """
        Process a single frame through the entire pipeline
        
        Args:
            frame: Input frame
            
        Returns:
            Processing results
        """
        frame_start_time = time.time()
        
        # Preprocess frame
        processed_frame = self.video_processor.preprocess_frame(frame)
        
        # Detect persons
        detections = self.detector.detect_persons(frame)
        
        # Analyze crowd
        analysis_results = self.crowd_analyzer.analyze_crowd(detections, frame.shape)
        
        # Check alerts
        alert_info = self.alert_manager.check_alerts(analysis_results)
        
        # Log data
        self.alert_manager.log_data(analysis_results, alert_info)
        
        # Save alert image if needed
        if alert_info['alert_triggered']:
            self.alert_manager.save_alert_image(frame, alert_info)
        
        # Calculate processing time
        processing_time = time.time() - frame_start_time
        self.processing_times.append(processing_time)
        
        # Keep only last 100 processing times
        if len(self.processing_times) > 100:
            self.processing_times = self.processing_times[-100:]
        
        return {
            'frame': frame,
            'detections': detections,
            'analysis': analysis_results,
            'alerts': alert_info,
            'processing_time': processing_time
        }
    
    def draw_visualization(self, frame: np.ndarray, results: Dict[str, Any]) -> np.ndarray:
        """
        Draw visualization overlays on frame
        
        Args:
            frame: Input frame
            results: Processing results
            
        Returns:
            Annotated frame
        """
        annotated_frame = frame.copy()
        
        # Draw person detections
        annotated_frame = self.detector.draw_detections(
            annotated_frame, 
            results['detections'],
            draw_boxes=True,
            draw_count=True
        )
        
        # Draw crowd analysis information
        analysis = results['analysis']
        
        # Display crowd metrics (top-left corner)
        y_offset = 110
        metrics_text = [
            f"Density: {analysis.get('density_score', 0):.3f}",
            f"Crowd Level: {analysis.get('crowd_level', 'unknown').upper()}",
            f"Smoothed Count: {analysis.get('smoothed_count', 0):.1f}"
        ]
        
        for i, text in enumerate(metrics_text):
            y_pos = y_offset + (i * 30)
            cv2.putText(annotated_frame, text, (10, y_pos), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 255), 2)
        
        # Display spatial analysis (top-right corner)
        spatial = analysis.get('spatial_analysis', {})
        if spatial:
            width = annotated_frame.shape[1]
            spatial_text = [
                f"Spread: {spatial.get('spread', 0):.1f}",
                f"Clustering: {spatial.get('clustering_score', 0):.3f}",
                f"Edge Density: {spatial.get('edge_density', 0):.3f}"
            ]
            
            for i, text in enumerate(spatial_text):
                y_pos = 30 + (i * 30)
                text_size = cv2.getTextSize(text, cv2.FONT_HERSHEY_SIMPLEX, 0.6, 2)[0]
                x_pos = width - text_size[0] - 10
                cv2.putText(annotated_frame, text, (x_pos, y_pos), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 0), 2)
        
        # Display trends (bottom-left corner)
        trends = analysis.get('trends', {})
        if trends:
            height = annotated_frame.shape[0]
            trend_text = [
                f"Count Trend: {trends.get('count_trend', 'unknown')}",
                f"Density Trend: {trends.get('density_trend', 'unknown')}"
            ]
            
            for i, text in enumerate(trend_text):
                y_pos = height - 60 + (i * 30)
                cv2.putText(annotated_frame, text, (10, y_pos), 
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 0, 255), 2)
        
        # Display alert status (bottom-right corner)
        alert_info = results['alerts']
        if alert_info['alert_triggered']:
            alert_text = f"ALERT: {alert_info['alert_level'].upper()}"
            height = annotated_frame.shape[0]
            width = annotated_frame.shape[1]
            text_size = cv2.getTextSize(alert_text, cv2.FONT_HERSHEY_SIMPLEX, 1.0, 3)[0]
            x_pos = width - text_size[0] - 10
            y_pos = height - 20
            
            # Draw background rectangle
            cv2.rectangle(annotated_frame, 
                         (x_pos - 5, y_pos - text_size[1] - 5),
                         (x_pos + text_size[0] + 5, y_pos + 5),
                         (0, 0, 255), -1)
            
            cv2.putText(annotated_frame, alert_text, (x_pos, y_pos), 
                       cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 3)
        
        # Display processing performance
        avg_processing_time = np.mean(self.processing_times) if self.processing_times else 0
        fps = 1.0 / avg_processing_time if avg_processing_time > 0 else 0
        perf_text = f"Processing FPS: {fps:.1f}"
        cv2.putText(annotated_frame, perf_text, (10, annotated_frame.shape[0] - 10), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        
        return annotated_frame
    
    def draw_density_heatmap(self, results: Dict[str, Any], overlay_alpha: float = 0.5) -> Optional[np.ndarray]:
        """
        Create density heatmap visualization
        
        Args:
            results: Processing results
            overlay_alpha: Alpha value for heatmap overlay
            
        Returns:
            Heatmap visualization or None
        """
        try:
            analysis = results['analysis']
            heatmap = analysis.get('density_heatmap')
            
            if heatmap is None:
                return None
            
            frame = results['frame']
            frame_height, frame_width = frame.shape[:2]
            
            # Visualize heatmap
            heatmap_vis = self.crowd_analyzer.visualize_density_heatmap(
                heatmap, (frame_width, frame_height)
            )
            
            # Create overlay
            overlay = cv2.addWeighted(frame, 1 - overlay_alpha, heatmap_vis, overlay_alpha, 0)
            
            return overlay
            
        except Exception as e:
            self.logger.error(f"Error creating density heatmap: {e}")
            return None
    
    def run(self):
        """Run the main detection loop"""
        if not self.start():
            return
        
        try:
            self.logger.info("Starting main detection loop...")
            
            # Main processing loop
            while self.running:
                # Get frame from video processor
                frame = self.video_processor.get_frame(timeout=1.0)
                
                if frame is None:
                    if self.video_processor.is_running():
                        continue  # Timeout, try again
                    else:
                        self.logger.info("Video stream ended")
                        break
                
                self.frame_count += 1
                
                # Skip processing if paused
                if self.paused:
                    if self.display_output:
                        cv2.imshow('Crowd Detection (PAUSED)', frame)
                        key = cv2.waitKey(1) & 0xFF
                        if key == ord('p'):
                            self.paused = False
                            self.logger.info("Resumed processing")
                        elif key == ord('q'):
                            break
                    continue
                
                # Process frame
                results = self.process_frame(frame)
                
                # Send data to Convex
                self._send_data_to_convex(results)
                
                # Save processed frame if video output enabled
                if self.video_processor.save_output:
                    annotated_frame = self.draw_visualization(frame, results)
                    self.video_processor.save_frame(annotated_frame)
                
                # Display output if enabled
                if self.display_output:
                    self._handle_display(results)
                
                # Handle keyboard input
                if self.display_output:
                    key = cv2.waitKey(1) & 0xFF
                    if not self._handle_keyboard_input(key, results):
                        break
                
                # Log progress periodically
                if self.frame_count % 100 == 0:
                    elapsed_time = time.time() - self.start_time
                    avg_fps = self.frame_count / elapsed_time
                    self.logger.info(f"Processed {self.frame_count} frames, avg FPS: {avg_fps:.2f}")
        
        except KeyboardInterrupt:
            self.logger.info("Interrupted by user")
        except Exception as e:
            self.logger.error(f"Error in main loop: {e}")
        finally:
            self.stop()
    
    def _handle_display(self, results: Dict[str, Any]):
        """
        Handle display output
        """
        # Main detection window
        annotated_frame = self.draw_visualization(results['frame'], results)
        cv2.imshow('Crowd Detection', annotated_frame)
        
        # Optional: Show density heatmap in separate window
        heatmap_overlay = self.draw_density_heatmap(results)
        if heatmap_overlay is not None:
            cv2.imshow('Density Heatmap', heatmap_overlay)
    
    def _handle_keyboard_input(self, key: int, results: Dict[str, Any]) -> bool:
        """
        Handle keyboard input
        
        Args:
            key: Pressed key code
            results: Current processing results
            
        Returns:
            True to continue, False to stop
        """
        if key == ord('q'):
            return False
        elif key == ord('p'):
            self.paused = not self.paused
            self.logger.info(f"{'Paused' if self.paused else 'Resumed'} processing")
        elif key == ord('s'):
            # Save current frame
            timestamp = int(time.time())
            filename = f"crowd_frame_{timestamp}.jpg"
            annotated_frame = self.draw_visualization(results['frame'], results)
            cv2.imwrite(filename, annotated_frame)
            self.logger.info(f"Frame saved as {filename}")
        elif key == ord('h'):
            # Show heatmap window
            heatmap_overlay = self.draw_density_heatmap(results)
            if heatmap_overlay is not None:
                cv2.imshow('Density Heatmap', heatmap_overlay)
        elif key == ord('r'):
            # Reset alert state
            self.alert_manager.reset_alert_state()
            self.logger.info("Alert state reset")
        
        return True
    
    def get_system_statistics(self) -> Dict[str, Any]:
        """
        Get comprehensive system statistics"""
        elapsed_time = time.time() - self.start_time if self.start_time else 0
        
        stats = {
            'runtime': {
                'elapsed_time': elapsed_time,
                'frame_count': self.frame_count,
                'avg_fps': self.frame_count / elapsed_time if elapsed_time > 0 else 0,
                'avg_processing_time': np.mean(self.processing_times) if self.processing_times else 0
            },
            'video': self.video_processor.get_statistics() if self.video_processor else {},
            'model': self.detector.get_model_info() if self.detector else {},
            'crowd_analysis': self.crowd_analyzer.get_statistics() if self.crowd_analyzer else {},
            'alerts': self.alert_manager.get_alert_statistics() if self.alert_manager else {}
        }
        
        return stats
    
    def print_statistics(self):
        """
        Print system statistics to console"""
        stats = self.get_system_statistics()
        
        print("\n" + "="*60)
        print("CROWD DETECTION SYSTEM STATISTICS")
        print("="*60)
        
        # Runtime stats
        runtime = stats['runtime']
        print(f"Runtime: {runtime['elapsed_time']:.1f} seconds")
        print(f"Frames processed: {runtime['frame_count']}")
        print(f"Average FPS: {runtime['avg_fps']:.2f}")
        print(f"Average processing time: {runtime['avg_processing_time']*1000:.1f} ms")
        
        # Model stats
        model = stats['model']
        if model:
            print(f"\nModel: {model.get('model_path', 'N/A')}")
            print(f"Device: {model.get('device', 'N/A')}")
            print(f"Total detections: {model.get('total_detections', 0)}")
            print(f"Average inference time: {model.get('avg_inference_time', 0)*1000:.1f} ms")
        
        # Crowd analysis stats
        crowd = stats['crowd_analysis']
        if crowd:
            print(f"\nCurrent person count: {crowd.get('current_count', 0)}")
            print(f"Maximum count seen: {crowd.get('max_count', 0)}")
            print(f"Average count: {crowd.get('avg_count', 0):.1f}")
        
        print("="*60 + "\n")


def main():
    """Main function with command line interface"""
    parser = argparse.ArgumentParser(description='AI Crowd Detection System')
    
    parser.add_argument('--input', '-i', type=str, 
                       help='Input source (webcam index, video file, or URL)')
    parser.add_argument('--config', '-c', type=str,
                       help='Configuration file path')
    parser.add_argument('--no-display', action='store_true',
                       help='Disable video display output')
    parser.add_argument('--save-output', action='store_true',
                       help='Save processed video output')
    parser.add_argument('--benchmark', action='store_true',
                       help='Run performance benchmark')
    parser.add_argument('--convex-endpoint', type=str,
                       help='Convex HTTP endpoint for crowd data (e.g., https://<YOUR_CONVEX_URL>.convex.cloud/api/http/crowd-data)')
    parser.add_argument('--pandal-id', type=str,
                       help='Convex ID of the pandal to associate with crowd data (e.g., 12345)')
    
    args = parser.parse_args()
    
    try:
        # Create detector instance
        detector = CrowdDetector(
            input_source=args.input,
            config_file=args.config,
            convex_http_endpoint=args.convex_endpoint,
            pandal_id=args.pandal_id
        )
        
        # Override display setting if specified
        if args.no_display:
            detector.display_output = False
        
        # Override save output setting if specified
        if args.save_output:
            detector.video_processor.save_output = True
        
        if args.benchmark:
            # Run benchmark
            print("Running performance benchmark...")
            # This would implement benchmarking functionality
            print("Benchmark functionality not implemented yet")
        else:
            # Run normal detection
            detector.run()
            
            # Print final statistics
            detector.print_statistics()
    
    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()