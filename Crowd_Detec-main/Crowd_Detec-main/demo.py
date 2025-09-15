"""
Quick Start Demo Script for AI Crowd Detection
Simple script to demonstrate system capabilities
"""

import cv2
import numpy as np
import time
from crowd_detector import CrowdDetector

def create_demo_video():
    """Create a simple demo video with moving rectangles simulating people"""
    print("Creating demo video...")
    
    # Video properties
    width, height = 1280, 720
    fps = 30
    duration = 30  # seconds
    total_frames = fps * duration
    
    # Create video writer
    fourcc = cv2.VideoWriter.fourcc(*'mp4v')  # type: ignore
    out = cv2.VideoWriter('demo_crowd_video.mp4', fourcc, fps, (width, height))
    
    for frame_num in range(total_frames):
        # Create blank frame
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        
        # Add background gradient
        for y in range(height):
            intensity = int(50 + (y / height) * 50)
            frame[y, :] = [intensity, intensity, intensity]
        
        # Simulate crowd movement
        num_people = 15 + int(10 * np.sin(frame_num * 0.1))  # Varying crowd size
        
        for i in range(num_people):
            # Calculate position with some movement
            base_x = (i % 8) * 150 + 50
            base_y = (i // 8) * 200 + 100
            
            # Add movement
            x_offset = int(30 * np.sin(frame_num * 0.05 + i))
            y_offset = int(20 * np.cos(frame_num * 0.03 + i))
            
            x = base_x + x_offset
            y = base_y + y_offset
            
            # Person dimensions
            person_width = 40 + np.random.randint(-10, 10)
            person_height = 80 + np.random.randint(-15, 15)
            
            # Random color (person-like)
            color = (
                np.random.randint(100, 200),  # Blue
                np.random.randint(100, 200),  # Green  
                np.random.randint(150, 255)   # Red
            )
            
            # Draw person rectangle
            cv2.rectangle(frame, (x, y), (x + person_width, y + person_height), color, -1)
            
            # Add some random noise to make it more realistic
            if np.random.random() < 0.3:
                noise_x = x + np.random.randint(-5, person_width + 5)
                noise_y = y + np.random.randint(-5, person_height + 5)
                cv2.circle(frame, (noise_x, noise_y), 3, (255, 255, 255), -1)
        
        # Add frame number
        cv2.putText(frame, f"Frame: {frame_num}", (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        
        out.write(frame)
        
        if frame_num % 100 == 0:
            print(f"Generated {frame_num}/{total_frames} frames")
    
    out.release()
    print("Demo video created: demo_crowd_video.mp4")

def run_quick_demo():
    """Run a quick demonstration of the crowd detection system"""
    print("="*60)
    print("AI CROWD DETECTION - QUICK DEMO")
    print("="*60)
    
    try:
        # Create demo video if it doesn't exist
        import os
        if not os.path.exists('demo_crowd_video.mp4'):
            create_demo_video()
        
        print("\nInitializing Crowd Detection System...")
        
        # Initialize detector with demo video
        detector = CrowdDetector(input_source='demo_crowd_video.mp4')
        
        print("\nStarting detection (will run for 30 seconds)...")
        print("Controls:")
        print("  - Press 'q' to quit early")
        print("  - Press 'p' to pause/resume")
        print("  - Press 's' to save current frame")
        print("  - Press 'h' to show density heatmap")
        
        # Run detection
        start_time = time.time()
        detector.run()
        
        # Print final statistics
        print("\n" + "="*60)
        print("DEMO COMPLETED")
        print("="*60)
        detector.print_statistics()
        
    except KeyboardInterrupt:
        print("\nDemo interrupted by user")
    except Exception as e:
        print(f"\nDemo failed: {e}")
        print("Please check that all dependencies are installed:")
        print("  pip install -r requirements.txt")

if __name__ == "__main__":
    run_quick_demo()