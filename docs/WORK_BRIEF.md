# Patch Work execution brief

You own the end-to-end result. Do not stop at a plan.

Build Patch from this repository and keep the product contract in `docs/PRODUCT.md` binding.

## Complete journey

**tell Patch what broke → find people who handle it → ask for real price/time → receive their replies → choose someone**

## Required stack behavior

### Convex
Use Convex as the real source of truth for repairs, candidates, outreach, replies, selection, and live UI updates.

### Firecrawl
Find a small number of plausible repair businesses and preserve the public source showing they handle the relevant repair.

Do not infer live availability or price from public web pages.

### AgentMail
Send ordinary repair requests and receive ordinary replies. A repair person must not need a Patch account.

### OpenAI
Use OpenAI only where interpretation helps:
- turn the user's repair description into useful search context
- extract facts actually present in a repair-person reply

Never invent a price, time, acceptance, or service claim.

## Consumer flow

1. Something broke?
2. Describe what happened
3. Optional photo
4. Area/location input
5. Find people who handle it
6. Show source-backed evidence
7. Ask for price and time
8. Waiting state
9. Real replies appear
10. Who should take the job?
11. Confirmation

## Demo scenario

“My bedroom doorknob is broken. The handle turns but the door won’t open properly.”

Target magic moment:

A repair person sends a real reply such as:

“I can come today around 2. Callout is ₦12,000.”

Patch updates live to:

**Tunde can come today around 2 PM · ₦12,000**

without manual copying.

## Product constraints

Do not add:
- payments
- maps
- contractor accounts
- landlord/property-management features
- ratings marketplace
- subscriptions
- giant dashboard
- generic AI chatbot
- extra features outside the core journey

## Product writing

The interface must sound human, specific, and calm.

Do not expose words such as webhook, provider, orchestration, extraction, mutation, state machine, agent workflow, or structured data.

Prefer:

- “We’ve asked 3 people who handle this kind of repair.”
- “Tunde can come today at 2 PM for ₦12,000.”
- “Who should take the job?”

## Visual direction

Make it feel like a polished consumer utility, not a hackathon dashboard.

Mobile-first. Strong typography. Generous spacing. Obvious primary action. Excellent waiting/reply states.

Avoid gradient soup, pill spam, fake status theatre, excessive cards, tiny text, and generic SaaS layouts.

## Reliability

- duplicate replies must not create duplicate options
- duplicate sends must not email someone twice
- late replies must not undo the user's chosen repair person
- source-backed website claims must stay separate from repair-person claims
- unclear replies stay unclear

## Finish line

Also finish:
- env documentation
- deterministic demo/reset path
- README
- `hackathon.md`
- production build
- basic failure handling
- end-to-end demo verification

Do not ask for product decisions. Only stop for a secret, authentication step, or external action that genuinely requires the user.

Prioritize a working 90-second demo over extra features.
