import { useState, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-webgl"; // Import the WebGL backend
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import * as poseDetection from "@tensorflow-models/pose-detection";

// Register WebGL backend once
tf.setBackend('webgl').then(() => console.log('TensorFlow.js WebGL backend registered.'));

interface Pandal {
  _id: Id<"pandals">;
  name: string;
  location: { lat: number; lng: number };
  address: string;
  crowdLevel: "low" | "medium" | "high" | "critical";
  currentCrowd: number;
  capacity: number;
}

interface CameraPanelProps {
  pandals: Pandal[];
}

export function CameraPanel({ pandals }: CameraPanelProps) {
  const [selectedPandal, setSelectedPandal] = useState<Pandal | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // Canvas for processing frames
  const recordCrowdData = useMutation(api.crowdData.recordCrowdData);
  const [latestAnomaly, setLatestAnomaly] = useState<string | undefined>(undefined);
  const [cocoSsdModel, setCocoSsdModel] = useState<cocoSsd.CocoSsd | null>(null);
  const [poseDetector, setPoseDetector] = useState<poseDetection.PoseDetector | null>(null);
  const [currentCrowdCount, setCurrentCrowdCount] = useState(0);

  // Store previous poses for movement detection
  const previousPosesRef = useRef<poseDetection.Pose[]>([]);

  // Automatically select Bagbazar Sarbojanin if available and keep its data updated
  useEffect(() => {
    const bagbazarPandal = pandals.find(p => p.name === "Bagbazar Sarbojanin");
    if (bagbazarPandal) {
      if (!selectedPandal || selectedPandal._id === bagbazarPandal._id) {
        setSelectedPandal(bagbazarPandal);
      }
    } else if (!selectedPandal && pandals.length > 0) {
      setSelectedPandal(pandals[0]);
    }
  }, [pandals, selectedPandal]);

  // Load the COCO-SSD and MoveNet models
  useEffect(() => {
    tf.ready().then(() => {
      // Load COCO-SSD
      cocoSsd.load().then(loadedModel => {
        setCocoSsdModel(loadedModel);
        console.log("COCO-SSD model loaded.");
      }).catch(error => console.error("Error loading COCO-SSD model:", error));

      // Load MoveNet (Lightning)
      const detectorConfig = poseDetection.SupportedModels.MoveNet;
      const modelConfig = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
      poseDetection.createDetector(detectorConfig, modelConfig).then(loadedDetector => {
        setPoseDetector(loadedDetector);
        console.log("MoveNet pose detector loaded.");
      }).catch(error => console.error("Error loading MoveNet detector:", error));

    }).catch(error => console.error("Error preparing TensorFlow.js:", error));
  }, []);

  // Effect to handle camera stream assignment to video element
  useEffect(() => {
    if (cameraStream && videoRef.current) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(error => {
        console.error("Error attempting to play video from useEffect:", error);
      });
    }
  }, [cameraStream]);

  // Start camera stream
  const startCamera = async () => {
    if (!selectedPandal) {
      alert("Please select a pandal to monitor.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false
      });
      console.log("Camera stream obtained:", stream);
      setCameraStream(stream);
      setIsRecording(true); // Automatically start recording when camera starts
    } catch (error) {
      console.error("Error accessing camera:", error);
      alert("Unable to access camera. Please check permissions.");
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setIsRecording(false);
    setCurrentCrowdCount(0);
    setLatestAnomaly(undefined);
    previousPosesRef.current = []; // Clear previous poses
  };

  // Anomaly detection heuristics (simplified for prototype)
  const detectFire = (videoElement: HTMLVideoElement): boolean => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || videoElement.videoWidth === 0) return false;

    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let redPixelCount = 0;
    const threshold = 100; // Minimum red pixels to consider as fire

    // Sample a subset of pixels for performance
    const step = 10; // Check every 10th pixel
    for (let i = 0; i < data.length; i += 4 * step) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Simple fire detection: high red, moderate green, low blue
      if (r > 200 && g > 100 && b < 100) {
        redPixelCount++;
      }
    }
    return redPixelCount > threshold;
  };

  const detectFight = (currentPoses: poseDetection.Pose[], prevPoses: poseDetection.Pose[], cocoPredictions: cocoSsd.DetectedObject[]): boolean => {
    if (currentPoses.length < 2 || cocoPredictions.filter(p => p.class === 'person').length < 2) return false;

    // Check for close proximity of multiple people
    const personBoxes = cocoPredictions.filter(p => p.class === 'person').map(p => p.bbox);
    let closeProximity = false;
    for (let i = 0; i < personBoxes.length; i++) {
      for (let j = i + 1; j < personBoxes.length; j++) {
        const [x1, y1, width1, height1] = personBoxes[i];
        const [x2, y2, width2, height2] = personBoxes[j];

        // Calculate intersection over union (IoU) or a simple distance metric
        const intersectX1 = Math.max(x1, x2);
        const intersectY1 = Math.max(y1, y2);
        const intersectX2 = Math.min(x1 + width1, x2 + width2);
        const intersectY2 = Math.min(y1 + height1, y2 + height2);

        const intersectWidth = Math.max(0, intersectX2 - intersectX1);
        const intersectHeight = Math.max(0, intersectY2 - intersectY1);
        const intersectArea = intersectWidth * intersectHeight;

        const area1 = width1 * height1;
        const area2 = width2 * height2;

        // Consider close proximity if there's significant overlap or very near bounding boxes
        if (intersectArea > 0.1 * Math.min(area1, area2) || (intersectWidth + intersectHeight > 0 && Math.abs((x1 + width1/2) - (x2 + width2/2)) < (width1 + width2)/2 * 1.5 && Math.abs((y1 + height1/2) - (y2 + height2/2)) < (height1 + height2)/2 * 1.5)) {
          closeProximity = true;
          break;
        }
      }
      if (closeProximity) break;
    }
    if (!closeProximity) return false;

    // Simplified movement detection (if people are close, and there's significant overall movement)
    if (prevPoses.length > 0 && currentPoses.length === prevPoses.length) {
      let significantMovement = 0;
      const movementThreshold = 5; // Reduced threshold for more sensitivity
      const keypointConfidenceThreshold = 0.3; // Lowered confidence for more keypoints

      for (let i = 0; i < currentPoses.length; i++) {
        const currentKeypoints = currentPoses[i].keypoints;
        const prevKeypoints = prevPoses[i].keypoints;
        if (currentKeypoints && prevKeypoints) {
          for (let k = 0; k < currentKeypoints.length; k++) {
            const ck = currentKeypoints[k];
            const pk = prevKeypoints[k];
            if (ck && pk && ck.score > keypointConfidenceThreshold && pk.score > keypointConfidenceThreshold) { // Use lowered confidence
              const dx = ck.x - pk.x;
              const dy = ck.y - pk.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              if (distance > movementThreshold) { // Use reduced movement threshold
                significantMovement++;
              }
            }
          }
        }
      }
      return significantMovement > (currentPoses.length * currentPoses[0].keypoints.length * 0.1); // Roughly 10% of total keypoint movements
    }

    return false;
  };


  // Crowd detection and data sending loop
  useEffect(() => {
    let animationFrameId: number;
    let lastDetectionTime = 0;
    const detectionInterval = 2000; // Send data every 2 seconds

    const detectFrame = async () => {
      if (cocoSsdModel && poseDetector && videoRef.current && isRecording && selectedPandal) {
        const video = videoRef.current;

        if (video.readyState === 4) { // Ensure video is ready
          // COCO-SSD for crowd count
          const cocoPredictions = await cocoSsdModel.detect(video);
          const personCount = cocoPredictions.filter(p => p.class === "person").length;
          setCurrentCrowdCount(personCount);

          // MoveNet for pose detection (for fight detection)
          const poses = await poseDetector.estimatePoses(video);

          // Anomaly Detection
          let anomalyDetected = false;
          let anomalyType: string | undefined = undefined;

          // Fire Detection (simplified heuristic)
          const isFire = detectFire(video);
          if (isFire) {
            anomalyDetected = true;
            anomalyType = "fire";
          }

          // Fight Detection (simplified heuristic) - only if no fire and people detected
          if (!isFire && personCount > 1) {
             const isFight = detectFight(poses, previousPosesRef.current, cocoPredictions);
             if (isFight) {
                anomalyDetected = true;
                anomalyType = "fight";
             }
          }
          
          setLatestAnomaly(anomalyType); // Update UI with latest anomaly

          const currentTime = Date.now();
          if (currentTime - lastDetectionTime > detectionInterval) {
            lastDetectionTime = currentTime;
            console.log(`Sending crowd data for ${selectedPandal.name}: ${personCount}, Anomaly: ${anomalyType || 'None'}`);
            const crowdDensity = selectedPandal.capacity > 0 ? personCount / selectedPandal.capacity : 0;
            recordCrowdData({
              pandalId: selectedPandal._id,
              peopleCount: personCount,
              crowdDensity: crowdDensity,
              anomalyDetected: anomalyDetected,
              anomalyType: anomalyType,
            });
          }

          previousPosesRef.current = poses; // Store current poses for next frame's comparison
        }
      }
      animationFrameId = requestAnimationFrame(detectFrame);
    };

    if (isRecording && selectedPandal && cocoSsdModel && poseDetector) {
      animationFrameId = requestAnimationFrame(detectFrame);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [cocoSsdModel, poseDetector, isRecording, selectedPandal, recordCrowdData]);


  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const getCrowdColor = (level: string) => {
    switch (level) {
      case "low": return "text-green-600 bg-green-100";
      case "medium": return "text-yellow-600 bg-yellow-100";
      case "high": return "text-orange-600 bg-orange-100";
      case "critical": return "text-red-600 bg-red-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  return (
    <div className="h-full flex">
      {/* Camera Feed */}
      <div className="flex-1 bg-black relative">
        {cameraStream ? (
          <div className="relative h-full">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            <canvas
              ref={canvasRef}
              className="hidden"
            />
            
            {/* Camera Controls Overlay */}
            <div className="absolute top-4 left-4 bg-black/70 text-white p-3 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`}></div>
                <span className="text-sm font-medium">
                  {isRecording ? 'Recording' : 'Standby'}
                </span>
              </div>
              {selectedPandal && (
                <div className="text-xs text-gray-300">
                  Monitoring: {selectedPandal.name}
                </div>
              )}
            </div>

            {/* Analysis Results Overlay */}
            {isRecording && selectedPandal && (
              <div className="absolute bottom-4 left-4 bg-black/70 text-white p-3 rounded-lg">
                <div className="text-sm font-medium mb-1">Live Analysis</div>
                <div className="text-xs space-y-1">
                  <div>Detected Crowd: {currentCrowdCount}</div>
                  <div>Capacity: {selectedPandal.capacity}</div>
                  <div className={`inline-block px-2 py-1 rounded text-xs ${getCrowdColor(selectedPandal.crowdLevel)}`}>
                    {selectedPandal.crowdLevel.toUpperCase()}
                  </div>
                </div>
              </div>
            )}

            {/* Anomaly Alert Overlay */}
            {latestAnomaly && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-800/50 animate-pulse">
                <div className="text-white text-3xl font-bold flex items-center gap-4">
                  🚨 {latestAnomaly.toUpperCase()} DETECTED! 🚨
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-white">
            <div className="text-center">
              <div className="text-6xl mb-4">📹</div>
              <h3 className="text-xl font-semibold mb-2">Camera Not Active</h3>
              <p className="text-gray-300 mb-4">Start camera to begin crowd monitoring</p>
              <button
                onClick={startCamera}
                disabled={!cocoSsdModel || !poseDetector || !selectedPandal}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cocoSsdModel && poseDetector ? "Start Camera" : "Loading AI Models..."}
              </button>
              {(!cocoSsdModel || !poseDetector) && (
                <p className="text-xs text-gray-400 mt-2">Please wait while AI models load (COCO-SSD, MoveNet)...</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Control Panel */}
      <div className="w-80 bg-white border-l overflow-y-auto">
        <div className="p-4">
          <h2 className="text-xl font-bold mb-4">📹 Live Camera Feed</h2>
          
          {/* Camera Controls */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-3">Camera Controls</h3>
            <div className="space-y-2">
              {cameraStream ? (
                <>
                  <button
                    onClick={() => setIsRecording(!isRecording)}
                    disabled={!selectedPandal}
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${isRecording 
                        ? 'bg-red-600 text-white hover:bg-red-700' 
                        : 'bg-green-600 text-white hover:bg-green-700'}
                     disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {isRecording ? '⏹️ Stop Recording' : '▶️ Start Recording'}
                  </button>
                  <button
                    onClick={stopCamera}
                    className="w-full py-2 px-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    📷 Stop Camera
                  </button>
                </>
              ) : (
                <button
                  onClick={startCamera}
                  disabled={!cocoSsdModel || !poseDetector || !selectedPandal}
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {cocoSsdModel && poseDetector ? "Start Camera" : "Loading AI Models..."}
                </button>
              )}
            </div>
            {!selectedPandal && cameraStream && (
              <p className="text-xs text-gray-500 mt-2">
                Select a pandal to start recording
              </p>
            )}
          </div>

          {/* Pandal Selection */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-3">Select Pandal to Monitor</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {pandals.map((pandal) => (
                <div
                  key={pandal._id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedPandal?._id === pandal._id 
                      ? "border-blue-500 bg-blue-50" 
                      : "hover:bg-gray-100"}
                  `}
                  onClick={() => setSelectedPandal(pandal)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{pandal.name}</span>
                    <span className={`px-2 py-1 rounded text-xs ${getCrowdColor(pandal.crowdLevel)}`}>
                      {pandal.crowdLevel}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mt-1">{pandal.currentCrowd}/{pandal.capacity} people</p>
                </div>
              ))}
            </div>
          </div>

          {/* Selected Pandal Info */}
          {selectedPandal && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">Currently Monitoring</h3>
              <div className="space-y-2 text-sm">
                <div><strong>Name:</strong> {selectedPandal.name}</div>
                <div><strong>Address:</strong> {selectedPandal.address}</div>
                <div><strong>Current Crowd:</strong> {currentCrowdCount}/{selectedPandal.capacity} (Detected)</div>
                {latestAnomaly && (
                    <div className="text-red-700 font-bold mt-2">🚨 Anomaly: {latestAnomaly.toUpperCase()}</div>
                )}
                <div className="flex items-center gap-2">
                  <strong>Status:</strong>
                  <span className={`px-2 py-1 rounded text-xs ${getCrowdColor(selectedPandal.crowdLevel)}`}>
                    {selectedPandal.crowdLevel.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-800 mb-2">📋 Instructions</h3>
            <ul className="text-xs text-yellow-700 space-y-1">
              <li>1. Select a pandal to monitor.</li>
              <li>2. Click "Start Camera" to begin crowd detection.</li>
              <li>3. The system will auto-detect crowd levels and generate alerts for overcrowding, fights, and fire.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
