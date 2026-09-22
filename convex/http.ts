import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { readInboundEvent } from "./lib";
import { Webhook } from "svix";
import { STATIC_FILES } from "./generatedStatic";

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

function staticResponse(pathname: string): Response {
  const file = STATIC_FILES[pathname];
  if (!file) return new Response("Not found", { status: 404 });
  const binary = atob(file.body);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Response(bytes, {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": pathname === "/index.html" ? "no-cache" : "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    },
  });
}

http.route({
  path: "/",
  method: "GET",
  handler: httpAction(async () => staticResponse("/index.html")),
});

http.route({
  path: "/favicon.svg",
  method: "GET",
  handler: httpAction(async () => staticResponse("/favicon.svg")),
});

http.route({
  pathPrefix: "/assets/",
  method: "GET",
  handler: httpAction(async (_ctx, request) => staticResponse(new URL(request.url).pathname)),
});

export default http;
