# Patch recording run

Target: 90–105 seconds. Show the product, not an architecture tour.

Production app: `https://<patch-work-production-deployment>.convex.site`

## Before recording

1. Confirm the production app, Convex deployment, AgentMail webhook, Firecrawl key, and Groq key are live.
2. Send one test round-trip and confirm the reply appears once.
3. Run the protected reset from `README.md`.
4. Open the app without a `?repair=` query.
5. Keep the repair person's email client open in a second window.
6. Prepare this reply without sending it: `I can come today at 2. It'll be ₦12,000.`

## Recording sequence

### 0–8s — The problem

Start on the homepage. Say: “My bedroom doorknob broke. Instead of calling around, I tell Patch once.” Click **Tell Patch what broke**.

### 8–20s — Report it

Use: “My bedroom doorknob is broken. The handle turns but the door won’t open properly.” Enter the real demo area. Skip the optional photo if it slows the take. Submit.

### 20–38s — Real web evidence

Let the search finish. Show two or three candidates and briefly open one **See the source** link.

Say: “Firecrawl found businesses whose own sites list this repair. That proves service fit—not availability.” Select the candidate with the controlled public email and click **Ask for price and time**.

### 38–54s — Real outbound email

Switch to the repair-person inbox. Show the ordinary AgentMail message: the area, exact repair description, and request for time and rough price. Say: “There is no contractor app or account. It’s just email.”

### 54–68s — Real inbound reply

Reply `I can come today at 2. It'll be ₦12,000.` and send it.

### 68–86s — Live result

Return to Patch without refreshing. Show the stated arrival wording, ₦12,000, and expanded original reply.

Say: “AgentMail delivered the reply, OpenAI GPT-OSS through Groq extracted only what was written, and Convex updated Patch live.”

### 86–100s — Human choice and persistence

Click **Choose Tunde**. End on the completed state, then refresh once. Say: “Patch did the chasing. I still made the decision.”

## Guardrails

- Do not call a discovered business “verified.”
- Do not imply web evidence proves current availability.
- Show the real outbound message and real reply.
- Expand the original reply so judges can compare it with extracted facts.
- If an external service stalls, reset and restart. Never present seeded data as a live event.
