import { useState } from "react";
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
  festivalType: string;
}

interface PandalMapProps {
  pandals: Pandal[];
}

export function PandalMap({ pandals }: PandalMapProps) {
  const [selectedPandal, setSelectedPandal] = useState<Pandal | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [routeMode, setRouteMode] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Id<"pandals">[]>([]);
  const [routeName, setRouteName] = useState("");
  const [showRoutePreview, setShowRoutePreview] = useState(false);
  
  const createRoute = useMutation(api.routes.create);

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

  const filteredPandals = filterLevel === "all" 
    ? pandals 
    : pandals.filter(p => p.crowdLevel === filterLevel);

  const handlePandalClick = (pandal: Pandal) => {
    if (routeMode) {
      if (selectedRoute.includes(pandal._id)) {
        setSelectedRoute(prev => prev.filter(id => id !== pandal._id));
      } else {
        setSelectedRoute(prev => [...prev, pandal._id]);
      }
    } else {
      setSelectedPandal(pandal);
    }
  };

  const handleCreateRoute = async () => {
    if (selectedRoute.length === 0 || !routeName.trim()) return;
    
    try {
      await createRoute({
        name: routeName,
        startLocation: { lat: 22.5726, lng: 88.3639 }, // Kolkata center
        pandalIds: selectedRoute,
      });
      setRouteName("");
      setSelectedRoute([]);
      setRouteMode(false);
      alert("Route created successfully!");
    } catch (error) {
      console.error("Failed to create route:", error);
      alert("Failed to create route. Please try again.");
    }
  };

  const getRouteOrder = (pandalId: Id<"pandals">) => {
    return selectedRoute.indexOf(pandalId) + 1;
  };

  const drawRouteLine = () => {
    if (selectedRoute.length < 2) return null;
    
    const routePandals = selectedRoute.map(id => 
      filteredPandals.find(p => p._id === id)
    ).filter(Boolean);

    const pathPoints = routePandals.map((pandal, index) => {
      const x = 20 + (filteredPandals.indexOf(pandal!) % 8) * 10;
      const y = 20 + Math.floor(filteredPandals.indexOf(pandal!) / 8) * 15;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        <polyline
          points={pathPoints}
          fill="none"
          stroke="#3B82F6"
          strokeWidth="3"
          strokeDasharray="5,5"
          className="animate-pulse"
        />
      </svg>
    );
  };

  return (
    <div className="h-full flex">
      {/* Map Area */}
      <div className="flex-1 bg-gradient-to-br from-blue-50 to-green-50 relative overflow-hidden">
        {/* Simulated Map Background */}
        <div className="absolute inset-0 opacity-20">
          <div className="w-full h-full bg-gradient-to-br from-green-200 via-blue-200 to-purple-200"></div>
          {/* Grid lines to simulate map */}
          <div className="absolute inset-0" style={{
            backgroundImage: `
              linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
            `,
            backgroundSize: '50px 50px'
          }}></div>
        </div>

        {/* Route Lines */}
        {routeMode && showRoutePreview && drawRouteLine()}

        {/* Pandal Markers */}
        <div className="absolute inset-0 p-8" style={{ zIndex: 2 }}>
          {filteredPandals.map((pandal, index) => {
            const isInRoute = selectedRoute.includes(pandal._id);
            const routeOrder = getRouteOrder(pandal._id);
            
            return (
              <div
                key={pandal._id}
                className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${20 + (index % 8) * 10}%`,
                  top: `${20 + Math.floor(index / 8) * 15}%`,
                }}
                onClick={() => handlePandalClick(pandal)}
              >
                <div className={`w-10 h-10 rounded-full ${
                  isInRoute ? 'bg-blue-600 ring-4 ring-blue-300' : getCrowdColor(pandal.crowdLevel)
                } flex items-center justify-center text-white font-bold shadow-lg hover:scale-110 transition-all duration-200 ${
                  routeMode ? 'hover:ring-4 hover:ring-blue-200' : ''
                }`}>
                  {isInRoute ? (
                    <span className="text-sm font-bold">{routeOrder}</span>
                  ) : (
                    <span className="text-xs">{getCrowdIcon(pandal.crowdLevel)}</span>
                  )}
                </div>
                <div className="absolute top-12 left-1/2 transform -translate-x-1/2 bg-white px-2 py-1 rounded shadow text-xs whitespace-nowrap">
                  {pandal.name}
                  {isInRoute && <span className="ml-1 text-blue-600 font-bold">#{routeOrder}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Route Mode Controls */}
        {routeMode && (
          <div className="absolute top-4 left-4 bg-white rounded-lg p-4 shadow-lg max-w-sm">
            <h3 className="font-semibold mb-3 text-blue-800">🛣️ Route Builder</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Route Name</label>
                <input
                  type="text"
                  value={routeName}
                  onChange={(e) => setRouteName(e.target.value)}
                  placeholder="My Festival Route"
                  className="w-full p-2 border rounded text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="showPreview"
                  checked={showRoutePreview}
                  onChange={(e) => setShowRoutePreview(e.target.checked)}
                />
                <label htmlFor="showPreview" className="text-sm">Show route preview</label>
              </div>
              <div className="text-sm text-gray-600">
                Selected: {selectedRoute.length} pandals
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleCreateRoute}
                  disabled={selectedRoute.length === 0 || !routeName.trim()}
                  className="flex-1 bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Create Route
                </button>
                <button
                  onClick={() => {
                    setRouteMode(false);
                    setSelectedRoute([]);
                    setRouteName("");
                    setShowRoutePreview(false);
                  }}
                  className="px-3 py-2 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-white rounded-lg p-4 shadow-lg">
          <h3 className="font-semibold mb-2">Crowd Levels</h3>
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
              <div className="flex items-center gap-2 pt-2 border-t">
                <div className="w-4 h-4 rounded-full bg-blue-600"></div>
                <span className="text-sm">🛣️ Route Points</span>
              </div>
            )}
          </div>
        </div>

        {/* Map Instructions */}
        <div className="absolute top-4 right-4 bg-white rounded-lg p-3 shadow-lg max-w-xs">
          <h4 className="font-semibold text-sm mb-2">📍 Map Guide</h4>
          <ul className="text-xs space-y-1 text-gray-600">
            <li>• Click pandals to view details</li>
            <li>• Use filters to find specific crowd levels</li>
            <li>• Enable route mode to plan visits</li>
            <li>• Numbers show visit order in routes</li>
          </ul>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-80 bg-white border-l overflow-y-auto">
        {/* Mode Toggle */}
        <div className="p-4 border-b bg-gray-50">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setRouteMode(false);
                setSelectedRoute([]);
                setShowRoutePreview(false);
              }}
              className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                !routeMode 
                  ? "bg-blue-600 text-white" 
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              🗺️ Explore
            </button>
            <button
              onClick={() => setRouteMode(true)}
              className={`flex-1 py-2 px-3 rounded text-sm font-medium transition-colors ${
                routeMode 
                  ? "bg-blue-600 text-white" 
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              🛣️ Plan Route
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="p-4 border-b">
          <h3 className="font-semibold mb-3">Filter by Crowd Level</h3>
          <select
            value={filterLevel}
            onChange={(e) => setFilterLevel(e.target.value)}
            className="w-full p-2 border rounded-lg"
          >
            <option value="all">All Pandals ({pandals.length})</option>
            <option value="low">Low Crowd ({pandals.filter(p => p.crowdLevel === "low").length})</option>
            <option value="medium">Medium Crowd ({pandals.filter(p => p.crowdLevel === "medium").length})</option>
            <option value="high">High Crowd ({pandals.filter(p => p.crowdLevel === "high").length})</option>
            <option value="critical">Critical ({pandals.filter(p => p.crowdLevel === "critical").length})</option>
          </select>
        </div>

        {/* Content based on mode */}
        {routeMode ? (
          <div className="p-4">
            <h3 className="font-semibold mb-3">🛣️ Route Planning</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800">
                Click on pandals in the map to add them to your route. The numbers show the visit order.
              </p>
            </div>
            
            {selectedRoute.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Selected Pandals ({selectedRoute.length})</h4>
                {selectedRoute.map((pandalId, index) => {
                  const pandal = pandals.find(p => p._id === pandalId);
                  if (!pandal) return null;
                  
                  return (
                    <div key={pandalId} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                      <span className="w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </span>
                      <div className="flex-1">
                        <div className="font-medium text-sm">{pandal.name}</div>
                        <div className="text-xs text-gray-600">{pandal.crowdLevel} crowd</div>
                      </div>
                      <button
                        onClick={() => setSelectedRoute(prev => prev.filter(id => id !== pandalId))}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
                
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm space-y-1">
                    <div>📍 Total Stops: {selectedRoute.length}</div>
                    <div>🚶 Estimated Time: {selectedRoute.length * 45} minutes</div>
                    <div>📏 Estimated Distance: {selectedRoute.length * 2} km</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Pandal Details */
          selectedPandal ? (
            <div className="p-4">
              <h3 className="font-bold text-lg mb-2">{selectedPandal.name}</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className={`w-3 h-3 rounded-full ${getCrowdColor(selectedPandal.crowdLevel)}`}></span>
                  <span className="capitalize font-medium">{selectedPandal.crowdLevel} Crowd</span>
                </div>
                <div>
                  <span className="text-gray-600">Current Visitors:</span>
                  <span className="font-semibold ml-2">{selectedPandal.currentCrowd}/{selectedPandal.capacity}</span>
                </div>
                <div>
                  <span className="text-gray-600">Address:</span>
                  <p className="text-sm mt-1">{selectedPandal.address}</p>
                </div>
                <div>
                  <span className="text-gray-600">Festival:</span>
                  <span className="ml-2 capitalize">{selectedPandal.festivalType.replace('_', ' ')}</span>
                </div>
                <div className="pt-2">
                  <div className="bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full ${getCrowdColor(selectedPandal.crowdLevel)}`}
                      style={{ width: `${(selectedPandal.currentCrowd / selectedPandal.capacity) * 100}%` }}
                    ></div>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {Math.round((selectedPandal.currentCrowd / selectedPandal.capacity) * 100)}% capacity
                  </p>
                </div>
                
                {/* Quick Actions */}
                <div className="pt-3 border-t space-y-2">
                  <button
                    onClick={() => {
                      setRouteMode(true);
                      setSelectedRoute([selectedPandal._id]);
                      setSelectedPandal(null);
                    }}
                    className="w-full bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700"
                  >
                    🛣️ Start Route from Here
                  </button>
                  <div className="grid grid-cols-2 gap-2">
                    <button className="bg-green-600 text-white py-1 px-2 rounded text-xs hover:bg-green-700">
                      📍 Get Directions
                    </button>
                    <button className="bg-orange-600 text-white py-1 px-2 rounded text-xs hover:bg-orange-700">
                      📱 Share Location
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <h3 className="font-semibold mb-3">Pandal List</h3>
              <div className="space-y-2">
                {filteredPandals.slice(0, 10).map((pandal) => (
                  <div
                    key={pandal._id}
                    className="p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setSelectedPandal(pandal)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{pandal.name}</span>
                      <span className={`w-3 h-3 rounded-full ${getCrowdColor(pandal.crowdLevel)}`}></span>
                    </div>
                    <p className="text-sm text-gray-600">{pandal.currentCrowd}/{pandal.capacity} visitors</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-xs">{getCrowdIcon(pandal.crowdLevel)}</span>
                      <span className="text-xs text-gray-500 capitalize">{pandal.crowdLevel}</span>
                    </div>
                  </div>
                ))}
                {filteredPandals.length > 10 && (
                  <div className="text-center text-sm text-gray-500 py-2">
                    ... and {filteredPandals.length - 10} more pandals
                  </div>
                )}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
