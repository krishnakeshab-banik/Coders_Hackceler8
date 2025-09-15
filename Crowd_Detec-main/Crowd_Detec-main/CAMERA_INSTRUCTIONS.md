# 📹 Camera Instructions for AI Crowd Detection

This guide provides step-by-step instructions for running the AI Crowd Detection system with your camera.

## ⚠️ Camera Not Opening with `--input 0`?

**If the command `python crowd_detector.py --input 0` doesn't work, try these alternatives:**

### 🔁 **Quick Fixes (Try These First):**

```powershell
# 1. Run without --input parameter (uses config.yaml default)
python crowd_detector.py

# 2. Try other camera indices
python crowd_detector.py --input 1
python crowd_detector.py --input 2

# 3. Run with explicit camera index as integer
python crowd_detector.py -i 0
```

### 🔍 **Diagnose Your Camera Setup:**

```powershell
# Find available cameras
python -c "import cv2; [print(f'Camera {i}: {"Available" if cv2.VideoCapture(i).isOpened() else "Not found"}') for i in range(5)]"
```

### 🛠️ **Edit Configuration File:**

Edit `config.yaml` and change the camera source:

```yaml
video:
  input_source: 1  # Change from 0 to 1, 2, 3, etc.
```

Then run:
```powershell
python crowd_detector.py
```

## ⚡ Quick Reference - Start Camera Detection

**Most common workflow:**

```powershell
# 1. Open PowerShell and navigate to project
cd C:\Users\pandr\OneDrive\Desktop\CrowdProj

# 2. Activate virtual environment
venv\Scripts\activate.bat

# 3. Start camera detection (try these in order)
python crowd_detector.py                    # Method 1: Use config.yaml default
python crowd_detector.py --input 0          # Method 2: Explicit camera 0
python crowd_detector.py --input 1          # Method 3: Try camera 1 if 0 fails

# 4. Use controls: 'q' to quit, 'p' to pause, 's' to save frame
```

**Troubleshooting**: If you get "ModuleNotFoundError", make sure step 2 (virtual environment activation) was successful. You should see `(venv)` in your prompt.

## 🚀 Quick Start - Webcam Detection

### Step 1: Activate Virtual Environment

**IMPORTANT**: Always activate the virtual environment before running the program to avoid missing dependency errors.

```powershell
# Navigate to project directory
cd C:\Users\pandr\OneDrive\Desktop\CrowdProj

# Activate virtual environment (PowerShell syntax)
.\venv\Scripts\Activate.ps1

# Alternative if above fails due to execution policy
venv\Scripts\activate.bat
```

**Verify activation**: You should see `(venv)` at the beginning of your command prompt.

### Step 2: Run Camera Detection

```powershell
# Basic webcam detection (uses default camera)
python crowd_detector.py

# Or explicitly specify webcam index
python crowd_detector.py --input 0
```

## 📝 Complete Setup and Execution Guide

### 🔧 Initial Setup (One-time only)

1. **Run the setup script to create virtual environment and install dependencies**:

```powershell
# Navigate to project directory
cd C:\Users\pandr\OneDrive\Desktop\CrowdProj

# Run setup script (PowerShell syntax)
.\setup.bat
```

**Note**: If you get an execution policy error, try:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 📹 Daily Camera Operation

**Every time you want to run camera detection:**

```powershell
# Step 1: Navigate to project directory
cd C:\Users\pandr\OneDrive\Desktop\CrowdProj

# Step 2: Activate virtual environment
venv\Scripts\activate.bat
# You should see (venv) in your prompt

# Step 3: Start camera detection
python crowd_detector.py
```

### 🎆 Alternative Camera Sources

```powershell
# Use second camera (if available)
python crowd_detector.py --input 1

# Use external USB camera (try different indices)
python crowd_detector.py --input 2
```

## 📋 Pre-flight Checklist

Before running camera detection, ensure:

### ✅ 1. System Requirements
- [ ] **Python 3.8+** installed
- [ ] **Dependencies installed**: `pip install -r requirements.txt`
- [ ] **Camera connected** and functioning
- [ ] **Sufficient lighting** for person detection
- [ ] **GPU drivers** (NVIDIA) if using CUDA acceleration

### ✅ 2. Camera Setup
- [ ] **Camera permissions** granted to Python/terminal
- [ ] **Close other camera apps** (Zoom, Teams, Skype, etc.)
- [ ] **Position camera** at appropriate height (eye level or higher)
- [ ] **Stable mounting** to avoid shaky footage
- [ ] **Good field of view** covering the target area

### 🧪 Test Camera Before Detection

Always test your camera setup first:

```powershell
# Make sure virtual environment is activated
venv\Scripts\activate.bat

# Test camera access
python test_webcam.py
```

**Expected Output:**
- Webcam opens successfully
- Live video feed displays
- Grid overlay appears
- Frame counter increments
- No error messages

## 🎯 Configuration for Camera Detection

### Edit `config.yaml` for Optimal Camera Performance

```yaml
# Camera-specific settings
video:
  input_source: 0              # Default camera (change if needed)
  display_output: true         # Show live video feed
  target_fps: 30              # Adjust based on camera capabilities
  resize_width: 1280          # Resolution (adjust for performance)
  resize_height: 720

# Detection settings for camera use
model:
  confidence_threshold: 0.6    # Higher for better accuracy
  device: "auto"              # Will use GPU if available

# Crowd analysis for real-time
crowd_analysis:
  smoothing_factor: 0.4       # More smoothing for camera jitter
  alert_thresholds:
    low: 5                    # Adjust for your space
    medium: 15
    high: 30

# Real-time logging
logging:
  enable: true
  log_interval: 10            # Log every 10 seconds
  save_images: true           # Save alert snapshots
```

## 🏃‍♂️ Running Camera Detection

### 💻 Command Reference (with Virtual Environment)

**Always run these commands after activating the virtual environment:**

```powershell
# Step 1: Activate virtual environment
cd C:\Users\pandr\OneDrive\Desktop\CrowdProj
venv\Scripts\activate.bat

# Step 2: Choose your detection command
```

### Basic Commands

```powershell
# Start detection with default settings
python crowd_detector.py

# Run without display (headless mode)
python crowd_detector.py --no-display

# Save the processed video output
python crowd_detector.py --save-output

# Use custom configuration file
python crowd_detector.py --config my_camera_config.yaml
```

### Advanced Camera Usage

```powershell
# IP Camera (RTSP stream)
python crowd_detector.py --input "rtsp://192.168.1.100:554/stream"

# USB Camera with specific index
python crowd_detector.py --input 2

# High-resolution webcam with save output
python crowd_detector.py --input 0 --save-output
```

## 🎮 Live Controls During Detection

While the system is running, use these keyboard controls:

| Key | Action |
|-----|--------|
| **`q`** | Quit the application |
| **`p`** | Pause/Resume processing |
| **`s`** | Save current frame as image |
| **`h`** | Toggle density heatmap window |
| **`r`** | Reset alert counters |

## 📊 Understanding the Live Display

### Main Window Elements
- **Green boxes**: Detected persons
- **Top-left counter**: Real-time person count
- **Top-right info**: FPS and processing time
- **Alert indicators**: Color-coded crowd level warnings
- **Confidence scores**: Detection reliability (if enabled)

### Crowd Level Indicators
- 🟢 **GREEN**: Normal crowd (below low threshold)
- 🟡 **YELLOW**: Medium crowd density
- 🔴 **RED**: High crowd density
- 🚨 **FLASHING RED**: Critical crowd level

## 🔧 Troubleshooting Camera Issues

### Camera Detection Problems

If `python crowd_detector.py --input 0` doesn't open your camera, try these solutions:

#### Method 1: Test Different Camera Indices
```powershell
# Test which cameras are available
python -c "import cv2; [print(f'Camera {i}: {cv2.VideoCapture(i).isOpened()}') for i in range(5)]"

# Try different camera indices
python crowd_detector.py --input 1
python crowd_detector.py --input 2
```

#### Method 2: Use Default Configuration (No --input parameter)
```powershell
# Let the system use config.yaml default (which is set to 0)
python crowd_detector.py
```

#### Method 3: Modify config.yaml
```yaml
# Edit config.yaml and change:
video:
  input_source: 1  # Try 1, 2, 3, etc.
```

#### Method 4: Test Camera First
```powershell
# Always test camera before running detection
python test_webcam.py
```

### Virtual Environment Issues

```powershell
# If venv activation fails, recreate it:
python -m venv venv
venv\Scripts\activate.bat
pip install -r requirements.txt
```

### Camera Won't Open

**Step-by-step diagnosis:**

1. **Check camera availability:**
```powershell
python -c "import cv2; cap = cv2.VideoCapture(0); print('Camera works:', cap.isOpened()); cap.release()"
```

2. **Try different camera indices:**
```powershell
# Try cameras 0-4
for /L %i in (0,1,4) do python crowd_detector.py --input %i
```

3. **Check which cameras exist:**
```powershell
python -c "import cv2; [print(f'Camera {i}: Available' if cv2.VideoCapture(i).isOpened() else f'Camera {i}: Not available') for i in range(5)]"
```

**Common Solutions:**
1. **Close other applications** using the camera
2. **Restart the camera driver** (Device Manager > Cameras)
3. **Try different USB ports**
4. **Update camera drivers**
5. **Check camera permissions** in Windows Settings

### Poor Detection Performance
```yaml
# Adjust in config.yaml
model:
  confidence_threshold: 0.4  # Lower for more detections
  input_size: 416           # Smaller for better performance

video:
  resize_width: 640         # Lower resolution for speed
  resize_height: 480
```

### Low FPS Performance
```yaml
# Performance optimization
video:
  target_fps: 15            # Lower target FPS

performance:
  half_precision: true      # Use FP16 (if GPU supports)
  batch_size: 1            # Keep at 1 for real-time
```

## 📈 Performance Optimization

### For Real-time Camera Detection

#### CPU-Only Systems
```yaml
model:
  device: "cpu"
  input_size: 416           # Smaller input size

video:
  resize_width: 640
  resize_height: 480
  target_fps: 15
```

#### GPU-Accelerated Systems
```yaml
model:
  device: "cuda"            # Use GPU
  input_size: 640           # Higher quality

performance:
  half_precision: true      # FP16 for speed
```

## 🎯 Recommended Camera Positions

### Indoor Events/Rooms
- **Height**: 8-12 feet above ground
- **Angle**: 30-45 degrees downward
- **Coverage**: Wide angle to capture entire area
- **Lighting**: Ensure adequate ambient lighting

### Outdoor Events
- **Height**: 10-15 feet above ground
- **Protection**: Weather-resistant housing
- **Stability**: Secure mounting against wind
- **Lighting**: Consider time of day and shadows

## 📝 Camera-Specific Settings Examples

### Conference Room (5-20 people)
```yaml
crowd_analysis:
  alert_thresholds:
    low: 8
    medium: 15
    high: 25
```

### Small Event Space (10-50 people)
```yaml
crowd_analysis:
  alert_thresholds:
    low: 15
    medium: 35
    high: 50
```

### Large Venue (50+ people)
```yaml
crowd_analysis:
  alert_thresholds:
    low: 30
    medium: 80
    high: 150
```

## 📋 Daily Operation Checklist

### Before Starting Detection
- [ ] Camera is clean and unobstructed
- [ ] Adequate lighting in detection area
- [ ] All other camera applications closed
- [ ] Configuration file reviewed and updated
- [ ] Sufficient disk space for logs/videos

### During Operation
- [ ] Monitor live feed for accuracy
- [ ] Check FPS performance regularly
- [ ] Verify alert thresholds are appropriate
- [ ] Watch for false positives/negatives

### After Operation
- [ ] Review detection logs in `logs/` folder
- [ ] Check saved alert images if enabled
- [ ] Backup important detection data
- [ ] Review performance statistics

## 🆘 Emergency Stop

If you need to stop the system immediately:

1. **Press `Ctrl + C`** in the terminal
2. **Close the video window** if it becomes unresponsive
3. **Kill the process** via Task Manager if necessary

## 📞 Support and Testing

### System Diagnostics
```powershell
# Make sure virtual environment is activated first
venv\Scripts\activate.bat

# Test all components
python test_framework.py --tests

# Performance benchmark
python test_framework.py --benchmark

# Camera-specific test
python test_webcam.py
```

### Log Files for Troubleshooting
- **System log**: `crowd_detector.log`
- **Detection data**: `logs/crowd_detection_YYYYMMDD.csv`
- **Alert images**: `output/alerts/` (if enabled)

---

**🎯 Pro Tip**: Start with a 5-10 minute test run to ensure everything works correctly before deploying for longer periods!

**📧 Need help?** Check the logs first, then refer to the main `README.md` for detailed troubleshooting steps.