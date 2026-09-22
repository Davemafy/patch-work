import { describe, expect, it } from "vitest";
import { cleanEmail, readInboundEvent, safeText } from "../../convex/lib";

describe("AgentMail inbound parsing", () => {
  it("reads the current camelCase message.received payload", () => {
    expect(readInboundEvent({
      type: "event",
      eventType: "message.received",
      eventId: "event_1",
      message: {
        messageId: "msg_1",
        threadId: "thread_1",
        from: "Tunde <tunde@example.com>",
        extractedText: "I can come today at 2. It'll be ₦12,000.",
      },
    })).toEqual({
      eventType: "message.received",
      messageId: "msg_1",
      threadId: "thread_1",
      fromEmail: "tunde@example.com",
      text: "I can come today at 2. It'll be ₦12,000.",
    });
  });

  it("accepts snake_case webhook serialization", () => {
    expect(readInboundEvent({
      event_type: "message.received",
      data: { message: { message_id: "msg_2", thread_id: "thread_2", from_: "musa@example.com", text: "Tomorrow morning." } },
    })?.messageId).toBe("msg_2");
  });

  it("rejects unrelated or incomplete events", () => {
    expect(readInboundEvent({ eventType: "message.sent", message: {} })).toBeNull();
    expect(readInboundEvent({ eventType: "message.received", message: { messageId: "x" } })).toBeNull();
  });

  it("normalizes public emails and bounds external text", () => {
    expect(cleanEmail("Tunde Repairs <HELLO@TUNDE.NG>")).toBe("hello@tunde.ng");
    expect(safeText("  a long answer  ", 6)).toBe("a long");
  });
});
