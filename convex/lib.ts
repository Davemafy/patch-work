export type RepairUnderstanding = {
  category: string;
  searchQuery: string;
};

export type ReplyFacts = {
  canTakeJob: "true" | "false" | "unclear";
  arrivalText: string | null;
  priceAmount: number | null;
  currency: string | null;
  note: string | null;
};

export function cleanEmail(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase();
}

export function safeText(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function readInboundEvent(payload: unknown): {
  eventType: string;
  messageId: string;
  threadId?: string;
  fromEmail: string;
  text: string;
} | null {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const eventType = safeText(root.event_type ?? root.eventType ?? root.type, 100);
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;
  const message = (data.message && typeof data.message === "object" ? data.message : data) as Record<string, unknown>;
  const fromValue = message.from ?? message.from_;
  const fromEmail = Array.isArray(fromValue)
    ? cleanEmail(typeof fromValue[0] === "object" ? (fromValue[0] as Record<string, unknown>).email : fromValue[0])
    : cleanEmail(typeof fromValue === "object" && fromValue ? (fromValue as Record<string, unknown>).email : fromValue);
  const messageId = safeText(message.message_id ?? message.messageId ?? message.id, 300);
  const threadId = safeText(message.thread_id ?? message.threadId, 300) || undefined;
  const text = safeText(message.extracted_text ?? message.extractedText ?? message.text ?? message.body ?? message.preview, 12000);
  if (eventType !== "message.received" || !messageId || !fromEmail || !text) return null;
  return { eventType, messageId, threadId, fromEmail, text };
}

export function formatMoney(amount?: number, currency?: string): string | null {
  if (amount === undefined) return null;
  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency || "NGN"} ${amount.toLocaleString()}`;
  }
}
