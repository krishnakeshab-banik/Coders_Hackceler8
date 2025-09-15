interface CrowdStatsProps {
  stats?: {
    total: number;
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

export function CrowdStats({ stats }: CrowdStatsProps) {
  if (!stats) {
    return (
      <div className="flex justify-center">
        <div className="animate-pulse text-gray-500">Loading stats...</div>
      </div>
    );
  }

  const statItems = [
    { label: "Total Pandals", value: stats.total, color: "text-gray-600", bg: "bg-gray-100" },
    { label: "Low Crowd", value: stats.low, color: "text-green-600", bg: "bg-green-100" },
    { label: "Medium Crowd", value: stats.medium, color: "text-yellow-600", bg: "bg-yellow-100" },
    { label: "High Crowd", value: stats.high, color: "text-orange-600", bg: "bg-orange-100" },
    { label: "Critical", value: stats.critical, color: "text-red-600", bg: "bg-red-100" },
  ];

  return (
    <div className="grid grid-cols-5 gap-4">
      {statItems.map((item) => (
        <div key={item.label} className={`${item.bg} rounded-lg p-4 text-center`}>
          <div className={`text-2xl font-bold ${item.color}`}>{item.value}</div>
          <div className="text-sm text-gray-600 mt-1">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
