import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { PandalMap, PandalMapProps } from "./PandalMap";
import { CrowdStats } from "./CrowdStats";
import { AlertPanel } from "./AlertPanel";
import { RoutePanel, RoutePanelProps } from "./RoutePanel";
import { CameraPanel } from "./CameraPanel";
import { RouteChatbot } from "./RouteChatbot";
import { Pandal } from "../../convex/_generated/dataModel"; // Added import for Pandal type

export function CrowdDashboard() {
  const [activeTab, setActiveTab] = useState<"map" | "routes" | "alerts" | "camera">("map");
  const pandals = useQuery(api.pandals.list, {}) || [];
  const crowdStats = useQuery(api.pandals.getCrowdStats);
  const activeAlerts = useQuery(api.alerts.getActiveAlerts) || [];
  const initializeSampleData = useMutation(api.sampleData.initializeSampleData);
  const simulateCrowdUpdates = useAction(api.crowdData.simulateCrowdUpdates);
  const [mapRoutePandalIds, setMapRoutePandalIds] = useState<Id<"pandals">[]>([]);
  const [routeItinerary, setRouteItinerary] = useState<any | null>(null);
  const [selectedPandalForMap, setSelectedPandalForMap] = useState<Id<"pandals"> | null>(null);
  const initializeSampleAlerts = useMutation(api.sampleData.initializeSampleAlerts);

  // States for PandalMap controls
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [routeMode, setRouteMode] = useState(false);
  const [isMapLocked, setIsMapLocked] = useState(false);
  const [selectedPandalForDetails, setSelectedPandalForDetails] = useState<Pandal | null>(null); // To display details in sidebar

  // Filtered pandals to pass to PandalMap (based on filterLevel)
  const filteredPandalsForMap = filterLevel === "all" 
    ? pandals 
    : pandals.filter(p => p.crowdLevel === filterLevel);

  // Helper functions for map controls (copied from PandalMap, now managed here)
  const getCrowdColor = (level: string) => {
    switch (level) {
      case "low": return "bg-green-500";
      case "medium": return "bg-yellow-500";
      case "high": return "bg-orange-500";
      case "critical": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getCrowdIcon = (level: string) => {
    switch (level) {
      case "low": return "😊";
      case "medium": return "😐";
      case "high": return "😰";
      case "critical": return "🚨";
      default: return "❓";
    }
  };

  // Initialize sample data on first load
  useEffect(() => {
    if (pandals.length === 0) {
      initializeSampleData();
    }
  }, [pandals.length, initializeSampleData]);

  // Simulate crowd updates every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      if (pandals.length > 0) {
        simulateCrowdUpdates();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [pandals.length, simulateCrowdUpdates]);

  const tabs = [
    { id: "map", label: "Live Map", icon: "🗺️" },
    { id: "routes", label: "Route Planner", icon: "🛣️" },
    { id: "camera", label: "Live Camera", icon: "📹" },
    { id: "alerts", label: "Alerts", icon: "🚨", count: activeAlerts.length },
  ];

  return (
    <div className="h-screen flex flex-col">
      {/* Stats Bar */}
      <div className="bg-white border-b p-4">
        <CrowdStats stats={crowdStats} />
        {/* Temporary button to initialize sample alerts */}
        <button
          onClick={() => initializeSampleAlerts()}
          className="ml-4 px-3 py-1 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 transition-colors"
        >
          Initialize Sample Alerts (Temporary)
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b">
        <div className="flex">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors ${
                activeTab === tab.id
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "map" && (
          <div className="flex h-full">
            {/* Map Component */}
            <div className="flex-1">
              <PandalMap 
                pandals={filteredPandalsForMap} // Pass filtered pandals
                externalRoutePandalIds={mapRoutePandalIds}
                setMapRoutePandalIds={setMapRoutePandalIds}
                setRouteItinerary={setRouteItinerary}
                selectedPandalForMap={selectedPandalForMap}
                setSelectedPandalForMap={setSelectedPandalForMap}
                filterLevel={filterLevel} // Pass down state
                setFilterLevel={setFilterLevel} // Pass down setter
                routeMode={routeMode} // Pass down state
                setRouteMode={setRouteMode} // Pass down setter
                isMapLocked={isMapLocked} // Pass down state
                setIsMapLocked={setIsMapLocked} // Pass down setter
                setSelectedPandalForDetails={setSelectedPandalForDetails} // Pass setter for details sidebar
                getCrowdColor={getCrowdColor} // Pass helper function
                getCrowdIcon={getCrowdIcon} // Pass helper function
              />
            </div>

            {/* Map Controls Sidebar */}
            <div className="w-80 bg-white border-l overflow-y-auto p-4">
              <h3 className="text-xl font-bold mb-4">🗺️ Map Controls</h3>
              
              {/* Map Lock Toggle */}
              <div className="bg-gray-50 rounded-lg p-3 shadow-sm mb-4">
                <h4 className="font-semibold mb-2">Map Interactions</h4>
                <button
                  onClick={() => setIsMapLocked(!isMapLocked)}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-gray-200 text-gray-700 hover:bg-gray-300"
                >
                  {isMapLocked ? '🔒 Unlock Map' : '🔓 Lock Map'}
                </button>
              </div>

              {/* Route Mode Toggle */}
              <div className="bg-blue-50 rounded-lg p-3 shadow-sm mb-4">
                <h4 className="font-semibold mb-2">Route Planning</h4>
                <button
                  onClick={() => setRouteMode(!routeMode)}
                  className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${routeMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                >
                  {routeMode ? '✅ Exit Route Mode' : '➕ Enter Route Mode'}
                </button>
                {routeMode && (
                  <p className="text-xs text-blue-700 mt-2 text-center">
                    Click on pandal markers to add/remove them from your route.
                  </p>
                )}
              </div>

              {/* Filter by Crowd Level */}
              <div className="bg-gray-50 rounded-lg p-3 shadow-sm mb-4">
                <h4 className="font-semibold mb-2">Filter by Crowd Level</h4>
                <select
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value)}
                  className="w-full p-2 border rounded-lg text-sm"
                >
                  <option value="all">All Pandals ({pandals.length})</option>
                  <option value="low">Low Crowd ({pandals.filter(p => p.crowdLevel === "low").length})</option>
                  <option value="medium">Medium Crowd ({pandals.filter(p => p.crowdLevel === "medium").length})</option>
                  <option value="high">High Crowd ({pandals.filter(p => p.crowdLevel === "high").length})</option>
                  <option value="critical">Critical ({pandals.filter(p => p.crowdLevel === "critical").length})</option>
                </select>
              </div>

              {/* Legend */}
              <div className="bg-gray-50 rounded-lg p-3 shadow-sm mb-4">
                <h4 className="font-semibold mb-2">Crowd Levels Legend</h4>
                <div className="space-y-2">
                  {[
                    { level: "low", label: "Low Crowd", icon: "😊" },
                    { level: "medium", label: "Medium Crowd", icon: "😐" },
                    { level: "high", label: "High Crowd", icon: "😰" },
                    { level: "critical", label: "Critical", icon: "🚨" },
                  ].map((item) => (
                    <div key={item.level} className="flex items-center gap-2">
                      <div className={`w-4 h-4 rounded-full ${getCrowdColor(item.level)}`}></div>
                      <span className="text-sm">{item.icon} {item.label}</span>
                    </div>
                  ))}
                  {routeMode && (
                    <div className="flex items-center gap-2 pt-2 border-t mt-2">
                      <div className="w-4 h-4 rounded-full bg-blue-600"></div>
                      <span className="text-sm">🛣️ Route Points</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Map Guide / Instructions */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 shadow-sm mb-4">
                <h4 className="font-semibold text-sm text-yellow-800 mb-2">📍 Map Guide</h4>
                <ul className="text-xs space-y-1 text-yellow-700">
                  <li>• Click pandals to view details in the sidebar.</li>
                  <li>• Use filters to find specific crowd levels.</li>
                  <li>• Enable route mode to plan visits.</li>
                  <li>• Numbers show visit order in routes.</li>
                </ul>
              </div>

              {/* Pandal Details Section */}
              {selectedPandalForDetails && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm">
                    <h4 className="font-semibold text-blue-800 mb-2">{selectedPandalForDetails.name}</h4>
                    <div className="space-y-2 text-sm">
                        <div><strong>Address:</strong> {selectedPandalForDetails.address}</div>
                        <div><strong>Current Crowd:</strong> {selectedPandalForDetails.currentCrowd}/{selectedPandalForDetails.capacity}</div>
                        <div className="flex items-center gap-2">
                            <strong>Status:</strong>
                            <span className={`px-2 py-1 rounded text-xs ${getCrowdColor(selectedPandalForDetails.crowdLevel)}`}>
                                {selectedPandalForDetails.crowdLevel.toUpperCase()}
                            </span>
                        </div>
                    </div>
                    {/* Add more details or actions here if needed */}
                </div>
              )}

            </div>
          </div>
        )}
        {activeTab === "routes" && <RoutePanel {...{pandals, setMapRoutePandalIds, routeItinerary}} />}
        {activeTab === "camera" && <CameraPanel pandals={pandals} />}
        {activeTab === "alerts" && <AlertPanel alerts={activeAlerts} onSelectPandalForMap={setSelectedPandalForMap} onSetActiveTab={setActiveTab} />}
        
        {/* Route Chatbot (always visible but collapsible if routeItinerary exists) */}
        <RouteChatbot routeItinerary={routeItinerary} />
      </div>
    </div>
  );
}
