#!/bin/bash

# Quick Setup Script for AI Crowd Detection Model
# This script helps set up the environment and dependencies

set -e  # Exit on any error

echo "=================================="
echo "AI Crowd Detection - Setup Script"
echo "=================================="

# Check Python version
echo "Checking Python version..."
python_version=$(python3 --version 2>&1 | grep -oP '\d+\.\d+' | head -1)
major_version=$(echo $python_version | cut -d. -f1)
minor_version=$(echo $python_version | cut -d. -f2)

if [ "$major_version" -lt 3 ] || [ "$major_version" -eq 3 -a "$minor_version" -lt 8 ]; then
    echo "Error: Python 3.8 or higher is required. Found: $python_version"
    echo "Please install Python 3.8+ and try again."
    exit 1
fi

echo "✓ Python version OK: $python_version"

# Check if pip is available
echo "Checking pip..."
if ! command -v pip3 &> /dev/null; then
    echo "Error: pip3 not found. Please install pip."
    exit 1
fi
echo "✓ pip3 is available"

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
    echo "✓ Virtual environment created"
else
    echo "✓ Virtual environment already exists"
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate
echo "✓ Virtual environment activated"

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install PyTorch (CPU version by default)
echo "Installing PyTorch..."
if command -v nvidia-smi &> /dev/null; then
    echo "NVIDIA GPU detected, installing CUDA version..."
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
else
    echo "No NVIDIA GPU detected, installing CPU version..."
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
fi

# Install other requirements
echo "Installing other requirements..."
pip install -r requirements.txt

# Download YOLOv8 model
echo "Downloading YOLOv8 model..."
python3 -c "
from ultralytics import YOLO
print('Downloading YOLOv8 model...')
model = YOLO('yolov8n.pt')
print('✓ YOLOv8 model downloaded successfully')
"

# Create necessary directories
echo "Creating directories..."
mkdir -p logs
mkdir -p output
mkdir -p models
mkdir -p test_data
echo "✓ Directories created"

# Run basic system test
echo "Running basic system test..."
python3 -c "
import sys
try:
    import torch
    import cv2
    import ultralytics
    print('✓ All major dependencies imported successfully')
    
    # Test CUDA availability
    if torch.cuda.is_available():
        print(f'✓ CUDA available: {torch.cuda.get_device_name(0)}')
    else:
        print('ℹ CUDA not available, will use CPU')
        
except ImportError as e:
    print(f'✗ Import error: {e}')
    sys.exit(1)
"

echo ""
echo "=================================="
echo "Setup completed successfully!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Activate the virtual environment: source venv/bin/activate"
echo "2. Run the demo: python3 demo.py"
echo "3. Or start detection: python3 crowd_detector.py"
echo ""
echo "For webcam detection: python3 crowd_detector.py"
echo "For video file: python3 crowd_detector.py --input path/to/video.mp4"
echo ""
echo "Check README.md for detailed usage instructions."