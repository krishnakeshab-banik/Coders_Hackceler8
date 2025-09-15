import asyncio
import uvicorn
import os
import time

from fastapi import FastAPI, BackgroundTasks, HTTPException
from contextlib import asynccontextmanager

from crowd_detector import CrowdDetector

# --- Configuration (Read from environment variables) ---
CONVEX_HTTP_ENDPOINT = os.environ.get("CONVEX_HTTP_ENDPOINT")
PANDAL_ID = os.environ.get("PANDAL_ID")
CAMERA_INPUT_SOURCE = int(os.environ.get("CAMERA_INPUT_SOURCE", 0)) # Default to webcam 0
DETECTION_INTERVAL_SECONDS = int(os.environ.get("DETECTION_INTERVAL_SECONDS", 5))

# --- Global Detector Instance ---
crowd_detector_instance: CrowdDetector = None
crowd_detection_task: asyncio.Task = None

async def run_detection_in_background():
    """Background task to run crowd detection and send data to Convex."""
    global crowd_detector_instance
    if not crowd_detector_instance:
        # Initialize CrowdDetector without display, as FastAPI will run in background
        crowd_detector_instance = CrowdDetector(
            input_source=CAMERA_INPUT_SOURCE,
            convex_http_endpoint=CONVEX_HTTP_ENDPOINT,
            pandal_id=PANDAL_ID,
            display_output=False # Ensure no OpenCV windows pop up
        )
        if not crowd_detector_instance.start():
            print("ERROR: Failed to start crowd detector in background.")
            return

    while True:
        if crowd_detector_instance.running:
            frame = crowd_detector_instance.video_processor.get_frame(timeout=1.0)
            if frame is not None:
                results = crowd_detector_instance.process_frame(frame)
                crowd_detector_instance._send_data_to_convex(results)
            else:
                print("WARNING: Could not get frame from camera.")
        await asyncio.sleep(DETECTION_INTERVAL_SECONDS)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Context manager for FastAPI application lifespan events."""
    global crowd_detection_task, crowd_detector_instance
    print("Starting FastAPI application lifespan...")

    if not CONVEX_HTTP_ENDPOINT or not PANDAL_ID:
        print("ERROR: CONVEX_HTTP_ENDPOINT or PANDAL_ID environment variables are not set.")
        print("       Crowd detection will not run in the background.")
    else:
        crowd_detection_task = asyncio.create_task(run_detection_in_background())
        print("Crowd detection background task started.")
    
    yield

    print("Stopping FastAPI application lifespan...")
    if crowd_detection_task:
        crowd_detection_task.cancel()
        await asyncio.sleep(0.1) # Give a moment for cancellation
        print("Crowd detection background task cancelled.")
    if crowd_detector_instance:
        crowd_detector_instance.stop()
        print("Crowd detector instance stopped.")
    print("FastAPI application lifespan stopped.")

app = FastAPI(lifespan=lifespan)

@app.get("/status")
async def get_status():
    status = {
        "server_status": "running",
        "crowd_detector_initialized": bool(crowd_detector_instance),
        "crowd_detection_running": crowd_detector_instance.running if crowd_detector_instance else False,
        "convex_endpoint": CONVEX_HTTP_ENDPOINT,
        "pandal_id": PANDAL_ID,
        "camer-input_source": CAMERA_INPUT_SOURCE,
        "detection_interval_seconds": DETECTION_INTERVAL_SECONDS,
        "current_crowd_count": crowd_detector_instance.crowd_analyzer.get_current_count() if crowd_detector_instance and crowd_detector_instance.crowd_analyzer else None
    }
    return status

if __name__ == "__main__":
    # Example usage: uvicorn fastapi_server:app --host 0.0.0.0 --port 8000
    # Ensure CONVEX_HTTP_ENDPOINT and PANDAL_ID are set as environment variables
    if not CONVEX_HTTP_ENDPOINT or not PANDAL_ID:
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        print("WARNING: CONVEX_HTTP_ENDPOINT or PANDAL_ID is not set.")
        print("         Crowd detection will NOT start.")
        print("         Please set them as environment variables or pass as CLI args.")
        print("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!")
        exit(1)
    uvicorn.run(app, host="0.0.0.0", port=8000)
