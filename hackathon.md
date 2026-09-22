# Patch — All Gas Hackathon

## What it does

Patch is for the ordinary moment when something small breaks at home and finding someone becomes a chain of calls.

The person explains the problem once. Patch finds a few local businesses whose public websites say they handle that repair, asks them for a real price and time by email, brings their replies back into the product, and lets the person choose.

`describe the repair → find relevant people → ask for price/time → receive real replies → choose someone`

## Why it is useful

A list of repair businesses is not the answer. The user still has to contact each one and repeat the problem to learn who can actually come and what it may cost. Patch handles that repetitive asking while leaving the consequential decision with the user.

The repair person receives and replies to an ordinary email. They do not need a Patch account, dashboard, or app.

## Demo journey

The demo starts with:

> My bedroom doorknob is broken. The handle turns but the door won’t open properly.

Patch finds explicit door/lock repair evidence near the entered area. The user selects contactable matches and clicks **Ask for price and time**. AgentMail sends the real request. When a repair person replies:

> I can come today at 2. It’ll be ₦12,000.

the signed inbound webhook reaches Convex, OpenAI extracts only those stated facts, and the live UI shows the time and ₦12,000. The original reply remains available. The user chooses that person, refreshes, and the chosen state remains.

## Sponsor stack

### Convex

Convex is the source of truth for repairs, candidates, evidence, outreach reservations, replies, extracted facts, the chosen candidate, and event history. Actions contain server-only integrations. HTTP actions receive signed AgentMail events. File storage handles optional photos. The React client uses a live query, so a reply changes the page without polling or refresh.

### Firecrawl

Firecrawl's v2 search receives the repair context and area. Patch requests source-page markdown, then stores a small set of strong matches with name, website, public email when present, service evidence, and exact source URL. Web evidence is never presented as availability.

### AgentMail

AgentMail sends ordinary text-and-HTML emails from a real inbox. One outreach record is reserved before each send. Incoming `message.received` events are signature-verified, correlated by thread ID, deduplicated by message ID, and stored before interpretation.

### OpenAI

OpenAI strict structured output creates conservative search context and extracts a narrow reply schema: willingness, stated arrival wording, stated price, currency, and note. Missing values remain empty. On extraction failure, Patch exposes the raw reply rather than guessing.

## Truth boundary

A website may establish that a business exists, offers a service, publishes contact details, or states a service area. It cannot establish availability, willingness, arrival time, price, acceptance, or that anyone is “verified.” Only the business's actual reply may establish those facts. The user makes the final choice; Patch never silently books or spends money.

## Reliability

- repeated clicks cannot send the same person twice for one repair
- failed sends can retry without a second outreach record
- webhook signatures are checked before parsing
- a repeated AgentMail delivery creates one reply
- raw replies are stored before AI extraction
- partial replies display only stated facts
- late replies cannot change a completed choice
- empty search, partial contact coverage, waiting, and missing configuration have explicit states
- a secret-protected reset archives demo data without deleting configuration

## Setup and demo

Setup, environment, reset and deployment instructions are in [`README.md`](README.md). The exact recording run is in [`docs/DEMO.md`](docs/DEMO.md).

## Production

- App: added after the first verified production deployment
- Source: https://github.com/Davemafy/patch-work

## Known limitation

Patch only sends to public email addresses present in discovered source material. A relevant business without a public email can still appear with its evidence, but Patch clearly marks that it cannot ask them. This is preferable to guessing an address or simulating outreach.
