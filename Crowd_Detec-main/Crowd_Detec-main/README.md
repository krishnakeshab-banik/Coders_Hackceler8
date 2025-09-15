# AI Crowd Detection Model - MVP

A standalone AI model for real-time crowd detection and counting specifically optimized for festival environments. This MVP focuses on computer vision pipeline with accurate person detection, crowd density estimation, and basic alerting capabilities.

## 🎯 Features

- **Real-time Person Detection**: YOLOv8-based person detection with >85% accuracy
- **Crowd Density Analysis**: Advanced spatial analysis and density calculation
- **Smart Alerting**: Configurable threshold-based and anomaly-based alerts
- **Multi-source Input**: Support for webcam, video files, and IP cameras
- **Performance Optimized**: 15-30 FPS processing speed with GPU acceleration
- **Comprehensive Logging**: CSV/JSON data logging with optional image capture
- **Modular Architecture**: Easy to extend and integrate with other systems

## 🔧 Technical Stack

- **AI Framework**: YOLOv8 (Ultralytics)
- **Computer Vision**: OpenCV
- **Deep Learning**: PyTorch
- **Language**: Python 3.8+
- **Hardware**: NVIDIA GPU (recommended) with CPU fallback

## 📦 Installation

### Prerequisites

- Python 3.8 or higher
- NVIDIA GPU with CUDA support (optional but recommended)
- Webcam or video files for testing

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Download YOLOv8 Model

The YOLOv8 model will be automatically downloaded on first run. To pre-download:

```python
from ultralytics import YOLO
model = YOLO('yolov8n.pt')  # Downloads ~6MB model
```

## 🚀 Quick Start

### Basic Usage

```bash
# Run with default webcam
python crowd_detector.py

# Run with video file
python crowd_detector.py --input path/to/video.mp4

# Run with IP camera
python crowd_detector.py --input rtsp://camera_url

# Run without display (headless mode)
python crowd_detector.py --no-display

# Save processed video output
python crowd_detector.py --save-output
```

### Configuration

Edit `config.yaml` to customize behavior:

```yaml
model:
  confidence_threshold: 0.5  # Detection confidence threshold
  device: "auto"            # cuda, cpu, or auto

crowd_analysis:
  alert_thresholds:
    low: 20      # Low crowd alert threshold
    medium: 50   # Medium crowd alert threshold  
    high: 100    # High crowd alert threshold

video:
  display_output: true      # Show live video window
  save_output: false       # Save processed video
  target_fps: 30           # Target processing FPS
```

### Keyboard Controls (Live Mode)

- **'q'**: Quit application
- **'p'**: Pause/resume processing
- **'s'**: Save current frame
- **'h'**: Toggle density heatmap window
- **'r'**: Reset alert state

## 📊 System Architecture

```
Video Input → Frame Preprocessing → YOLOv8 Detection → 
Crowd Analysis → Alert Generation → Output/Logging
```

### Core Components

1. **`video_processor.py`**: Video input handling and frame management
2. **`model_utils.py`**: YOLOv8 model loading and person detection
3. **`crowd_analyzer.py`**: Crowd density calculation and spatial analysis
4. **`alert_manager.py`**: Alert generation and notification system
5. **`crowd_detector.py`**: Main integration script
6. **`config.py`**: Configuration management

## 🔍 Output Formats

### Real-time Display
- Live video with bounding boxes around detected persons
- Person count overlay
- Crowd density visualization
- Alert status indicators
- Performance metrics (FPS)

### Data Logging

**CSV Format** (`logs/crowd_detection_YYYYMMDD.csv`):
```csv
timestamp,datetime,person_count,density_score,crowd_level,alert_level,...
```

**JSON Format** (`logs/crowd_detection_YYYYMMDD.json`):
```json
{
  "timestamp": 1234567890,
  "analysis_results": {...},
  "alert_info": {...}
}
```

### Alert System

- **Console Output**: Real-time alerts printed to terminal
- **Email Notifications**: Optional email alerts (configure SMTP settings)
- **Image Capture**: Automatic image saving during alert conditions
- **Log Integration**: All alerts logged with timestamps

## 🧪 Testing and Validation

### Run Unit Tests

```bash
# Run all tests
python test_framework.py --tests

# Run performance benchmark  
python test_framework.py --benchmark

# Run complete test suite
python test_framework.py --all
```

### Performance Benchmarking

```bash
# Quick benchmark (50 frames)
python test_framework.py --benchmark

# Extended benchmark (200 frames)
python test_framework.py --benchmark --frames 200
```

## ⚙️ Configuration Options

### Model Settings
- **confidence_threshold**: Person detection confidence (0.0-1.0)
- **device**: Processing device (auto/cuda/cpu)
- **input_size**: Model input resolution (default: 640)
- **max_det**: Maximum detections per frame

### Video Settings
- **input_source**: Video source (0 for webcam, path for file)
- **display_output**: Enable/disable live display
- **save_output**: Save processed video
- **target_fps**: Target processing frame rate

### Alert Thresholds
- **low**: Low crowd density threshold
- **medium**: Medium crowd density threshold  
- **high**: High crowd density threshold

### Logging Options
- **enable**: Enable/disable data logging
- **format**: Log format (csv/json)
- **log_interval**: Logging frequency (seconds)
- **save_images**: Save alert images

## 📈 Performance Targets

### Minimum Requirements
- **CPU**: Intel i5 or equivalent
- **Memory**: 8GB RAM
- **Processing**: 15+ FPS on CPU
- **Accuracy**: >85% person detection

### Recommended Specifications
- **CPU**: Intel i7/AMD Ryzen 7
- **Memory**: 16GB RAM
- **GPU**: NVIDIA GTX 1660 or better
- **Processing**: 30+ FPS with GPU
- **Accuracy**: >90% person detection

## 🔧 Troubleshooting

### Common Issues

**1. CUDA Out of Memory**
```yaml
# Reduce batch size or use CPU
model:
  device: "cpu"
```

**2. Low FPS Performance**
```yaml
# Reduce input resolution
video:
  resize_width: 640
  resize_height: 480
```

**3. False Detections**
```yaml
# Increase confidence threshold
model:
  confidence_threshold: 0.7
```

### Error Logs

Check `crowd_detector.log` for detailed error information.

## 📋 API Reference

### CrowdDetector Class

```python
from crowd_detector import CrowdDetector

# Initialize detector
detector = CrowdDetector(input_source="video.mp4")

# Start detection
detector.run()

# Get statistics
stats = detector.get_system_statistics()
```

### YOLOv8Detector Class

```python
from model_utils import YOLOv8Detector

detector = YOLOv8Detector()
detections = detector.detect_persons(frame)
```

### CrowdAnalyzer Class

```python
from crowd_analyzer import CrowdAnalyzer

analyzer = CrowdAnalyzer()
analysis = analyzer.analyze_crowd(detections, frame.shape)
```

## 📝 Data Schema

### Detection Results
```python
{
    'boxes': [[x1, y1, x2, y2], ...],  # Bounding boxes
    'scores': [0.95, 0.87, ...],       # Confidence scores
    'person_count': 5,                 # Number of detected persons
    'inference_time': 0.045            # Processing time (seconds)
}
```

### Crowd Analysis
```python
{
    'person_count': 15,                # Raw person count
    'smoothed_count': 14.2,            # Temporally smoothed count
    'density_score': 0.65,             # Density score (0-1)
    'crowd_level': 'medium',           # Classification (low/medium/high/critical)
    'spatial_analysis': {...},         # Spatial distribution metrics
    'trends': {...},                   # Temporal trends
    'anomalies': {...}                 # Anomaly detection results
}
```

## 🛡️ Security Considerations

- Video data is processed locally (no cloud dependency)
- No personal identification or facial recognition
- Optional data logging with configurable retention
- SMTP credentials stored in configuration file (use environment variables in production)

## 🔄 Future Enhancements

This MVP is designed for easy extension:

- **Web Dashboard**: Real-time monitoring interface
- **Mobile App**: Remote monitoring and alerts
- **Multi-camera Support**: Distributed camera network
- **Advanced Analytics**: Heat mapping, flow analysis
- **Cloud Integration**: Data synchronization and remote monitoring
- **API Endpoints**: RESTful API for integration

## 📄 License

This project is intended for festival crowd monitoring and safety applications. Ensure compliance with local privacy and surveillance regulations.

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/new-feature`)
3. Commit changes (`git commit -am 'Add new feature'`)
4. Push to branch (`git push origin feature/new-feature`)
5. Create Pull Request

## 📞 Support

For technical support and questions:
- Check `crowd_detector.log` for error details
- Run test suite: `python test_framework.py --tests`
- Review configuration in `config.yaml`
- Verify dependencies: `pip install -r requirements.txt`

---

**Built with ❤️ for festival safety and crowd management**