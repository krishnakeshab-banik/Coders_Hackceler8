import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
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

interface RoutePanelProps {
  pandals: Pandal[];
}

export function RoutePanel({ pandals }: RoutePanelProps) {
  const [selectedPandals, setSelectedPandals] = useState<Id<"pandals">[]>([]);
  const [routeName, setRouteName] = useState("");
  const [startLocation, setStartLocation] = useState({ lat: 22.5726, lng: 88.3639 }); // Kolkata
  const [avoidCrowds, setAvoidCrowds] = useState(true);
  const [activeRouteId, setActiveRouteId] = useState<Id<"routes"> | null>(null);

  const createRoute = useMutation(api.routes.create);
  const updateRouteStatus = useMutation(api.routes.updateStatus);
  const userRoutes = useQuery(api.routes.getUserRoutes) || [];
  const optimalRoute = useQuery(api.routes.getOptimalRoute, 
    selectedPandals.length > 0 ? {
      startLocation,
      pandalIds: selectedPandals,
      avoidCrowds,
    } : "skip"
  );

  const handlePandalToggle = (pandalId: Id<"pandals">) => {
    setSelectedPandals(prev => 
      prev.includes(pandalId) 
        ? prev.filter(id => id !== pandalId)
        : [...prev, pandalId]
    );
  };

  const handleCreateRoute = async () => {
    if (selectedPandals.length === 0 || !routeName.trim()) return;
    
    try {
      await createRoute({
        name: routeName,
        startLocation,
        pandalIds: selectedPandals,
      });
      setRouteName("");
      setSelectedPandals([]);
    } catch (error) {
      console.error("Failed to create route:", error);
    }
  };

  const handleStartRoute = async (routeId: Id<"routes">) => {
    try {
      await updateRouteStatus({ id: routeId, status: "active" });
      setActiveRouteId(routeId);
    } catch (error) {
      console.error("Failed to start route:", error);
    }
  };

  const handleCompleteRoute = async (routeId: Id<"routes">) => {
    try {
      await updateRouteStatus({ id: routeId, status: "completed" });
      setActiveRouteId(null);
    } catch (error) {
      console.error("Failed to complete route:", error);
    }
  };

  const getCrowdColor = (level: string) => {
    switch (level) {
      case "low": return "text-green-600 bg-green-100";
      case "medium": return "text-yellow-600 bg-yellow-100";
      case "high": return "text-orange-600 bg-orange-100";
      case "critical": return "text-red-600 bg-red-100";
      default: return "text-gray-600 bg-gray-100";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-600";
      case "active": return "bg-blue-100 text-blue-600";
      default: return "bg-gray-100 text-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return "✅";
      case "active": return "🚶";
      default: return "📋";
    }
  };

  return (
    <div className="h-full flex">
      {/* Route Builder */}
      <div className="w-1/2 p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">🛣️ Route Planner</h2>
        
        {/* Route Settings */}
        <div className="bg-white rounded-lg p-4 shadow mb-6">
          <h3 className="font-semibold mb-4">Route Settings</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Route Name</label>
              <input
                type="text"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="My Pandal Tour"
                className="w-full p-2 border rounded-lg"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="avoidCrowds"
                checked={avoidCrowds}
                onChange={(e) => setAvoidCrowds(e.target.checked)}
                className="rounded"
              />
              <label htmlFor="avoidCrowds" className="text-sm">Avoid crowded pandals</label>
            </div>
          </div>
        </div>

        {/* Pandal Selection */}
        <div className="bg-white rounded-lg p-4 shadow mb-6">
          <h3 className="font-semibold mb-4">Select Pandals ({selectedPandals.length} selected)</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {pandals.map((pandal) => (
              <div
                key={pandal._id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedPandals.includes(pandal._id) 
                    ? "border-blue-500 bg-blue-50" 
                    : "hover:bg-gray-50"
                }`}
                onClick={() => handlePandalToggle(pandal._id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">{pandal.name}</div>
                    <div className="text-sm text-gray-600">{pandal.address}</div>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-medium ${getCrowdColor(pandal.crowdLevel)}`}>
                    {pandal.crowdLevel}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Optimal Route Preview */}
        {optimalRoute && (
          <div className="bg-white rounded-lg p-4 shadow mb-6">
            <h3 className="font-semibold mb-4">📍 Optimized Route</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>Total Distance:</span>
                <span className="font-medium">{optimalRoute.totalDistance} km</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Estimated Time:</span>
                <span className="font-medium">{optimalRoute.estimatedTime} minutes</span>
              </div>
              <div className="border-t pt-3">
                <div className="text-sm font-medium mb-2">Route Order:</div>
                <div className="space-y-1">
                  {optimalRoute.pandals.map((pandal, index) => (
                    <div key={pandal._id} className="flex items-center gap-2 text-sm">
                      <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs">
                        {index + 1}
                      </span>
                      <span>{pandal.name}</span>
                      <span className={`px-1 py-0.5 rounded text-xs ${getCrowdColor(pandal.crowdLevel)}`}>
                        {pandal.crowdLevel}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Route Button */}
        <button
          onClick={handleCreateRoute}
          disabled={selectedPandals.length === 0 || !routeName.trim()}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Create Route
        </button>
      </div>

      {/* Saved Routes */}
      <div className="w-1/2 bg-gray-50 p-6 overflow-y-auto">
        <h2 className="text-2xl font-bold mb-6">📋 My Routes</h2>
        
        {userRoutes.length === 0 ? (
          <div className="text-center text-gray-500 mt-12">
            <div className="text-4xl mb-4">🗺️</div>
            <p>No routes created yet</p>
            <p className="text-sm">Create your first route to get started!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {userRoutes.map((route) => (
              <div key={route._id} className="bg-white rounded-lg p-4 shadow">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{route.name}</h3>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    route.status === "completed" ? "bg-green-100 text-green-600" :
                    route.status === "active" ? "bg-blue-100 text-blue-600" :
                    "bg-gray-100 text-gray-600"
                  }`}>
                    {route.status}
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>📍 {route.pandalIds.length} pandals</div>
                  <div>🚶 {route.totalDistance} km • {route.estimatedTime} min</div>
                  <div>📅 {new Date(route.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
