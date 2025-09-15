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
  selectedPandalForMap?: Id<"pandals"> | null;
  setSelectedPandalForMap?: React.Dispatch<React.SetStateAction<Id<"pandals"> | null>>;
  // New props for controls/filters managed in CrowdDashboard
  filterLevel: string;
  setFilterLevel: React.Dispatch<React.SetStateAction<string>>;
  routeMode: boolean;
  setRouteMode: React.Dispatch<React.SetStateAction<boolean>>;
  isMapLocked: boolean;
  setIsMapLocked: React.Dispatch<React.SetStateAction<boolean>>;
  setSelectedPandalForDetails: React.Dispatch<React.SetStateAction<Pandal | null>>;
  getCrowdColor: (level: string) => string; // New prop
  getCrowdIcon: (level: string) => string; // New prop
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

export function PandalMap({
  pandals,
  externalRoutePandalIds,
  setMapRoutePandalIds,
  setRouteItinerary,
  selectedPandalForMap,
  setSelectedPandalForMap,
  filterLevel, // Destructure new props
  setFilterLevel, // Destructure new props
  routeMode, // Destructure new props
  setRouteMode, // Destructure new props
  isMapLocked, // Destructure new props
  setIsMapLocked, // Destructure new props
  setSelectedPandalForDetails, // Destructure new prop
  getCrowdColor, // Destructure new prop
  getCrowdIcon, // Destructure new prop
}: PandalMapProps) {
  const [selectedPandal, setSelectedPandal] = useState<Pandal | null>(null);
  // Removed local filterLevel, routeMode, isMapLocked states
  const [selectedRoute, setSelectedRoute] = useState<Id<"pandals">[]>([]); // Keep local selectedRoute for map clicks
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
    // Ensure the map is available
    if (!mapRef.current) {
      return;
    }

    // Initialize routing control only once
    if (!routingControlRef.current) {
      // Create a dummy div to serve as a container for the routing control
      // This prevents the control from rendering its default UI on the map.
      const routingContainer = L.DomUtil.create('div');

      routingControlRef.current = L.Routing.control({
        waypoints: [], // Initialize with empty waypoints
        routeWhileDragging: false,
        show: false,
        addWaypoints: false,
        fitSelectedRoutes: false,
        collapsed: true,
        alt: '',
        lineOptions: {
          styles: [
            { color: 'black', opacity: 0.6, weight: 9 }, // Border
            { color: '#3B82F6', opacity: 1, weight: 5 } // Main route
          ]
        },
        createMarker: function() { return null; }, // Prevent default markers
        router: L.Routing.osrmv1({serviceUrl: 'https://router.project-osrm.org/route/v1'}),
        summaryTemplate: '',
        container: routingContainer, // Assign the dummy container
      });

      routingControlRef.current.addTo(mapRef.current);

      routingControlRef.current.on('routesfound', (e) => {
        const routes = e.routes;
        if (routes && routes.length > 0) {
          const summary = routes[0].summary;
          const instructions = routes[0].instructions.map((instruction: any) => ({
            text: instruction.text,
            distance: instruction.distance,
            time: instruction.time,
          }));
          setRouteItinerary?.({ summary, instructions });
        }
      });
    }

    // Update waypoints whenever externalRoutePandalIds or routeMode changes
    const currentRoutePandalIds = routeMode && externalRoutePandalIds ? externalRoutePandalIds : [];

    if (routingControlRef.current) {
      if (currentRoutePandalIds.length >= 2) {
        const routePandals = currentRoutePandalIds.map(id =>
          pandals.find(p => p._id === id)
        ).filter(Boolean);
        const waypoints = routePandals.map(pandal => L.latLng(pandal!.location.lat, pandal!.location.lng));
        routingControlRef.current.setWaypoints(waypoints);
      } else {
        // Clear route if not enough waypoints or route mode is off
        routingControlRef.current.setWaypoints([]);
        setRouteItinerary?.(null);
      }
    }

    // Cleanup function - remove control when component unmounts
    return () => {
      if (mapRef.current && routingControlRef.current) {
        mapRef.current.removeControl(routingControlRef.current);
        routingControlRef.current = null;
        setRouteItinerary?.(null);
      }
    };
  }, [mapRef, externalRoutePandalIds, pandals, routeMode, setRouteItinerary]);

  // Helper functions for map controls (now local to PandalMap again for marker rendering)
  const getCrowdColorLocal = (level: string) => {
    switch (level) {
      case "low": return "bg-green-500";
      case "medium": return "bg-yellow-500";
      case "high": return "bg-orange-500";
      case "critical": return "bg-red-500";
      default: return "bg-gray-500";
    }
  };

  const getCrowdIconLocal = (level: string) => {
    switch (level) {
      case "low": return "😊";
      case "medium": return "😐";
      case "high": return "😰";
      case "critical": return "🚨";
      default: return "❓";
    }
  };

  const handlePandalClick = (pandal: Pandal) => {
    if (routeMode) {
      // If in route mode, allow selecting pandals for the route
      setMapRoutePandalIds?.(prev => 
        prev?.includes(pandal._id) 
          ? prev.filter(id => id !== pandal._id)
          : [...(prev || []), pandal._id]
      );
    } else {
      // Otherwise, show details in the sidebar
      setSelectedPandalForDetails(pandal);
    }
    // Also set for internal selectedPandal state to highlight marker
    setSelectedPandal(pandal);
  };

  const getRouteOrder = (pandalId: Id<"pandals">) => {
    const routeToCheck = externalRoutePandalIds && routeMode ? externalRoutePandalIds : []; // Prioritize externalRoutePandalIds
    return routeToCheck.indexOf(pandalId) + 1;
  };
  
  return (
    <div className="h-full w-full relative">
      <MapContainer 
        center={[22.5726, 88.3639]} 
        zoom={12} 
        scrollWheelZoom={!isMapLocked} 
        doubleClickZoom={!isMapLocked}
        dragging={!isMapLocked}
        zoomControl={true}
        attributionControl={true}
        ref={mapRef}
        className="h-full w-full"
      > 
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

        {/* Route Lines handled by leaflet-routing-machine (no separate component needed here) */}

        {/* Pandal Markers */}
        {/* Note: filterLevel is now managed in CrowdDashboard. Pandals are filtered before being passed in. */}
        {pandals.map((pandal) => {
          // Use prop-level routeMode and externalRoutePandalIds for consistency
          const isPandalInRoute = routeMode && (externalRoutePandalIds?.includes(pandal._id)); // Simplified check
          const isSelected = selectedPandalForMap === pandal._id || selectedPandal?._id === pandal._id; 
          const routeOrder = isPandalInRoute ? getRouteOrder(pandal._id) : -1;
          
          const customIcon = L.divIcon({
            className: `custom-pandal-icon ${isPandalInRoute ? 'bg-blue-600 ring-4 ring-blue-300' : getCrowdColorLocal(pandal.crowdLevel)} ${isSelected ? 'ring-4 ring-purple-500 animate-pulse-subtle-once' : ''} ${pandal.name === "Bagbazar Sarbojanin" ? 'bg-red-700 ring-8 ring-pink-300 border-4 border-red-900 z-50' : ''}`,
            html: `
              <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-lg ">
                ${isPandalInRoute && routeOrder !== -1 ? `<span class="text-sm font-bold">${routeOrder}</span>` : `<span class="text-xs">${getCrowdIconLocal(pandal.crowdLevel)}</span>`}
              </div>
              <div class="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-white px-2 py-1 rounded shadow text-xs whitespace-nowrap z-50">
                ${pandal.name}
                ${isPandalInRoute && routeOrder !== -1 ? `<span class="ml-1 text-blue-600 font-bold">#${routeOrder}</span>` : ''}
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

      {/* Removed all absolute positioned controls (Route Mode Controls, Map Lock Toggle, Legend, Map Instructions) */}

      {/* Pandal Details Sidebar (removed from PandalMap, now managed in CrowdDashboard) */}
    </div>
  );
}
