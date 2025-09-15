import { query, mutation, action, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const recordCrowdData = mutation({
  args: {
    pandalId: v.id("pandals"),
    peopleCount: v.number(),
    crowdDensity: v.number(),
    queueLength: v.optional(v.number()),
    waitTime: v.optional(v.number()),
    anomalyDetected: v.boolean(),
    anomalyType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Determine crowd level based on density
    let crowdLevel: "low" | "medium" | "high" | "critical";
    if (args.crowdDensity < 2) crowdLevel = "low";
    else if (args.crowdDensity < 4) crowdLevel = "medium";
    else if (args.crowdDensity < 6) crowdLevel = "high";
    else crowdLevel = "critical";

    // Record crowd data
    const crowdDataId = await ctx.db.insert("crowdData", {
      ...args,
      timestamp: Date.now(),
      crowdLevel,
    });

    // Update pandal crowd level
    await ctx.db.patch(args.pandalId, {
      currentCrowd: args.peopleCount,
      crowdLevel,
    });

    // Check for alerts
    if (crowdLevel === "critical" || args.anomalyDetected) {
      await ctx.scheduler.runAfter(0, internal.alerts.createAlert, {
        pandalId: args.pandalId,
        type: args.anomalyDetected ? (args.anomalyType as any) || "emergency" : "overcrowding",
        severity: "critical",
        message: args.anomalyDetected 
          ? `Anomaly detected: ${args.anomalyType}` 
          : `Critical overcrowding detected with ${args.peopleCount} people`,
      });
    }

    return crowdDataId;
  },
});

export const recordCrowdDataInternal = internalMutation({
  args: {
    pandalId: v.id("pandals"),
    peopleCount: v.number(),
    crowdDensity: v.number(),
    queueLength: v.optional(v.number()),
    waitTime: v.optional(v.number()),
    anomalyDetected: v.boolean(),
    anomalyType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Determine crowd level based on density
    let crowdLevel: "low" | "medium" | "high" | "critical";
    if (args.crowdDensity < 2) crowdLevel = "low";
    else if (args.crowdDensity < 4) crowdLevel = "medium";
    else if (args.crowdDensity < 6) crowdLevel = "high";
    else crowdLevel = "critical";

    // Record crowd data
    const crowdDataId = await ctx.db.insert("crowdData", {
      ...args,
      timestamp: Date.now(),
      crowdLevel,
    });

    // Update pandal crowd level
    await ctx.db.patch(args.pandalId, {
      currentCrowd: args.peopleCount,
      crowdLevel,
    });

    return crowdDataId;
  },
});

export const getLatestCrowdData = query({
  args: { pandalId: v.id("pandals") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crowdData")
      .withIndex("by_pandal", (q) => q.eq("pandalId", args.pandalId))
      .order("desc")
      .first();
  },
});

export const getCrowdHistory = query({
  args: { 
    pandalId: v.id("pandals"),
    hours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const hoursBack = args.hours || 24;
    const cutoffTime = Date.now() - (hoursBack * 60 * 60 * 1000);
    
    return await ctx.db
      .query("crowdData")
      .withIndex("by_pandal", (q) => q.eq("pandalId", args.pandalId))
      .filter((q) => q.gte(q.field("timestamp"), cutoffTime))
      .order("desc")
      .take(100);
  },
});

// Simulate crowd data updates (for demo purposes)
export const simulateCrowdUpdates = action({
  args: {},
  handler: async (ctx) => {
    const pandals = await ctx.runQuery(internal.pandals.listInternal, {});
    
    for (const pandal of pandals) {
      // Generate random crowd data
      const baseCount = Math.floor(Math.random() * pandal.capacity);
      const variation = Math.floor(Math.random() * 100) - 50;
      const peopleCount = Math.max(0, Math.min(pandal.capacity, baseCount + variation));
      const crowdDensity = peopleCount / 100; // Assuming 100 sq meters per pandal
      
      // Random chance of anomaly
      const anomalyDetected = Math.random() < 0.05; // 5% chance
      const anomalyTypes = ["fight", "stampede", "overcrowding"];
      const anomalyType = anomalyDetected ? anomalyTypes[Math.floor(Math.random() * anomalyTypes.length)] : undefined;
      
      await ctx.runMutation(internal.crowdData.recordCrowdDataInternal, {
        pandalId: pandal._id,
        peopleCount,
        crowdDensity,
        queueLength: Math.floor(Math.random() * 50),
        waitTime: Math.floor(Math.random() * 30),
        anomalyDetected,
        anomalyType,
      });
    }
  },
});
