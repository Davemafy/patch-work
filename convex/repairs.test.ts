// @vitest-environment edge-runtime
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.ts");

async function setupCandidate() {
  const t = convexTest(schema, modules);
  const repair = await t.mutation(api.repairs.create, {
    description: "My bedroom doorknob turns but the door will not open.",
    area: "Bwari, Abuja",
  });
  await t.mutation(internal.repairs.markLooking, { repairId: repair.repairId });
  await t.mutation(internal.repairs.saveDiscovery, {
    repairId: repair.repairId,
    category: "door and lock repair",
    searchQuery: "door lock repair",
    candidates: [{
      name: "Tunde Repairs",
      website: "https://tunde.example",
      contactEmail: "tunde@example.com",
      contactSourceUrl: "https://tunde.example/contact",
      serviceEvidence: "Door and lock repair is listed on the service page.",
      sourceUrl: "https://tunde.example/doors",
    }],
  });
  const candidate = await t.run(async (ctx) => ctx.db.query("candidates").first());
  if (!candidate) throw new Error("Candidate setup failed");
  return { t, repair, candidate };
}

describe("repair truth and idempotency", () => {
  it("does not reserve duplicate outreach and allows a failed send to retry", async () => {
    const { t, repair, candidate } = await setupCandidate();
    const first = await t.mutation(internal.repairs.reserveOutreach, {
      repairId: repair.repairId,
      candidateId: candidate._id,
    });
    expect(first?.created).toBe(true);
    const duplicate = await t.mutation(internal.repairs.reserveOutreach, {
      repairId: repair.repairId,
      candidateId: candidate._id,
    });
    expect(duplicate?.created).toBe(false);
    await t.mutation(internal.repairs.finishOutreach, {
      outreachId: first!.outreachId,
      success: false,
      error: "Temporary failure",
    });
    const retry = await t.mutation(internal.repairs.reserveOutreach, {
      repairId: repair.repairId,
      candidateId: candidate._id,
    });
    expect(retry).toMatchObject({ created: true, outreachId: first!.outreachId });
  });

  it("deduplicates inbound replies, persists a choice, and ignores late status changes", async () => {
    const { t, repair, candidate } = await setupCandidate();
    const outreach = await t.mutation(internal.repairs.reserveOutreach, {
      repairId: repair.repairId,
      candidateId: candidate._id,
    });
    await t.mutation(internal.repairs.finishOutreach, {
      outreachId: outreach!.outreachId,
      success: true,
      messageId: "sent_1",
      threadId: "thread_1",
    });
    const reply = await t.mutation(internal.repairs.reserveReply, {
      externalMessageId: "incoming_1",
      threadId: "thread_1",
      fromEmail: "tunde@example.com",
      rawText: "I can come today at 2. It'll be ₦12,000.",
    });
    expect(reply?.created).toBe(true);
    const duplicate = await t.mutation(internal.repairs.reserveReply, {
      externalMessageId: "incoming_1",
      threadId: "thread_1",
      fromEmail: "tunde@example.com",
      rawText: "I can come today at 2. It'll be ₦12,000.",
    });
    expect(duplicate).toMatchObject({ created: false, replyId: reply!.replyId });
    await t.mutation(internal.repairs.finishReply, {
      replyId: reply!.replyId,
      canTakeJob: "true",
      arrivalText: "today at 2",
      priceAmount: 12000,
      currency: "NGN",
      extractionStatus: "parsed",
    });
    await t.mutation(api.repairs.choose, { repairId: repair.repairId, candidateId: candidate._id });

    const lateReply = await t.mutation(internal.repairs.reserveReply, {
      externalMessageId: "incoming_2",
      threadId: "thread_1",
      fromEmail: "tunde@example.com",
      rawText: "Actually, 2:30 is better.",
    });
    await t.mutation(internal.repairs.finishReply, {
      replyId: lateReply!.replyId,
      canTakeJob: "true",
      arrivalText: "2:30",
      extractionStatus: "parsed",
    });
    const saved = await t.query(api.repairs.getByPublicId, { publicId: repair.publicId });
    expect(saved).toMatchObject({ status: "chosen", chosenCandidateId: candidate._id });
    expect(saved?.replies).toHaveLength(2);
  });
});
