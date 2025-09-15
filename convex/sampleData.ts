import { mutation } from "./_generated/server";

export const initializeSampleData = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if data already exists
    const existing = await ctx.db.query("pandals").first();
    if (existing) return;

    const samplePandals = [
      {
        name: "Bagbazar Sarbojanin",
        location: { lat: 22.5958, lng: 88.3639 },
        address: "Bagbazar Street, North Kolkata",
        description: "Famous for traditional Durga Puja celebrations",
        capacity: 5000,
        festivalType: "durga_puja",
        organizer: "Bagbazar Sarbojanin Committee",
      },
      {
        name: "Kumartuli Park",
        location: { lat: 22.5958, lng: 88.3639 },
        address: "Kumartuli Park, North Kolkata",
        description: "Known for artistic decorations",
        capacity: 3000,
        festivalType: "durga_puja",
        organizer: "Kumartuli Park Committee",
      },
      {
        name: "Shobhabazar Rajbari",
        location: { lat: 22.5958, lng: 88.3639 },
        address: "Shobhabazar, North Kolkata",
        description: "Historic royal family puja",
        capacity: 2000,
        festivalType: "durga_puja",
        organizer: "Shobhabazar Royal Family",
      },
      {
        name: "College Square",
        location: { lat: 22.5726, lng: 88.3639 },
        address: "College Street, Central Kolkata",
        description: "Popular among students and youth",
        capacity: 4000,
        festivalType: "durga_puja",
        organizer: "College Square Committee",
      },
      {
        name: "Deshapriya Park",
        location: { lat: 22.5226, lng: 88.3639 },
        address: "Deshapriya Park, South Kolkata",
        description: "Modern theme-based decorations",
        capacity: 6000,
        festivalType: "durga_puja",
        organizer: "Deshapriya Park Committee",
      },
      {
        name: "Santosh Mitra Square",
        location: { lat: 22.5426, lng: 88.3539 },
        address: "Santosh Mitra Square, Central Kolkata",
        description: "Grand pandal with celebrity visits",
        capacity: 8000,
        festivalType: "durga_puja",
        organizer: "Santosh Mitra Square Committee",
      },
      {
        name: "Mudiali Club",
        location: { lat: 22.5826, lng: 88.3739 },
        address: "Mudiali, North Kolkata",
        description: "Traditional neighborhood celebration",
        capacity: 2500,
        festivalType: "durga_puja",
        organizer: "Mudiali Club",
      },
      {
        name: "Ballygunge Cultural",
        location: { lat: 22.5326, lng: 88.3639 },
        address: "Ballygunge, South Kolkata",
        description: "Cultural programs and competitions",
        capacity: 4500,
        festivalType: "durga_puja",
        organizer: "Ballygunge Cultural Association",
      },
    ];

    for (const pandal of samplePandals) {
      const currentCrowd = Math.floor(Math.random() * pandal.capacity);
      const crowdLevels = ["low", "medium", "high", "critical"] as const;
      const crowdLevel = crowdLevels[Math.floor(Math.random() * crowdLevels.length)];
      
      await ctx.db.insert("pandals", {
        ...pandal,
        currentCrowd,
        crowdLevel,
        isActive: true,
      });
    }

    return `Initialized ${samplePandals.length} sample pandals`;
  },
});

export const initializeSampleAlerts = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if sample alerts already exist to prevent duplicates
    const existingAlert = await ctx.db.query("alerts").first();
    if (existingAlert) return "Sample alerts already initialized.";

    const pandals = await ctx.db.query("pandals").collect();
    if (pandals.length === 0) return "No pandals available to create alerts for.";

    const alertsToInsert = [
      {
        pandalId: pandals[0]._id, // Use the first available pandal
        type: "overcrowding" as "overcrowding",
        severity: "critical" as "critical",
        message: "Critical overcrowding detected at main entrance.",
        timestamp: Date.now() - 3600000, // 1 hour ago
        isResolved: false,
        notificationsSent: false,
      },
      {
        pandalId: pandals[1]._id, // Use the second available pandal
        type: "fight" as "fight",
        severity: "high" as "high",
        message: "Fight reported near food stalls.",
        timestamp: Date.now() - 7200000, // 2 hours ago
        isResolved: false,
        notificationsSent: false,
      },
      {
        pandalId: pandals[0]._id, // Use the first available pandal again
        type: "emergency" as "emergency",
        severity: "medium" as "medium",
        message: "Minor medical emergency at exit gate.",
        timestamp: Date.now() - 10800000, // 3 hours ago
        isResolved: true,
        notificationsSent: true,
        resolvedAt: Date.now() - 7200000,
      },
      {
        pandalId: pandals[2]._id, // Use the third available pandal
        type: "overcrowding" as "overcrowding",
        severity: "low" as "low",
        message: "Crowd density slightly elevated in VIP section.",
        timestamp: Date.now() - 1800000, // 30 minutes ago
        isResolved: false,
        notificationsSent: false,
      },
    ];

    for (const alert of alertsToInsert) {
      await ctx.db.insert("alerts", alert);
    }

    return `Initialized ${alertsToInsert.length} sample alerts.`;
  },
});
