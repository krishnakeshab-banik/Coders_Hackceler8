import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface Alert {
  _id: Id<"alerts">;
  pandalId: Id<"pandals">;
  type: "overcrowding" | "stampede" | "fight" | "emergency";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  timestamp: number;
  isResolved: boolean;
}

interface AlertPanelProps {
  alerts: Alert[];
}

export function AlertPanel({ alerts }: AlertPanelProps) {
  const resolveAlert = useMutation(api.alerts.resolveAlert);

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

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold mb-6">🚨 Active Alerts</h2>
        
        {alerts.length === 0 ? (
          <div className="text-center text-gray-500 mt-12">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-xl font-semibold mb-2">All Clear!</h3>
            <p>No active alerts at the moment</p>
            <p className="text-sm">The system is monitoring all pandals for safety</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert._id}
                className={`border-l-4 p-4 rounded-r-lg shadow ${getSeverityColor(alert.severity)}`}
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
                    </div>
                    <p className="text-gray-700 mb-2">{alert.message}</p>
                    <div className="text-sm text-gray-500">
                      <span>📅 {new Date(alert.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleResolveAlert(alert._id)}
                    className="ml-4 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 transition-colors"
                  >
                    Resolve
                  </button>
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
              const count = alerts.filter(a => a.severity === severity).length;
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
