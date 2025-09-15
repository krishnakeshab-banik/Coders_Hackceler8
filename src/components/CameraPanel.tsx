import { useState, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const recordCrowdData = useMutation(api.crowdData.recordCrowdData);

  // Start camera stream
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 },
        audio: false 
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
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
  };

  // Simulate crowd detection from camera feed
  const analyzeCrowdFromCamera = () => {
    if (!selectedPandal || !videoRef.current || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = videoRef.current;

    if (ctx && video.videoWidth > 0) {
      // Draw current video frame to canvas
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);

      // Simulate crowd detection (in real app, this would use AI/ML)
      const simulatedPeopleCount = Math.floor(Math.random() * selectedPandal.capacity);
      const crowdDensity = simulatedPeopleCount / 100; // Simplified density calculation
      const anomalyDetected = Math.random() < 0.1; // 10% chance of anomaly

      // Record the crowd data
      recordCrowdData({
        pandalId: selectedPandal._id,
        peopleCount: simulatedPeopleCount,
        crowdDensity,
        queueLength: Math.floor(Math.random() * 20),
        waitTime: Math.floor(Math.random() * 15),
        anomalyDetected,
        anomalyType: anomalyDetected ? "overcrowding" : undefined,
      });
    }
  };

  // Auto-analyze every 10 seconds when recording
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRecording && selectedPandal) {
      interval = setInterval(analyzeCrowdFromCamera, 10000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, selectedPandal]);

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
                  <div>Current Crowd: {selectedPandal.currentCrowd}</div>
                  <div>Capacity: {selectedPandal.capacity}</div>
                  <div className={`inline-block px-2 py-1 rounded text-xs ${getCrowdColor(selectedPandal.crowdLevel)}`}>
                    {selectedPandal.crowdLevel.toUpperCase()}
                  </div>
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
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Start Camera
              </button>
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
                    className={`w-full py-2 px-4 rounded-lg font-medium transition-colors ${
                      isRecording 
                        ? 'bg-red-600 text-white hover:bg-red-700' 
                        : 'bg-green-600 text-white hover:bg-green-700'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
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
                  className="w-full py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  📷 Start Camera
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
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedPandal?._id === pandal._id 
                      ? "border-blue-500 bg-blue-50" 
                      : "hover:bg-gray-100"
                  }`}
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
                <div><strong>Current Crowd:</strong> {selectedPandal.currentCrowd}/{selectedPandal.capacity}</div>
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
              <li>1. Select a pandal to monitor</li>
              <li>2. Start the camera feed</li>
              <li>3. Begin recording for crowd analysis</li>
              <li>4. System will auto-detect crowd levels</li>
              <li>5. Alerts will be generated for anomalies</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
