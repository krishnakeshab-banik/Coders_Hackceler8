import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const create = mutation({
  args: {
    name: v.string(),
    startLocation: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    pandalIds: v.array(v.id("pandals")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Simple optimization: sort by distance from start location
    const pandals = await Promise.all(
      args.pandalIds.map(id => ctx.db.get(id))
    );
    
    const validPandals = pandals.filter(p => p !== null);
    
    // Calculate distances and optimize order (simplified)
    const optimizedOrder = [...args.pandalIds]; // In a real app, use proper TSP algorithm
    const totalDistance = validPandals.length * 2; // Simplified calculation
    const estimatedTime = validPandals.length * 45; // 45 minutes per pandal

    return await ctx.db.insert("routes", {
      userId,
      name: args.name,
      startLocation: args.startLocation,
      pandalIds: args.pandalIds,
      optimizedOrder,
      totalDistance,
      estimatedTime,
      status: "planned",
      createdAt: Date.now(),
    });
  },
});

export const getUserRoutes = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("routes")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("routes") },
  handler: async (ctx, args) => {
    const route = await ctx.db.get(args.id);
    if (!route) return null;

    // Get pandal details
    const pandals = await Promise.all(
      route.pandalIds.map(id => ctx.db.get(id))
    );

    return {
      ...route,
      pandals: pandals.filter(p => p !== null),
    };
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("routes"),
    status: v.union(v.literal("planned"), v.literal("active"), v.literal("completed")),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const route = await ctx.db.get(args.id);
    if (!route || route.userId !== userId) {
      throw new Error("Route not found or unauthorized");
    }

    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const getOptimalRoute = query({
  args: {
    startLocation: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    pandalIds: v.array(v.id("pandals")),
    avoidCrowds: v.boolean(),
  },
  handler: async (ctx, args) => {
    const pandals = await Promise.all(
      args.pandalIds.map(id => ctx.db.get(id))
    );
    
    const validPandals = pandals.filter(p => p !== null);
    
    // Filter out highly crowded pandals if requested
    const filteredPandals = args.avoidCrowds 
      ? validPandals.filter(p => p.crowdLevel !== "critical")
      : validPandals;
    
    // Simple optimization: sort by crowd level
    const optimizedOrder = [...filteredPandals].sort((a, b) => {
      const crowdPriority = { low: 1, medium: 2, high: 3, critical: 4 };
      return crowdPriority[a.crowdLevel] - crowdPriority[b.crowdLevel];
    });
    
    return {
      pandals: optimizedOrder,
      crowdAvoidance: args.avoidCrowds,
    };
  },
});

export const generateShareableLink = mutation({
  args: {
    routeId: v.id("routes"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const route = await ctx.db.get(args.routeId);
    if (!route || route.userId !== userId) {
      throw new Error("Route not found or unauthorized");
    }

    // Generate a simple unique shareable ID
    const shareableId = Math.random().toString(36).substring(2, 10);

    await ctx.db.patch(args.routeId, { shareableId });

    return shareableId;
  },
});

export const getByShareableId = query({
  args: {
    shareableId: v.string(),
  },
  handler: async (ctx, args) => {
    const route = await ctx.db
      .query("routes")
      .withIndex("by_shareable_id", (q) => q.eq("shareableId", args.shareableId))
      .first();
    
    if (!route) return null;

    // Fetch pandal details for the shared route
    const pandals = await Promise.all(
      route.pandalIds.map(id => ctx.db.get(id))
    );

    return {
      ...route,
      pandals: pandals.filter(p => p !== null),
    };
  },
});

export const generateAutomatedRoute = query({
  args: {
    startLocation: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    numPandals: v.number(),
    festivalType: v.optional(v.string()),
    avoidCrowds: v.boolean(),
  },
  handler: async (ctx, args) => {
    let allPandals = await ctx.db.query("pandals").withIndex("by_active", (q) => q.eq("isActive", true)).collect();

    if (args.festivalType && args.festivalType !== "all") {
      allPandals = allPandals.filter(p => p.festivalType === args.festivalType);
    }

    // Filter out highly crowded pandals if requested
    const filteredPandals = args.avoidCrowds 
      ? allPandals.filter(p => p.crowdLevel !== "critical")
      : allPandals;

    // Simple optimization for automated route: Sort by crowd level, then by distance from start
    const sortedPandals = [...filteredPandals].sort((a, b) => {
      const crowdPriority = { low: 1, medium: 2, high: 3, critical: 4 };
      const crowdDiff = crowdPriority[a.crowdLevel] - crowdPriority[b.crowdLevel];
      if (crowdDiff !== 0) return crowdDiff;

      // Simple distance heuristic (Euclidean distance)
      const distA = Math.sqrt(
        Math.pow(a.location.lat - args.startLocation.lat, 2) +
        Math.pow(a.location.lng - args.startLocation.lng, 2)
      );
      const distB = Math.sqrt(
        Math.pow(b.location.lat - args.startLocation.lat, 2) +
        Math.pow(b.location.lng - args.startLocation.lng, 2)
      );
      return distA - distB;
    });

    // Take the top `numPandals`
    const selectedPandals = sortedPandals.slice(0, args.numPandals);

    return {
      pandals: selectedPandals,
      totalDistance: selectedPandals.length * 2, // Placeholder
      estimatedTime: selectedPandals.length * 45, // Placeholder
      crowdAvoidance: args.avoidCrowds,
    };
  },
});
