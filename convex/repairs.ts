import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";

const repairIdArg = { repairId: v.id("repairs") };

export const create = mutation({
  args: { description: v.string(), area: v.string(), photoId: v.optional(v.id("_storage")) },
  handler: async (ctx, args) => {
    const description = args.description.trim();
    const area = args.area.trim();
    if (description.length < 12 || description.length > 1200) {
      throw new Error("Tell us a little more about what broke.");
    }
    if (area.length < 2 || area.length > 120) throw new Error("Enter your area or neighbourhood.");
    const now = Date.now();
    const publicId = crypto.randomUUID();
    const repairId = await ctx.db.insert("repairs", {
      publicId,
      description,
      area,
      photoId: args.photoId,
      status: "reported",
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("events", { repairId, type: "reported", createdAt: now });
    return { repairId, publicId };
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => ctx.storage.generateUploadUrl(),
});

export const getByPublicId = query({
  args: { publicId: v.string() },
  handler: async (ctx, { publicId }) => {
    const repair = await ctx.db
      .query("repairs")
      .withIndex("by_public_id", (q) => q.eq("publicId", publicId))
      .unique();
    if (!repair || repair.archivedAt) return null;
    const candidates = await ctx.db
      .query("candidates")
      .withIndex("by_repair", (q) => q.eq("repairId", repair._id))
      .collect();
    const outreach = await ctx.db
      .query("outreach")
      .withIndex("by_repair_candidate", (q) => q.eq("repairId", repair._id))
      .collect();
    const replies = await ctx.db
      .query("replies")
      .withIndex("by_repair", (q) => q.eq("repairId", repair._id))
      .collect();
    const photoUrl = repair.photoId ? await ctx.storage.getUrl(repair.photoId) : null;
    return {
      ...repair,
      photoUrl,
      candidates: candidates.sort((a, b) => a.discoveryRank - b.discoveryRank),
      outreach,
      replies: replies.sort((a, b) => a.receivedAt - b.receivedAt),
    };
  },
});

export const choose = mutation({
  args: { repairId: v.id("repairs"), candidateId: v.id("candidates") },
  handler: async (ctx, { repairId, candidateId }) => {
    const repair = await ctx.db.get(repairId);
    const candidate = await ctx.db.get(candidateId);
    if (!repair || repair.archivedAt || !candidate || candidate.repairId !== repairId) {
      throw new Error("That option is no longer available.");
    }
    if (repair.status === "chosen") {
      if (repair.chosenCandidateId === candidateId) return;
      throw new Error("Someone has already been chosen for this repair.");
    }
    const reply = await ctx.db
      .query("replies")
      .withIndex("by_candidate", (q) => q.eq("candidateId", candidateId))
      .filter((q) => q.eq(q.field("canTakeJob"), "true"))
      .first();
    if (!reply) throw new Error("Choose someone who said they can take the job.");
    const now = Date.now();
    await ctx.db.patch(repairId, { chosenCandidateId: candidateId, status: "chosen", updatedAt: now });
    await ctx.db.insert("events", { repairId, type: "chosen", detail: candidate.name, createdAt: now });
  },
});

export const getInternal = internalQuery({
  args: repairIdArg,
  handler: async (ctx, { repairId }) => ctx.db.get(repairId),
});

export const listCandidatesInternal = internalQuery({
  args: repairIdArg,
  handler: async (ctx, { repairId }) =>
    ctx.db.query("candidates").withIndex("by_repair", (q) => q.eq("repairId", repairId)).collect(),
});

export const markLooking = internalMutation({
  args: repairIdArg,
  handler: async (ctx, { repairId }) => {
    const repair = await ctx.db.get(repairId);
    if (!repair || repair.archivedAt || !["reported", "looking"].includes(repair.status)) return false;
    await ctx.db.patch(repairId, {
      status: "looking",
      discoveryCompleted: false,
      integrationError: undefined,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("events", { repairId, type: "looking", createdAt: Date.now() });
    return true;
  },
});

export const saveDiscovery = internalMutation({
  args: {
    repairId: v.id("repairs"),
    category: v.string(),
    searchQuery: v.string(),
    candidates: v.array(
      v.object({
        name: v.string(),
        website: v.string(),
        contactEmail: v.optional(v.string()),
        contactSourceUrl: v.optional(v.string()),
        serviceEvidence: v.string(),
        sourceUrl: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const repair = await ctx.db.get(args.repairId);
    if (!repair || repair.archivedAt || repair.status === "chosen") return;
    for (const [index, candidate] of args.candidates.slice(0, 4).entries()) {
      const existing = await ctx.db
        .query("candidates")
        .withIndex("by_repair_website", (q) =>
          q.eq("repairId", args.repairId).eq("website", candidate.website),
        )
        .unique();
      if (!existing) {
        await ctx.db.insert("candidates", {
          repairId: args.repairId,
          ...candidate,
          discoveryRank: index,
          createdAt: Date.now(),
        });
      }
    }
    await ctx.db.patch(args.repairId, {
      category: args.category,
      searchQuery: args.searchQuery,
      discoveryCompleted: true,
      integrationError: undefined,
      updatedAt: Date.now(),
    });
    await ctx.db.insert("events", {
      repairId: args.repairId,
      type: args.candidates.length ? "people_found" : "none_found",
      detail: `${Math.min(args.candidates.length, 4)}`,
      createdAt: Date.now(),
    });
  },
});

export const saveDiscoveryError = internalMutation({
  args: { repairId: v.id("repairs"), message: v.string() },
  handler: async (ctx, { repairId, message }) => {
    const repair = await ctx.db.get(repairId);
    if (!repair || repair.archivedAt || repair.status === "chosen") return;
    await ctx.db.patch(repairId, {
      status: "looking",
      discoveryCompleted: true,
      integrationError: message.slice(0, 500),
      updatedAt: Date.now(),
    });
    await ctx.db.insert("events", {
      repairId,
      type: "discovery_failed",
      detail: message.slice(0, 300),
      createdAt: Date.now(),
    });
  },
});

export const reserveOutreach = internalMutation({
  args: { repairId: v.id("repairs"), candidateId: v.id("candidates") },
  handler: async (ctx, { repairId, candidateId }) => {
    const existing = await ctx.db
      .query("outreach")
      .withIndex("by_repair_candidate", (q) => q.eq("repairId", repairId).eq("candidateId", candidateId))
      .unique();
    if (existing) {
      if (existing.status === "failed") {
        await ctx.db.patch(existing._id, { status: "reserved", error: undefined });
        return { created: true as const, outreachId: existing._id };
      }
      return { created: false as const, outreachId: existing._id };
    }
    const candidate = await ctx.db.get(candidateId);
    if (!candidate || candidate.repairId !== repairId || !candidate.contactEmail) return null;
    const outreachId = await ctx.db.insert("outreach", {
      repairId,
      candidateId,
      toEmail: candidate.contactEmail,
      status: "reserved",
      createdAt: Date.now(),
    });
    return { created: true as const, outreachId };
  },
});

export const finishOutreach = internalMutation({
  args: {
    outreachId: v.id("outreach"),
    success: v.boolean(),
    messageId: v.optional(v.string()),
    threadId: v.optional(v.string()),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const outreach = await ctx.db.get(args.outreachId);
    if (!outreach) return;
    await ctx.db.patch(args.outreachId, {
      status: args.success ? "sent" : "failed",
      messageId: args.messageId,
      threadId: args.threadId,
      error: args.error,
      sentAt: args.success ? Date.now() : undefined,
    });
    if (args.success) {
      const repair = await ctx.db.get(outreach.repairId);
      if (repair && repair.status !== "chosen") {
        await ctx.db.patch(outreach.repairId, { status: "waiting", updatedAt: Date.now() });
      }
      await ctx.db.insert("events", {
        repairId: outreach.repairId,
        type: "asked",
        detail: outreach.toEmail,
        createdAt: Date.now(),
      });
    }
  },
});

export const reserveReply = internalMutation({
  args: {
    externalMessageId: v.string(),
    threadId: v.optional(v.string()),
    fromEmail: v.string(),
    rawText: v.string(),
  },
  handler: async (ctx, args) => {
    const duplicate = await ctx.db
      .query("replies")
      .withIndex("by_external_message", (q) => q.eq("externalMessageId", args.externalMessageId))
      .unique();
    if (duplicate) return { created: false as const, replyId: duplicate._id };

    let outreach = args.threadId
      ? await ctx.db.query("outreach").withIndex("by_thread", (q) => q.eq("threadId", args.threadId)).first()
      : null;
    if (!outreach) {
      const matches = await ctx.db
        .query("outreach")
        .filter((q) => q.and(q.eq(q.field("toEmail"), args.fromEmail), q.eq(q.field("status"), "sent")))
        .order("desc")
        .take(2);
      if (matches.length === 1) outreach = matches[0];
    }
    if (!outreach) return null;
    const replyId = await ctx.db.insert("replies", {
      repairId: outreach.repairId,
      candidateId: outreach.candidateId,
      outreachId: outreach._id,
      externalMessageId: args.externalMessageId,
      threadId: args.threadId,
      fromEmail: args.fromEmail,
      rawText: args.rawText,
      canTakeJob: "unclear",
      extractionStatus: "failed",
      receivedAt: Date.now(),
    });
    return { created: true as const, replyId };
  },
});

export const finishReply = internalMutation({
  args: {
    replyId: v.id("replies"),
    canTakeJob: v.union(v.literal("true"), v.literal("false"), v.literal("unclear")),
    arrivalText: v.optional(v.string()),
    priceAmount: v.optional(v.number()),
    currency: v.optional(v.string()),
    note: v.optional(v.string()),
    extractionStatus: v.union(v.literal("parsed"), v.literal("failed")),
  },
  handler: async (ctx, args) => {
    const reply = await ctx.db.get(args.replyId);
    if (!reply) return;
    const { replyId, ...patch } = args;
    await ctx.db.patch(replyId, patch);
    const repair = await ctx.db.get(reply.repairId);
    if (repair && repair.status !== "chosen") {
      await ctx.db.patch(repair._id, { status: "options_ready", updatedAt: Date.now() });
    }
    await ctx.db.insert("events", {
      repairId: reply.repairId,
      type: "reply_received",
      detail: args.extractionStatus,
      createdAt: Date.now(),
    });
  },
});

export const resetDemo = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const current = await ctx.db.query("repairs").filter((q) => q.eq(q.field("archivedAt"), undefined)).collect();
    for (const repair of current) await ctx.db.patch(repair._id, { archivedAt: now, updatedAt: now });
    return current.length;
  },
});
