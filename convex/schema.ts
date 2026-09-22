import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const status = v.union(
  v.literal("reported"),
  v.literal("looking"),
  v.literal("waiting"),
  v.literal("options_ready"),
  v.literal("chosen"),
);

export default defineSchema({
  repairs: defineTable({
    publicId: v.string(),
    description: v.string(),
    area: v.string(),
    status,
    category: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
    discoveryCompleted: v.optional(v.boolean()),
    integrationError: v.optional(v.string()),
    photoId: v.optional(v.id("_storage")),
    chosenCandidateId: v.optional(v.id("candidates")),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_public_id", ["publicId"]),

  candidates: defineTable({
    repairId: v.id("repairs"),
    name: v.string(),
    website: v.string(),
    contactEmail: v.optional(v.string()),
    contactSourceUrl: v.optional(v.string()),
    serviceEvidence: v.string(),
    sourceUrl: v.string(),
    discoveryRank: v.number(),
    createdAt: v.number(),
  })
    .index("by_repair", ["repairId"])
    .index("by_repair_website", ["repairId", "website"]),

  outreach: defineTable({
    repairId: v.id("repairs"),
    candidateId: v.id("candidates"),
    toEmail: v.string(),
    status: v.union(v.literal("reserved"), v.literal("sent"), v.literal("failed")),
    messageId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    error: v.optional(v.string()),
    sentAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_repair_candidate", ["repairId", "candidateId"])
    .index("by_thread", ["threadId"])
    .index("by_message", ["messageId"]),

  replies: defineTable({
    repairId: v.id("repairs"),
    candidateId: v.id("candidates"),
    outreachId: v.id("outreach"),
    externalMessageId: v.string(),
    threadId: v.optional(v.string()),
    fromEmail: v.string(),
    rawText: v.string(),
    canTakeJob: v.union(v.literal("true"), v.literal("false"), v.literal("unclear")),
    arrivalText: v.optional(v.string()),
    priceAmount: v.optional(v.number()),
    currency: v.optional(v.string()),
    note: v.optional(v.string()),
    extractionStatus: v.union(v.literal("parsed"), v.literal("failed")),
    receivedAt: v.number(),
  })
    .index("by_external_message", ["externalMessageId"])
    .index("by_repair", ["repairId"])
    .index("by_candidate", ["candidateId"]),

  events: defineTable({
    repairId: v.id("repairs"),
    type: v.string(),
    detail: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_repair", ["repairId"]),
});
