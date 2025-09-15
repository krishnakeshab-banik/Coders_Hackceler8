import { useState, useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import 'leaflet-routing-machine';
import 'leaflet.heat'; // Import for side effects
import { useMap } from 'react-leaflet';
import { useQuery } from "convex/react";

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

export interface PandalMapProps {
  pandals: Pandal[];
  externalRoutePandalIds?: Id<"pandals">[];
  setMapRoutePandalIds?: React.Dispatch<React.SetStateAction<Id<"pandals">[]>>;
  setRouteItinerary?: React.Dispatch<React.SetStateAction<any | null>>;
  selectedPandalForMap?: Id<"pandals"> | null; // Added this prop
  setSelectedPandalForMap?: React.Dispatch<React.SetStateAction<Id<"pandals"> | null>>; // Added this prop
}

// Custom Heatmap Layer Component
interface CustomHeatmapLayerProps {
  points: [number, number, number][]; // [lat, lng, intensity]
  options?: L.HeatLayerOptions;
}

function CustomHeatmapLayer({ points, options }: CustomHeatmapLayerProps) {
  const map = useMap();
  const heatLayerRef = useRef<L.HeatLayer | null>(null);

  useEffect(() => {
    if (!map) return;

    if (!heatLayerRef.current) {
      heatLayerRef.current = (L.heatLayer as any)(points, options).addTo(map);
    } else {
      heatLayerRef.current.setLatLngs(points);
      if (options) {
        // Need to clear and re-add if options change, or update properties manually
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = (L.heatLayer as any)(points, options).addTo(map);
      }
    }

    return () => {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [map, points, options]);

  return null;
}

export function PandalMap({ pandals, externalRoutePandalIds, setMapRoutePandalIds, setRouteItinerary, selectedPandalForMap, setSelectedPandalForMap }: PandalMapProps) {
  const [selectedPandal, setSelectedPandal] = useState<Pandal | null>(null);
  const [filterLevel, setFilterLevel] = useState<string>("all");
  const [routeMode, setRouteMode] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Id<"pandals">[]>([]);
  const [routeName, setRouteName] = useState("");
  const [showRoutePreview, setShowRoutePreview] = useState(false);
  
  const createRoute = useMutation(api.routes.create);
  const crowdDataForHeatmap = useQuery(api.crowdData.getLatestCrowdDataForAllPandals);

  const mapRef = useRef<L.Map>(null);
  const routingControlRef = useRef<L.Routing.Control | null>(null);

  // Log pandal locations for debugging
  useEffect(() => {
    if (pandals.length > 0) {
      console.log("All Pandals and their locations:", pandals.map(p => ({ name: p.name, lat: p.location.lat, lng: p.location.lng })));
      const bagbazar = pandals.find(p => p.name === "Bagbazar Sarbojanin");
      if (bagbazar) {
        console.log("Bagbazar Sarbojanin Location:", `Lat: ${bagbazar.location.lat}, Lng: ${bagbazar.location.lng}`);
      }
    }
  }, [pandals]);

  useEffect(() => {
    if (!mapRef.current || !externalRoutePandalIds || !routeMode) {
      if (routingControlRef.current) {
        mapRef.current?.removeControl(routingControlRef.current);
        routingControlRef.current = null;
        setRouteItinerary?.(null);
      }
      return;
    }

    const routePandals = externalRoutePandalIds.map(id =>
      pandals.find(p => p._id === id)
    ).filter(Boolean);

    if (routePandals.length < 2) {
      if (routingControlRef.current) {
        mapRef.current?.removeControl(routingControlRef.current);
        routingControlRef.current = null;
        setRouteItinerary?.(null);
      }
      return;
    }

    const waypoints = routePandals.map(pandal => L.latLng(pandal!.location.lat, pandal!.location.lng));

    if (routingControlRef.current) {
      routingControlRef.current.setWaypoints(waypoints);
    } else {
      const routingControl = L.Routing.control({
        waypoints: waypoints,
        routeWhileDragging: true,
        show: false, // Don't show the default itinerary panel
        addWaypoints: false,
        fitSelectedRoutes: true,
        lineOptions: {
          styles: [
            { color: 'black', opacity: 0.6, weight: 9 }, // Border
            { color: '#3B82F6', opacity: 1, weight: 5 } // Main route
          ]
        }
      }).addTo(mapRef.current);

      routingControl.on('routesfound', (e) => {
        const routes = e.routes;
        if (routes && routes.length > 0) {
          const summary = routes[0].summary;
          const instructions = routes[0].instructions.map((instruction: any) => ({ // Explicitly type instruction as any
            text: instruction.text,
            distance: instruction.distance,
            time: instruction.time,
          }));
          setRouteItinerary?.({ summary, instructions });
        }
      });

      routingControlRef.current = routingControl;
    }

    return () => {
      if (routingControlRef.current) {
        mapRef.current?.removeControl(routingControlRef.current);
        routingControlRef.current = null;
        setRouteItinerary?.(null);
      }
    };
  }, [mapRef, externalRoutePandalIds, pandals, routeMode, setRouteItinerary]);

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
      const currentRoute = externalRoutePandalIds !== undefined ? externalRoutePandalIds : selectedRoute;
      const setter = externalRoutePandalIds !== undefined ? setMapRoutePandalIds : setSelectedRoute;

      if (setter) {
        if (currentRoute.includes(pandal._id)) {
          setter(prev => prev.filter(id => id !== pandal._id));
        } else {
          setter(prev => [...prev, pandal._id]);
        }
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
    const routeToCheck = externalRoutePandalIds && routeMode ? externalRoutePandalIds : selectedRoute;
    return routeToCheck.indexOf(pandalId) + 1;
  };

  return (
    <div className="h-full flex">
      {/* Map Area */}
      <div className="flex-1 relative overflow-hidden">
        <MapContainer center={[22.5726, 88.3639]} zoom={12} scrollWheelZoom={true} className="h-full w-full" ref={mapRef}> {/* Changed zoom from 13 to 12 */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          {/* Heatmap Layer */}
          {crowdDataForHeatmap && crowdDataForHeatmap.length > 0 && (
            <CustomHeatmapLayer 
              points={crowdDataForHeatmap.map(data => [data.lat, data.lng, data.intensity]) as [number, number, number][]}
              options={{ radius: 25, blur: 15, max: 1.0 }}
            />
          )}

          {/* Route Lines handled by leaflet-routing-machine */}

          {/* Pandal Markers */}
          {filteredPandals.map((pandal) => {
            const isInRoute = (routeMode && selectedRoute.includes(pandal._id)) || (externalRoutePandalIds && externalRoutePandalIds.includes(pandal._id));
            const isSelected = selectedPandalForMap === pandal._id; // Check if this pandal should be specifically highlighted
            const routeOrder = getRouteOrder(pandal._id);
            
            const customIcon = L.divIcon({
              className: `custom-pandal-icon ${isInRoute ? 'bg-blue-600 ring-4 ring-blue-300' : getCrowdColor(pandal.crowdLevel)} ${isSelected ? 'ring-4 ring-purple-500 animate-pulse-subtle-once' : ''}`,
              html: `
                <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg ">
                  ${isInRoute ? `<span class="text-sm font-bold">${routeOrder}</span>` : `<span class="text-xs">${getCrowdIcon(pandal.crowdLevel)}</span>`}
                </div>
                <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-white px-2 py-1 rounded shadow text-xs whitespace-nowrap z-50">
                  ${pandal.name}
                  ${isInRoute ? `<span class="ml-1 text-blue-600 font-bold">#${routeOrder}</span>` : ''}
                </div>
              `,
              iconSize: [40, 40],
              iconAnchor: [20, 40],
              popupAnchor: [0, -40],
            });

            return (
              <Marker
                key={pandal._id}
                position={[pandal.location.lat, pandal.location.lng]}
                icon={customIcon}
                eventHandlers={{
                  click: () => handlePandalClick(pandal),
                }}
              >
                <Popup>
                  <div className="font-bold text-lg mb-1">{pandal.name}</div>
                  <div className={`capitalize font-medium ${getCrowdColor(pandal.crowdLevel).replace('bg', 'text')}`}>{pandal.crowdLevel} Crowd</div>
                  <div className="text-sm text-gray-600 mt-1">Current: {pandal.currentCrowd}/{pandal.capacity}</div>
                  <div className="text-xs text-gray-500">{pandal.address}</div>
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>

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
