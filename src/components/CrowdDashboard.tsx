import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { PandalMap, PandalMapProps } from "./PandalMap";
import { CrowdStats } from "./CrowdStats";
import { AlertPanel } from "./AlertPanel";
import { RoutePanel, RoutePanelProps } from "./RoutePanel";
import { CameraPanel } from "./CameraPanel";

export function CrowdDashboard() {
  const [activeTab, setActiveTab] = useState<"map" | "routes" | "alerts" | "camera">("map");
  const pandals = useQuery(api.pandals.list, {}) || [];
  const crowdStats = useQuery(api.pandals.getCrowdStats);
  // The activeAlerts now include pandal data
  const activeAlerts = useQuery(api.alerts.getActiveAlerts) || [];
  const initializeSampleData = useMutation(api.sampleData.initializeSampleData);
  const simulateCrowdUpdates = useAction(api.crowdData.simulateCrowdUpdates);
  const [mapRoutePandalIds, setMapRoutePandalIds] = useState<Id<"pandals">[]>([]);
  const [routeItinerary, setRouteItinerary] = useState<any | null>(null);
  const [selectedPandalForMap, setSelectedPandalForMap] = useState<Id<"pandals"> | null>(null); // New state for linking alerts to map
  const initializeSampleAlerts = useMutation(api.sampleData.initializeSampleAlerts); // New mutation call

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
      <div className="flex-1 overflow-hidden">
        {activeTab === "map" && <PandalMap {...{pandals, externalRoutePandalIds: mapRoutePandalIds, setMapRoutePandalIds, setRouteItinerary, selectedPandalForMap, setSelectedPandalForMap}} />}
        {activeTab === "routes" && <RoutePanel {...{pandals, setMapRoutePandalIds, routeItinerary}} />}
        {activeTab === "camera" && <CameraPanel pandals={pandals} />}
        {activeTab === "alerts" && <AlertPanel alerts={activeAlerts} onSelectPandalForMap={setSelectedPandalForMap} onSetActiveTab={setActiveTab} />}
      </div>
    </div>
  );
}
