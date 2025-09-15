
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
    const alertId = await ctx.db.insert("alerts", {
      ...args,
      timestamp: Date.now(),
      isResolved: false,
      notificationsSent: false,
    });

    // Simulate dispatch to authorities
    console.log(`
    🚨🚨🚨 ALERT DISPATCHED TO AUTHORITIES 🚨🚨🚨
    Alert ID: ${alertId}
    Pandal ID: ${args.pandalId}
    Type: ${args.type.toUpperCase()}
    Severity: ${args.severity.toUpperCase()}
    Message: ${args.message}
    Timestamp: ${new Date(Date.now()).toLocaleString()}
    -----------------------------------------------
    `);

    return alertId;
  },
});

export const getActiveAlerts = query({
  args: {},
  handler: async (ctx) => {
    const alerts = await ctx.db
      .query("alerts")
      .order("desc")
      .collect();

    const alertsWithPandal = await Promise.all(alerts.map(async (alert) => {
      const pandal = await ctx.db.get(alert.pandalId);
      return { alert, pandal };
    }));

    return alertsWithPandal.filter(item => item.pandal !== null);
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