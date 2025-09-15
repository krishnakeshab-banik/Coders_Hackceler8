import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {
    festivalType: v.optional(v.string()),
    crowdLevel: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical"))),
  },
  handler: async (ctx, args) => {
    let query = ctx.db.query("pandals").withIndex("by_active", (q) => q.eq("isActive", true));
    
    if (args.festivalType) {
      const pandals = await ctx.db.query("pandals").withIndex("by_festival_type", (q) => q.eq("festivalType", args.festivalType!)).collect();
      return args.crowdLevel ? pandals.filter(p => p.crowdLevel === args.crowdLevel) : pandals;
    }
    
    const pandals = await query.collect();
    
    if (args.crowdLevel) {
      return pandals.filter(p => p.crowdLevel === args.crowdLevel);
    }
    
    return pandals;
  },
});

export const getById = query({
  args: { id: v.id("pandals") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    location: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    address: v.string(),
    description: v.optional(v.string()),
    capacity: v.number(),
    festivalType: v.string(),
    organizer: v.optional(v.string()),
    contactInfo: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("pandals", {
      ...args,
      currentCrowd: 0,
      crowdLevel: "low",
      isActive: true,
    });
  },
});

export const updateCrowdLevel = mutation({
  args: {
    id: v.id("pandals"),
    currentCrowd: v.number(),
    crowdLevel: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      currentCrowd: args.currentCrowd,
      crowdLevel: args.crowdLevel,
    });
  },
});

export const getCrowdStats = query({
  args: {},
  handler: async (ctx) => {
    const pandals = await ctx.db.query("pandals").withIndex("by_active", (q) => q.eq("isActive", true)).collect();
    
    const stats = {
      total: pandals.length,
      low: pandals.filter(p => p.crowdLevel === "low").length,
      medium: pandals.filter(p => p.crowdLevel === "medium").length,
      high: pandals.filter(p => p.crowdLevel === "high").length,
      critical: pandals.filter(p => p.crowdLevel === "critical").length,
    };
    
    return stats;
  },
});

export const listInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("pandals").withIndex("by_active", (q) => q.eq("isActive", true)).collect();
  },
});
