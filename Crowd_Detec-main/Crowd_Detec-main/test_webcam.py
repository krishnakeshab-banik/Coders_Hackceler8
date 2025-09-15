"""
Simple webcam test to debug display issues
"""

import cv2
import numpy as np
import sys

def test_webcam_display():
    """Test basic webcam access and display"""
    print("Testing webcam access...")
    
    # Try to open webcam
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open webcam")
        print("Possible issues:")
        print("1. No webcam connected")
        print("2. Webcam in use by another application")
        print("3. Permission denied")
        return False
    
    print("Webcam opened successfully!")
    print("Press 'q' to quit the test")
    
    frame_count = 0
    
    try:
        while True:
            ret, frame = cap.read()
            
            if not ret:
                print("Error: Could not read frame")
                break
            
            frame_count += 1
            
            # Add some overlay text
            text = f"Frame: {frame_count} - Press 'q' to quit"
            cv2.putText(frame, text, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0), 2)
            
            # Draw a simple grid overlay
            height, width = frame.shape[:2]
            
            # Draw grid lines
            for i in range(0, width, 100):
                cv2.line(frame, (i, 0), (i, height), (255, 255, 255), 1)
            
            for i in range(0, height, 100):
                cv2.line(frame, (0, i), (width, i), (255, 255, 255), 1)
            
            # Show frame
            cv2.imshow('Webcam Test - Press q to quit', frame)
            
            # Check for key press
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                print("Quit key pressed")
                break
                
            # Auto-quit after 100 frames for testing
            if frame_count > 100:
                print("Test completed - 100 frames processed")
                break
    
    except Exception as e:
        print(f"Error during capture: {e}")
    
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("Webcam test completed")
    
    return True

def test_opencv_display():
    """Test basic OpenCV display functionality"""
    print("Testing OpenCV display...")
    
    try:
        # Create a test image
        test_image = np.zeros((480, 640, 3), dtype=np.uint8)
        test_image[:] = (50, 50, 50)  # Gray background
        
        # Add some text
        cv2.putText(test_image, "OpenCV Display Test", (150, 240), 
                   cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        
        # Show image
        cv2.imshow('OpenCV Test - Press any key to close', test_image)
        print("Test window should appear. Press any key to close it.")
        
        cv2.waitKey(0)  # Wait for key press
        cv2.destroyAllWindows()
        print("OpenCV display test completed successfully")
        return True
        
    except Exception as e:
        print(f"OpenCV display error: {e}")
        return False

if __name__ == "__main__":
    print("="*50)
    print("WEBCAM AND DISPLAY DIAGNOSTIC")
    print("="*50)
    
    # Test 1: Basic OpenCV display
    print("\n1. Testing OpenCV display functionality...")
    if not test_opencv_display():
        print("OpenCV display failed!")
        sys.exit(1)
    
    # Test 2: Webcam access
    print("\n2. Testing webcam access and display...")
    if not test_webcam_display():
        print("Webcam test failed!")
        sys.exit(1)
    
    print("\n" + "="*50)
    print("ALL TESTS PASSED!")
    print("Your system should work with the crowd detection.")
    print("="*50)