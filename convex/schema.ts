import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  pandals: defineTable({
    name: v.string(),
    location: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    address: v.string(),
    description: v.optional(v.string()),
    capacity: v.number(),
    currentCrowd: v.number(),
    crowdLevel: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    isActive: v.boolean(),
    festivalType: v.string(), // "durga_puja", "ganesh_chaturthi", etc.
    organizer: v.optional(v.string()),
    contactInfo: v.optional(v.string()),
  })
    .index("by_festival_type", ["festivalType"])
    .index("by_crowd_level", ["crowdLevel"])
    .index("by_active", ["isActive"]),

  crowdData: defineTable({
    pandalId: v.id("pandals"),
    timestamp: v.number(),
    peopleCount: v.number(),
    crowdDensity: v.number(), // people per square meter
    crowdLevel: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    queueLength: v.optional(v.number()),
    waitTime: v.optional(v.number()), // estimated wait time in minutes
    anomalyDetected: v.boolean(),
    anomalyType: v.optional(v.string()), // "fight", "stampede", "overcrowding"
  })
    .index("by_pandal", ["pandalId"])
    .index("by_timestamp", ["timestamp"])
    .index("by_anomaly", ["anomalyDetected"]),

  routes: defineTable({
    userId: v.id("users"),
    name: v.string(),
    startLocation: v.object({
      lat: v.number(),
      lng: v.number(),
    }),
    pandalIds: v.array(v.id("pandals")),
    optimizedOrder: v.array(v.id("pandals")),
    totalDistance: v.number(),
    estimatedTime: v.number(), // in minutes
    status: v.union(v.literal("planned"), v.literal("active"), v.literal("completed")),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"]),

  alerts: defineTable({
    pandalId: v.id("pandals"),
    type: v.union(v.literal("overcrowding"), v.literal("stampede"), v.literal("fight"), v.literal("emergency")),
    severity: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("critical")),
    message: v.string(),
    timestamp: v.number(),
    isResolved: v.boolean(),
    resolvedAt: v.optional(v.number()),
    notificationsSent: v.boolean(),
  })
    .index("by_pandal", ["pandalId"])
    .index("by_severity", ["severity"])
    .index("by_resolved", ["isResolved"])
    .index("by_timestamp", ["timestamp"]),

  userPreferences: defineTable({
    userId: v.id("users"),
    preferredFestivals: v.array(v.string()),
    maxWalkingDistance: v.number(), // in km
    avoidCrowds: v.boolean(),
    notificationsEnabled: v.boolean(),
    emergencyContact: v.optional(v.string()),
  })
    .index("by_user", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
