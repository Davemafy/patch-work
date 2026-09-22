import { v } from "convex/values";
import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { cleanEmail, type ReplyFacts, type RepairUnderstanding, safeText } from "./lib";

const GROQ_RESPONSES_URL = "https://api.groq.com/openai/v1/responses";
const GPT_OSS_MODEL = "openai/gpt-oss-20b";

async function gptOssJson<T>(name: string, schema: Record<string, unknown>, prompt: string): Promise<T> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not configured in Convex.");
  const response = await fetch(GROQ_RESPONSES_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GPT_OSS_MODEL,
      input: prompt,
      text: { format: { type: "json_schema", name, strict: true, schema } },
    }),
  });
  if (!response.ok) throw new Error(`GPT-OSS through Groq failed (${response.status}): ${await response.text()}`);
  const json = (await response.json()) as {
    output_text?: string;
    output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
  };
  // The raw Responses API payload contains reasoning and message items. The
  // SDK's `output_text` convenience property is not present in raw JSON, so
  // select only the assistant message's final `output_text` content.
  const text = json.output_text ?? json.output
    ?.filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text" && typeof item.text === "string")
    ?.text;
  if (!text) throw new Error("GPT-OSS through Groq returned no structured output.");
  return JSON.parse(text) as T;
}

export const discover = action({
  args: { repairId: v.id("repairs") },
  handler: async (ctx, { repairId }) => {
    const started = await ctx.runMutation(internal.repairs.markLooking, { repairId });
    if (!started) return;
    try {
    const repair = await ctx.runQuery(internal.repairs.getInternal, { repairId });
    if (!repair) return;
    const understanding = await gptOssJson<RepairUnderstanding>(
      "repair_understanding",
      {
        type: "object",
        additionalProperties: false,
        required: ["category", "searchQuery"],
        properties: { category: { type: "string" }, searchQuery: { type: "string" } },
      },
      `A person in ${repair.area} needs a small home repair. Their exact words: ${JSON.stringify(repair.description)}\nReturn a plain repair category and a concise web search query for local businesses whose own sites explicitly offer that repair. Do not diagnose the fault.`,
    );

    const firecrawlKey = process.env.FIRECRAWL_API_KEY;
    if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY is not configured in Convex.");
    const normalizedSearchQuery = understanding.searchQuery.toLowerCase();
    const searchQuery = (repair.area.toLowerCase().match(/[a-z0-9]+/g) ?? []).some((term) => normalizedSearchQuery.includes(term))
      ? understanding.searchQuery
      : `${understanding.searchQuery} ${repair.area}`;
    const searchResponse = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: searchQuery,
        limit: 20,
        sources: [{ type: "web" }],
        scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
      }),
    });
    if (!searchResponse.ok) throw new Error(`Firecrawl failed (${searchResponse.status}): ${await searchResponse.text()}`);
    const searchJson = (await searchResponse.json()) as Record<string, unknown>;
    const data = (searchJson.data && typeof searchJson.data === "object" ? searchJson.data : searchJson) as Record<string, unknown>;
    const rawResults = (Array.isArray(data.web) ? data.web : Array.isArray(data.data) ? data.data : []).slice(0, 20);
    const sourceMaterial = rawResults.map((item, index) => {
      const row = item as Record<string, unknown>;
      return {
        index,
        title: safeText(row.title, 160),
        url: safeText(row.url ?? row.sourceURL, 500),
        description: safeText(row.description, 500),
        markdown: safeText(row.markdown, 5000),
      };
    });

    const areaTerms = new Set(repair.area.toLowerCase().match(/[a-z0-9]+/g) ?? []);
    const ignoredServiceTerms = new Set(["and", "for", "home", "local", "near", "repair", "repairs", "service", "services"]);
    const queryTerms = [...new Set(understanding.searchQuery.toLowerCase().match(/[a-z0-9]+/g) ?? [])]
      .filter((term) => term.length >= 3 && !areaTerms.has(term) && !ignoredServiceTerms.has(term));
    const categoryTerms = [...new Set(understanding.category.toLowerCase().match(/[a-z0-9]+/g) ?? [])]
      .filter((term) => term.length >= 3 && !ignoredServiceTerms.has(term));
    const serviceTerms = queryTerms.length ? queryTerms : categoryTerms;
    const requiredServiceMatches = Math.min(2, serviceTerms.length);

    // Firecrawl has already ranked these pages for the narrow GPT-OSS search
    // context. Keep candidate selection deterministic so AI has exactly two
    // jobs in Patch: search context and reply fact extraction.
    const candidates = sourceMaterial
      .filter((source) => /^https?:\/\//.test(source.url))
      .filter((source) => !isAggregator(source.url))
      .filter((source) => {
        const pageText = `${source.title}\n${source.description}\n${source.markdown}`.toLowerCase();
        return requiredServiceMatches > 0
          && serviceTerms.filter((term) => pageText.includes(term)).length >= requiredServiceMatches
          && [...areaTerms].some((term) => pageText.includes(term));
      })
      .map((source) => {
        const evidenceLines = `${source.description}\n${source.markdown}`
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        const evidence = safeText(evidenceLines
          .map((line) => ({ line, matches: serviceTerms.filter((term) => line.toLowerCase().includes(term)).length }))
          .filter(({ matches }) => matches > 0)
          .sort((a, b) => b.matches - a.matches)
          .slice(0, 2)
          .map(({ line }) => line)
          .join(" "), 300);
        let website = source.url;
        try { website = new URL(source.url).origin; } catch { /* source URL was validated above */ }
        return {
          name: safeText(source.title.replace(/\s*[|–—-].*$/, ""), 100),
          website: safeText(website, 500),
          contactEmail: cleanEmail(`${source.description}\n${source.markdown}`),
          serviceEvidence: evidence,
          sourceUrl: source.url,
        };
      })
      .filter((candidate) => candidate.name && candidate.serviceEvidence)
      .filter((candidate, index, all) => all.findIndex((other) => other.website === candidate.website) === index)
      .slice(0, 4);

    for (const candidate of candidates) {
      if (candidate.contactEmail) continue;
      const contact = await findPublicEmail(firecrawlKey, candidate.website);
      if (contact) Object.assign(candidate, { contactEmail: contact.email, contactSourceUrl: contact.sourceUrl });
    }
    await ctx.runMutation(internal.repairs.saveDiscovery, {
      repairId,
      category: safeText(understanding.category, 100),
      searchQuery: safeText(understanding.searchQuery, 240),
      candidates,
    });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Search failed unexpectedly.";
      await ctx.runMutation(internal.repairs.saveDiscoveryError, { repairId, message });
    }
  },
});

function isAggregator(rawUrl: string): boolean {
  let host = "";
  try { host = new URL(rawUrl).hostname.replace(/^www\./, ""); } catch { return true; }
  return [
    "daibau.ng",
    "facebook.com",
    "instagram.com",
    "jiji.ng",
    "linkedin.com",
    "starofservice.com.ng",
    "viscorner.com",
    "yelp.com",
    "yellowpages.com",
  ].some((domain) => host === domain || host.endsWith(`.${domain}`));
}

async function findPublicEmail(apiKey: string, website: string): Promise<{ email: string; sourceUrl: string } | null> {
  let host: string;
  try { host = new URL(website).hostname.replace(/^www\./, ""); }
  catch { return null; }
  const response = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `site:${host} contact email`,
      limit: 3,
      sources: [{ type: "web" }],
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });
  if (!response.ok) return null;
  const root = (await response.json()) as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  const rows = (Array.isArray(data.web) ? data.web : Array.isArray(data.data) ? data.data : []) as Array<Record<string, unknown>>;
  for (const row of rows) {
    const sourceUrl = safeText(row.url ?? row.sourceURL, 500);
    let sourceHost = "";
    try { sourceHost = new URL(sourceUrl).hostname.replace(/^www\./, ""); } catch { continue; }
    if (sourceHost !== host && !sourceHost.endsWith(`.${host}`)) continue;
    const email = cleanEmail(`${safeText(row.description, 1000)}\n${safeText(row.markdown, 8000)}`);
    if (email && !/^(noreply|no-reply|example)@/i.test(email)) return { email, sourceUrl };
  }
  return null;
}

export const askCandidates = action({
  args: { repairId: v.id("repairs"), candidateIds: v.array(v.id("candidates")) },
  handler: async (ctx, { repairId, candidateIds }) => {
    const apiKey = process.env.AGENTMAIL_API_KEY;
    const inboxId = process.env.AGENTMAIL_INBOX_ID;
    if (!apiKey || !inboxId) throw new Error("AgentMail is not configured in Convex.");
    const repair = await ctx.runQuery(internal.repairs.getInternal, { repairId });
    const candidates = await ctx.runQuery(internal.repairs.listCandidatesInternal, { repairId });
    if (!repair) throw new Error("Repair not found.");
    const allowed = new Map(candidates.map((candidate) => [candidate._id, candidate]));
    const results: Array<{ candidateId: Id<"candidates">; sent: boolean; reason?: string }> = [];
    for (const candidateId of [...new Set(candidateIds)].slice(0, 4)) {
      const candidate = allowed.get(candidateId);
      if (!candidate?.contactEmail) {
        results.push({ candidateId, sent: false, reason: "No public email found" });
        continue;
      }
      const reservation = await ctx.runMutation(internal.repairs.reserveOutreach, { repairId, candidateId });
      if (!reservation) continue;
      if (!reservation.created) {
        results.push({ candidateId, sent: false, reason: "Already asked" });
        continue;
      }
      const subject = `Repair request in ${repair.area}`;
      const text = `Hi ${candidate.name},\n\nSomeone in ${repair.area} needs help with this home repair:\n\n“${repair.description}”\n\nAre you available today or tomorrow? If so, please reply with when you could come and roughly what you’d charge.\n\nThanks,\nPatch`;
      try {
        const response = await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(inboxId)}/messages/send`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            to: [candidate.contactEmail],
            subject,
            text,
            html: `<p>Hi ${escapeHtml(candidate.name)},</p><p>Someone in ${escapeHtml(repair.area)} needs help with this home repair:</p><blockquote>${escapeHtml(repair.description)}</blockquote><p>Are you available today or tomorrow? If so, please reply with when you could come and roughly what you’d charge.</p><p>Thanks,<br>Patch</p>`,
          }),
        });
        if (!response.ok) throw new Error(`AgentMail failed (${response.status}): ${await response.text()}`);
        const sent = (await response.json()) as { message_id?: string; thread_id?: string };
        await ctx.runMutation(internal.repairs.finishOutreach, {
          outreachId: reservation.outreachId,
          success: true,
          messageId: sent.message_id,
          threadId: sent.thread_id,
        });
        results.push({ candidateId, sent: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not send";
        await ctx.runMutation(internal.repairs.finishOutreach, {
          outreachId: reservation.outreachId,
          success: false,
          error: message.slice(0, 500),
        });
        results.push({ candidateId, sent: false, reason: message });
      }
    }
    if (!results.some((result) => result.sent)) throw new Error("No messages were sent. Choose someone with a public email.");
    return results;
  },
});

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!);
}

export const processInbound = internalAction({
  args: {
    externalMessageId: v.string(),
    threadId: v.optional(v.string()),
    fromEmail: v.string(),
    rawText: v.string(),
  },
  handler: async (ctx, args): Promise<{ accepted: boolean; duplicate: boolean }> => {
    const reservation = await ctx.runMutation(internal.repairs.reserveReply, args);
    if (!reservation || !reservation.created) return { accepted: Boolean(reservation), duplicate: Boolean(reservation) };
    try {
      const facts = await gptOssJson<ReplyFacts>(
        "repair_reply_facts",
        {
          type: "object",
          additionalProperties: false,
          required: ["canTakeJob", "arrivalText", "priceAmount", "currency", "note"],
          properties: {
            canTakeJob: { type: "string", enum: ["true", "false", "unclear"] },
            arrivalText: { type: ["string", "null"] },
            priceAmount: { type: ["number", "null"] },
            currency: { type: ["string", "null"] },
            note: { type: ["string", "null"] },
          },
        },
        `Read this repair person's reply and extract only facts explicitly stated. Never infer a missing time, price, currency, or willingness. Preserve timing in their own concise wording. Nigerian shorthand such as "12k" means 12000 and, only when the context is clearly Nigerian, currency may be NGN. If willingness is hedged, use unclear. Reply:\n${JSON.stringify(args.rawText)}`,
      );
      await ctx.runMutation(internal.repairs.finishReply, {
        replyId: reservation.replyId,
        canTakeJob: facts.canTakeJob,
        arrivalText: facts.arrivalText ?? undefined,
        priceAmount: facts.priceAmount ?? undefined,
        currency: facts.currency ?? undefined,
        note: facts.note ?? undefined,
        extractionStatus: "parsed",
      });
    } catch {
      await ctx.runMutation(internal.repairs.finishReply, {
        replyId: reservation.replyId,
        canTakeJob: "unclear",
        note: "We could not reliably read the details. Check the original reply.",
        extractionStatus: "failed",
      });
    }
    return { accepted: true, duplicate: false };
  },
});
