import React, { useState, useEffect, useRef } from 'react';

interface RouteStep {
  text: string;
  distance: number;
  time: number;
}

interface RouteItinerary {
  summary: { totalDistance: number; totalTime: number; };
  instructions: RouteStep[];
}

interface RouteChatbotProps {
  routeItinerary: RouteItinerary | null;
}

export function RouteChatbot({ routeItinerary }: RouteChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
    // Reset step index when route itinerary changes or chatbot is closed
    if (!isOpen || !routeItinerary) {
      setCurrentStepIndex(0);
    }
  }, [isOpen, routeItinerary]);

  const getDirectionIcon = (text: string) => {
    text = text.toLowerCase();
    if (text.includes("left")) return "⬅️";
    if (text.includes("right")) return "➡️";
    if (text.includes("arrive") || text.includes("destination")) return "🏁";
    if (text.includes("straight") || text.includes("continue")) return "⬆️";
    return "📍";
  };

  const handleNextStep = () => {
    if (routeItinerary && currentStepIndex < routeItinerary.instructions.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  if (!routeItinerary) return null; // Only show chatbot if there's an active route

  const currentStep = routeItinerary.instructions[currentStepIndex];

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="bg-blue-600 text-white rounded-full p-4 shadow-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-label={isOpen ? "Close chatbot" : "Open chatbot"}
      >
        {isOpen ? "❌" : "💬"}
      </button>

      {isOpen && (
        <div className="bg-white rounded-lg shadow-xl w-80 max-h-[80vh] flex flex-col mt-4 overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b bg-blue-600 text-white rounded-t-lg">
            <h3 className="font-semibold text-lg">Route Guide</h3>
            <button onClick={() => setIsOpen(false)} className="text-white hover:text-blue-100 p-1 rounded-full hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-300">
              ❌
            </button>
          </div>

          <div ref={chatContainerRef} className="p-4 flex-1 overflow-y-auto text-sm space-y-3">
            {/* Chatbot Intro */}
            <div className="bg-gray-100 p-3 rounded-lg self-start text-gray-800">
              <p className="font-semibold mb-1">Hi there! I'm your route assistant. Here's your current itinerary:</p>
              <p>Total Distance: <span className="font-semibold">{(routeItinerary.summary.totalDistance / 1000).toFixed(1)} km</span></p>
              <p>Estimated Time: <span className="font-semibold">{(routeItinerary.summary.totalTime / 60).toFixed(0)} min</span></p>
            </div>
            
            {/* Current Step */}
            {currentStep && (
              <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500 shadow-sm">
                <p className="font-medium text-blue-800 flex items-center gap-2 text-base">
                  <span className="flex-shrink-0">{getDirectionIcon(currentStep.text)}</span>
                  <span>{currentStep.text}</span>
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  <span className="font-semibold">{(currentStep.distance / 1000).toFixed(2)} km</span>
                  <span className="mx-1">•</span>
                  <span className="font-semibold">{(currentStep.time / 60).toFixed(0)} min</span>
                </p>
              </div>
            )}

            {/* Navigation Controls for steps */}
            <div className="flex justify-between items-center pt-2">
              <button
                onClick={handlePreviousStep}
                disabled={currentStepIndex === 0}
                className="bg-gray-200 text-gray-700 px-3 py-1 rounded-lg text-sm hover:bg-gray-300 disabled:opacity-50"
              >
                ⬅️ Previous
              </button>
              <span className="text-sm text-gray-600">Step {currentStepIndex + 1} of {routeItinerary.instructions.length}</span>
              <button
                onClick={handleNextStep}
                disabled={currentStepIndex === routeItinerary.instructions.length - 1}
                className="bg-gray-200 text-gray-700 px-3 py-1 rounded-lg text-sm hover:bg-gray-300 disabled:opacity-50"
              >
                Next ➡️
              </button>
            </div>

            {currentStepIndex === routeItinerary.instructions.length - 1 && (
                <div className="bg-green-100 p-3 rounded-lg text-center text-green-800 font-semibold">
                    🏁 You have arrived at your final destination!
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
