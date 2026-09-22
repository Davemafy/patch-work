import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { readInboundEvent } from "./lib";
import { Webhook } from "svix";

const http = httpRouter();

http.route({
  path: "/agentmail/webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const secret = process.env.AGENTMAIL_WEBHOOK_SECRET;
    if (!secret) return new Response("Webhook secret is not configured", { status: 503 });
    const raw = await request.text();
    let payload: unknown;
    try {
      payload = new Webhook(secret).verify(raw, {
        "svix-id": request.headers.get("svix-id") ?? "",
        "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
        "svix-signature": request.headers.get("svix-signature") ?? "",
      });
    } catch {
      return new Response("Invalid signature", { status: 401 });
    }
    const event = readInboundEvent(payload);
    if (!event) return new Response(null, { status: 204 });
    await ctx.runAction(internal.integrations.processInbound, {
      externalMessageId: event.messageId,
      threadId: event.threadId,
      fromEmail: event.fromEmail,
      rawText: event.text,
    });
    return Response.json({ received: true });
  }),
});

http.route({
  path: "/demo/reset",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const expected = process.env.DEMO_RESET_SECRET;
    if (!expected || request.headers.get("authorization") !== `Bearer ${expected}`) {
      return new Response("Not found", { status: 404 });
    }
    const archived = await ctx.runMutation(internal.repairs.resetDemo, {});
    return Response.json({ archived });
  }),
});

export default http;
