"""
Video Input Handling Module for AI Crowd Detection
Handles video input from various sources (webcam, video files, IP cameras)
"""

import cv2
import numpy as np
import logging
import time
import threading
from queue import Queue, Empty
from pathlib import Path
from typing import Optional, Tuple, Union, Generator
from config import config


class VideoProcessor:
    """Handles video input processing and frame management"""
    
    def __init__(self, input_source: Union[int, str] = None):
        """
        Initialize video processor
        
        Args:
            input_source: Video source (webcam index, file path, or IP camera URL)
        """
        self.input_source = input_source or config.get('video.input_source', 0)
        self.cap = None
        self.frame_queue = Queue(maxsize=10)
        self.running = False
        self.thread = None
        
        # Video properties
        self.fps = config.get('video.target_fps', 30)
        self.resize_width = config.get('video.resize_width', 1280)
        self.resize_height = config.get('video.resize_height', 720)
        
        # Statistics
        self.frame_count = 0
        self.start_time = None
        self.actual_fps = 0.0
        
        # Output settings
        self.save_output = config.get('video.save_output', False)
        self.output_path = config.get('video.output_path', 'output/')
        self.video_writer = None
        
        self._setup_logging()
    
    def _setup_logging(self):
        """Setup logging for video processor"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
    
    def initialize_capture(self) -> bool:
        """
        Initialize video capture
        
        Returns:
            True if successful, False otherwise
        """
        try:
            # Determine input type and create capture object
            if isinstance(self.input_source, int):
                # Webcam
                self.cap = cv2.VideoCapture(self.input_source)
                self.logger.info(f"Initializing webcam {self.input_source}")
            elif isinstance(self.input_source, str):
                if self.input_source.startswith(('http://', 'https://', 'rtsp://')):
                    # IP camera
                    self.cap = cv2.VideoCapture(self.input_source)
                    self.logger.info(f"Initializing IP camera: {self.input_source}")
                else:
                    # Video file
                    if not Path(self.input_source).exists():
                        self.logger.error(f"Video file not found: {self.input_source}")
                        return False
                    self.cap = cv2.VideoCapture(self.input_source)
                    self.logger.info(f"Initializing video file: {self.input_source}")
            
            if not self.cap.isOpened():
                self.logger.error("Failed to open video source")
                return False
            
            # Set capture properties
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, self.resize_width)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, self.resize_height)
            self.cap.set(cv2.CAP_PROP_FPS, self.fps)
            
            # Get actual properties
            actual_width = int(self.cap.get(cv2.CAP_PROP_FRAME_WIDTH))
            actual_height = int(self.cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
            actual_fps = self.cap.get(cv2.CAP_PROP_FPS)
            
            self.logger.info(f"Video initialized: {actual_width}x{actual_height} @ {actual_fps} FPS")
            
            # Initialize video writer if saving output
            if self.save_output:
                self._initialize_video_writer(actual_width, actual_height, actual_fps)
            
            return True
            
        except Exception as e:
            self.logger.error(f"Error initializing video capture: {e}")
            return False
    
    def _initialize_video_writer(self, width: int, height: int, fps: float):
        """Initialize video writer for output saving"""
        try:
            output_file = Path(self.output_path) / f"crowd_detection_{int(time.time())}.mp4"
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            self.video_writer = cv2.VideoWriter(str(output_file), fourcc, fps, (width, height))
            self.logger.info(f"Video writer initialized: {output_file}")
        except Exception as e:
            self.logger.error(f"Error initializing video writer: {e}")
            self.save_output = False
    
    def _capture_frames(self):
        """Capture frames in separate thread"""
        self.start_time = time.time()
        frame_interval = 1.0 / self.fps if self.fps > 0 else 0
        
        while self.running:
            start_frame_time = time.time()
            
            ret, frame = self.cap.read()
            if not ret:
                self.logger.warning("Failed to read frame, stopping capture")
                break
            
            # Resize frame if needed
            if frame.shape[1] != self.resize_width or frame.shape[0] != self.resize_height:
                frame = cv2.resize(frame, (self.resize_width, self.resize_height))
            
            # Add frame to queue (non-blocking)
            try:
                self.frame_queue.put_nowait(frame.copy())
                self.frame_count += 1
                
                # Calculate actual FPS
                elapsed_time = time.time() - self.start_time
                if elapsed_time > 0:
                    self.actual_fps = self.frame_count / elapsed_time
                
            except:
                # Queue is full, skip this frame
                pass
            
            # Frame rate control
            if frame_interval > 0:
                elapsed = time.time() - start_frame_time
                sleep_time = frame_interval - elapsed
                if sleep_time > 0:
                    time.sleep(sleep_time)
    
    def start_capture(self) -> bool:
        """
        Start video capture in separate thread
        
        Returns:
            True if started successfully, False otherwise
        """
        if not self.initialize_capture():
            return False
        
        self.running = True
        self.thread = threading.Thread(target=self._capture_frames, daemon=True)
        self.thread.start()
        self.logger.info("Video capture started")
        return True
    
    def stop_capture(self):
        """Stop video capture"""
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=2.0)
        
        if self.cap:
            self.cap.release()
        
        if self.video_writer:
            self.video_writer.release()
        
        self.logger.info("Video capture stopped")
    
    def get_frame(self, timeout: float = 1.0) -> Optional[np.ndarray]:
        """
        Get next frame from queue
        
        Args:
            timeout: Timeout in seconds
            
        Returns:
            Frame as numpy array or None if timeout
        """
        try:
            return self.frame_queue.get(timeout=timeout)
        except Empty:
            return None
    
    def get_frame_generator(self) -> Generator[np.ndarray, None, None]:
        """
        Generator that yields frames continuously
        
        Yields:
            Video frames as numpy arrays
        """
        while self.running:
            frame = self.get_frame(timeout=0.1)
            if frame is not None:
                yield frame
    
    def save_frame(self, frame: np.ndarray):
        """Save frame to output video if enabled"""
        if self.save_output and self.video_writer:
            self.video_writer.write(frame)
    
    def get_statistics(self) -> dict:
        """
        Get video processing statistics
        
        Returns:
            Dictionary with statistics
        """
        elapsed_time = time.time() - self.start_time if self.start_time else 0
        return {
            'frame_count': self.frame_count,
            'elapsed_time': elapsed_time,
            'actual_fps': self.actual_fps,
            'target_fps': self.fps,
            'queue_size': self.frame_queue.qsize(),
            'input_source': str(self.input_source)
        }
    
    def preprocess_frame(self, frame: np.ndarray) -> np.ndarray:
        """
        Preprocess frame for model input
        
        Args:
            frame: Input frame
            
        Returns:
            Preprocessed frame
        """
        # Basic preprocessing - can be extended
        # Ensure frame is in RGB format for YOLOv8
        if len(frame.shape) == 3 and frame.shape[2] == 3:
            # Convert BGR to RGB
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        
        return frame
    
    def is_running(self) -> bool:
        """Check if video capture is running"""
        return self.running and (self.thread is not None and self.thread.is_alive())
    
    def __enter__(self):
        """Context manager entry"""
        self.start_capture()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.stop_capture()


class FrameBuffer:
    """Thread-safe frame buffer for video processing"""
    
    def __init__(self, maxsize: int = 10):
        """
        Initialize frame buffer
        
        Args:
            maxsize: Maximum buffer size
        """
        self.buffer = Queue(maxsize=maxsize)
        self.maxsize = maxsize
    
    def put(self, frame: np.ndarray, timeout: float = None) -> bool:
        """
        Add frame to buffer
        
        Args:
            frame: Frame to add
            timeout: Timeout in seconds
            
        Returns:
            True if successful, False if timeout
        """
        try:
            if timeout:
                self.buffer.put(frame, timeout=timeout)
            else:
                self.buffer.put_nowait(frame)
            return True
        except:
            return False
    
    def get(self, timeout: float = None) -> Optional[np.ndarray]:
        """
        Get frame from buffer
        
        Args:
            timeout: Timeout in seconds
            
        Returns:
            Frame or None if timeout
        """
        try:
            if timeout:
                return self.buffer.get(timeout=timeout)
            else:
                return self.buffer.get_nowait()
        except:
            return None
    
    def size(self) -> int:
        """Get current buffer size"""
        return self.buffer.qsize()
    
    def is_full(self) -> bool:
        """Check if buffer is full"""
        return self.buffer.qsize() >= self.maxsize
    
    def clear(self):
        """Clear buffer"""
        while not self.buffer.empty():
            try:
                self.buffer.get_nowait()
            except:
                break


def test_video_processor():
    """Test function for video processor"""
    print("Testing Video Processor...")
    
    # Test with webcam (if available)
    try:
        with VideoProcessor(0) as processor:
            print("Video processor started successfully")
            
            # Capture a few frames
            for i in range(10):
                frame = processor.get_frame(timeout=2.0)
                if frame is not None:
                    print(f"Frame {i+1}: {frame.shape}")
                else:
                    print(f"Frame {i+1}: Timeout")
                
                time.sleep(0.1)
            
            stats = processor.get_statistics()
            print(f"Statistics: {stats}")
            
    except Exception as e:
        print(f"Error testing video processor: {e}")


if __name__ == "__main__":
    test_video_processor()