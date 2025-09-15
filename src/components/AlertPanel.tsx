import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useMemo } from "react";

interface Pandal {
  _id: Id<"pandals">;
  name: string;
  location: { lat: number; lng: number };
  address: string;
  crowdLevel: "low" | "medium" | "high" | "critical";
  currentCrowd: number;
  capacity: number;
  // Add other pandal properties if needed for display
}

interface Alert {
  _id: Id<"alerts">;
  pandalId: Id<"pandals">;
  type: "overcrowding" | "stampede" | "fight" | "emergency";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: number;
  isResolved: boolean;
  notificationsSent: boolean;
  resolvedAt?: number; // Added for resolvedAt
}

interface EnrichedAlert {
  alert: Alert;
  pandal: Pandal | null; // Pandal can be null if not found
}

interface AlertPanelProps {
  alerts: EnrichedAlert[];
  onSelectPandalForMap: React.Dispatch<React.SetStateAction<Id<"pandals"> | null>>;
  onSetActiveTab: React.Dispatch<React.SetStateAction<"map" | "routes" | "alerts" | "camera">>;
}

export function AlertPanel({ alerts, onSelectPandalForMap, onSetActiveTab }: AlertPanelProps) {
  const resolveAlert = useMutation(api.alerts.resolveAlert);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [showResolved, setShowResolved] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<"timestamp" | "severity">("timestamp");

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "low": return "border-l-yellow-400 bg-yellow-50";
      case "medium": return "border-l-orange-400 bg-orange-50";
      case "high": return "border-l-red-400 bg-red-50";
      case "critical": return "border-l-red-600 bg-red-100";
      default: return "border-l-gray-400 bg-gray-50";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "overcrowding": return "👥";
      case "stampede": return "🏃‍♂️";
      case "fight": return "⚔️";
      case "emergency": return "🚨";
      default: return "⚠️";
    }
  };

  const handleResolveAlert = async (alertId: Id<"alerts">) => {
    try {
      await resolveAlert({ id: alertId });
    } catch (error) {
      console.error("Failed to resolve alert:", error);
    }
  };

  const handleViewOnMap = (pandalId: Id<"pandals">) => {
    onSelectPandalForMap(pandalId);
    onSetActiveTab("map");
  };

  const filteredAndSortedAlerts = useMemo(() => {
    let filtered = alerts;

    if (!showResolved) {
      filtered = filtered.filter(({ alert }) => !alert.isResolved);
    }

    if (filterType !== "all") {
      filtered = filtered.filter(({ alert }) => alert.type === filterType);
    }

    if (filterSeverity !== "all") {
      filtered = filtered.filter(({ alert }) => alert.severity === filterSeverity);
    }

    // Sort logic
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === "timestamp") {
        return b.alert.timestamp - a.alert.timestamp;
      } else if (sortBy === "severity") {
        const severityOrder = { "critical": 4, "high": 3, "medium": 2, "low": 1 };
        return severityOrder[b.alert.severity] - severityOrder[a.alert.severity];
      }
      return 0;
    });

    return sorted;
  }, [alerts, filterType, filterSeverity, showResolved, sortBy]);

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">🚨 Alerts</h2>
        
        {/* Filter and Sort Controls */}
        <div className="bg-white rounded-lg p-4 shadow mb-6 flex items-center flex-wrap gap-4">
          <h3 className="font-semibold mr-2">Filters:</h3>
          
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border rounded px-3 py-1 text-sm"
          >
            <option value="all">All Types</option>
            <option value="overcrowding">Overcrowding</option>
            <option value="stampede">Stampede</option>
            <option value="fight">Fight</option>
            <option value="emergency">Emergency</option>
          </select>

          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="border rounded px-3 py-1 text-sm"
          >
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <div className="flex items-center ml-auto">
            <span className="font-semibold mr-2">Show:</span>
            <button
              onClick={() => setShowResolved(false)}
              className={`px-3 py-1 rounded-l-lg text-sm ${
                !showResolved ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              Active ({alerts.filter(a => !a.alert.isResolved).length})
            </button>
            <button
              onClick={() => setShowResolved(true)}
              className={`px-3 py-1 rounded-r-lg text-sm ${
                showResolved ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"
              }`}
            >
              Resolved ({alerts.filter(a => a.alert.isResolved).length})
            </button>
          </div>

          <h3 className="font-semibold ml-4 mr-2">Sort By:</h3>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "timestamp" | "severity")}
            className="border rounded px-3 py-1 text-sm"
          >
            <option value="timestamp">Timestamp</option>
            <option value="severity">Severity</option>
          </select>
        </div>
        
        {filteredAndSortedAlerts.length === 0 ? (
          <div className="text-center text-gray-500 mt-12">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-xl font-semibold mb-2">No Alerts Found</h3>
            <p>Adjust your filters or check back later.</p>
            <p className="text-sm">The system is monitoring all pandals for safety</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAndSortedAlerts.map(({ alert, pandal }) => (
              <div
                key={alert._id}
                className={`border-l-4 p-4 rounded-r-lg shadow ${getSeverityColor(alert.severity)} ${alert.severity === "critical" ? "animate-pulse-subtle" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{getTypeIcon(alert.type)}</span>
                      <span className="font-semibold capitalize">{alert.type.replace('_', ' ')}</span>
                      <span className={`px-2 py-1 rounded text-xs font-medium uppercase ${
                        alert.severity === "critical" ? "bg-red-600 text-white" :
                        alert.severity === "high" ? "bg-red-500 text-white" :
                        alert.severity === "medium" ? "bg-orange-500 text-white" :
                        "bg-yellow-500 text-white"
                      }`}>
                        {alert.severity}
                      </span>
                      {alert.isResolved && (
                        <span className="ml-2 px-2 py-1 rounded text-xs font-medium bg-gray-500 text-white">
                          RESOLVED
                        </span>
                      )}
                    </div>
                    {pandal && (
                      <div className="text-sm text-gray-800 mb-2">
                        <strong>Pandal:</strong> {pandal.name} ({pandal.address})
                      </div>
                    )}
                    <p className="text-gray-700 mb-2">{alert.message}</p>
                    <div className="text-sm text-gray-500">
                      <span>📅 {new Date(alert.timestamp).toLocaleString()}</span>
                    </div>
                    {pandal && (
                      <button
                        onClick={() => handleViewOnMap(pandal._id)}
                        className="mt-2 mr-2 px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                      >
                        View on Map
                      </button>
                    )}
                    {!alert.isResolved && (
                      <button
                        onClick={() => handleResolveAlert(alert._id)}
                        className="mt-2 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                      >
                        Resolve
                      </button>
                    )}
                    {alert.isResolved && (
                      <span className="mt-2 px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded">
                        Resolved at: {new Date(alert.resolvedAt || 0).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Alert Statistics */}
        <div className="mt-8 bg-white rounded-lg p-6 shadow">
          <h3 className="font-semibold mb-4">Alert Statistics</h3>
          <div className="grid grid-cols-4 gap-4">
            {["critical", "high", "medium", "low"].map((severity) => {
              const count = alerts.filter(a => a.alert.severity === severity && !a.alert.isResolved).length;
              return (
                <div key={severity} className="text-center">
                  <div className={`text-2xl font-bold ${
                    severity === "critical" ? "text-red-600" :
                    severity === "high" ? "text-red-500" :
                    severity === "medium" ? "text-orange-500" :
                    "text-yellow-500"
                  }`}>
                    {count}
                  </div>
                  <div className="text-sm text-gray-600 capitalize">{severity}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Emergency Contacts */}
        <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 mb-2">🚨 Emergency Contacts</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <strong>Police Control Room:</strong><br />
              📞 100 / 033-2214-5000
            </div>
            <div>
              <strong>Fire Brigade:</strong><br />
              📞 101 / 033-2244-5000
            </div>
            <div>
              <strong>Medical Emergency:</strong><br />
              📞 108 / 033-2287-1000
            </div>
            <div>
              <strong>Disaster Management:</strong><br />
              📞 1070 / 033-2214-1000
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
