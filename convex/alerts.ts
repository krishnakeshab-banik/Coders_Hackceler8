
import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const createAlert = internalMutation({
  args: {
    pandalId: v.id("pandals"),
    type: v.union(v.literal("overcrowding"), v.literal("stampede"), v.literal("fight"), v.literal("emergency")),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("alerts", {
      ...args,
      timestamp: Date.now(),
      isResolved: false,
      notificationsSent: false,
    });
  },
});

export const getActiveAlerts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("alerts")
      .withIndex("by_resolved", (q) => q.eq("isResolved", false))
      .order("desc")
      .collect();
  },
});

export const resolveAlert = mutation({
  args: { id: v.id("alerts") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isResolved: true,
      resolvedAt: Date.now(),
    });
  },
});