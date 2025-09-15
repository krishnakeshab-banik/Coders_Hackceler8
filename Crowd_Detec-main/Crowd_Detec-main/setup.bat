@echo off
REM Quick Setup Script for AI Crowd Detection Model - Windows Version

echo ==================================
echo AI Crowd Detection - Setup Script
echo ==================================

REM Check Python version
echo Checking Python version...
python --version >nul 2>&1
if errorlevel 1 (
    echo Error: Python not found. Please install Python 3.8+ and add it to PATH.
    pause
    exit /b 1
)

for /f "tokens=2" %%i in ('python --version 2^>^&1') do set python_version=%%i
echo ✓ Python version: %python_version%

REM Check if pip is available
echo Checking pip...
pip --version >nul 2>&1
if errorlevel 1 (
    echo Error: pip not found. Please install pip.
    pause
    exit /b 1
)
echo ✓ pip is available

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
    echo ✓ Virtual environment created
) else (
    echo ✓ Virtual environment already exists
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat
echo ✓ Virtual environment activated

REM Upgrade pip
echo Upgrading pip...
python -m pip install --upgrade pip

REM Check for NVIDIA GPU
echo Checking for NVIDIA GPU...
nvidia-smi >nul 2>&1
if errorlevel 1 (
    echo No NVIDIA GPU detected, installing CPU version of PyTorch...
    pip install torch torchvision torchaudio
) else (
    echo NVIDIA GPU detected, installing CUDA version of PyTorch...
    pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
)

REM Install other requirements
echo Installing other requirements...
pip install -r requirements.txt

REM Download YOLOv8 model
echo Downloading YOLOv8 model...
python -c "from ultralytics import YOLO; print('Downloading YOLOv8 model...'); model = YOLO('yolov8n.pt'); print('✓ YOLOv8 model downloaded successfully')"

REM Create necessary directories
echo Creating directories...
if not exist "logs" mkdir logs
if not exist "output" mkdir output
if not exist "models" mkdir models
if not exist "test_data" mkdir test_data
echo ✓ Directories created

REM Run basic system test
echo Running basic system test...
python -c "import sys; import torch, cv2, ultralytics; print('✓ All major dependencies imported successfully'); print('✓ CUDA available: ' + torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'ℹ CUDA not available, will use CPU')"

echo.
echo ==================================
echo Setup completed successfully!
echo ==================================
echo.
echo Next steps:
echo 1. Activate the virtual environment: venv\Scripts\activate.bat
echo 2. Run the demo: python demo.py
echo 3. Or start detection: python crowd_detector.py
echo.
echo For webcam detection: python crowd_detector.py
echo For video file: python crowd_detector.py --input path\to\video.mp4
echo.
echo Check README.md for detailed usage instructions.
echo.
pause