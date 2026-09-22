# Patch Work — full execution brief

You are taking full ownership of an unfinished hackathon product and must carry it through to a working, recording-ready submission.

Do not stop at planning.
Do not give me a roadmap instead of implementing.
Inspect the repository, make the changes, run the app, test the real flow, repair failures, and continue until the end-to-end product works.

## Project

Product: Patch

Repository:
`https://github.com/Davemafy/patch-work.git`

Repository name:
`Davemafy/patch-work`

Before making changes, read these files and treat them as binding:

- `docs/PRODUCT.md`
- `docs/WORK_BRIEF.md`
- `hackathon.md`
- `README.md`

Inspect the existing repository before deciding what to reuse.

Do not blindly restart the project.

If useful work exists, preserve it.

You are now the lead engineer, product integrator, QA owner, and deployment owner.

---

# What Patch is

Patch is for normal people dealing with things that break at home.

The clearest description is:

> Something broke at home? Tell Patch. We’ll get you real prices and times from people who can fix it.

Examples:

- broken doorknob
- leaking tap
- faulty socket
- AC not cooling
- stuck door
- broken cabinet hinge
- toilet problem
- small appliance issue
- similar everyday home repairs

Patch is NOT primarily a landlord or property-management product.

Patch is NOT a generic chatbot.

Patch is NOT merely a directory of tradespeople.

Patch is NOT an AI diagnosis app.

Its value is:

The user explains the problem once.

Patch finds a small number of relevant people.

Patch asks them who can actually take the job, when they can come, and roughly what they will charge.

Their real replies come back into Patch.

The user compares the actual answers and chooses someone.

---

# The only core journey

The complete product journey is:

**tell Patch what broke  
→ find people who handle it  
→ ask them for price and time  
→ receive actual replies  
→ show those replies in Patch  
→ choose someone**

Everything in the build should strengthen this journey.

Do not add unrelated functionality.

---

# The demo story

The primary demo scenario is:

> My bedroom doorknob is broken. The handle turns but the door won’t open properly.

The user should be able to:

1. Open Patch.
2. Describe the problem.
3. Optionally add a photo.
4. Enter their area/location.
5. Submit the repair.
6. See Patch looking for people who handle that kind of work.
7. See a small number of relevant repair people/businesses.
8. See honest evidence for why they are relevant, such as:
   > Door and lock repairs listed on their website.
9. Choose who to ask.
10. Press something like:
    > Ask for price and time
11. Patch sends real outreach.
12. A repair person receives an ordinary message/email.
13. They reply normally without creating a Patch account.
14. Their reply comes back into Patch.
15. Patch extracts only facts genuinely stated in that reply.
16. The UI updates live.
17. The user sees something like:

    **Tunde**  
    Today, around 2 PM  
    ₦12,000

18. The user chooses Tunde.
19. Patch ends with something like:

    > Tunde is coming today around 2 PM.

The magic moment is:

**The repair person replies outside Patch, and Patch changes automatically without the user copying anything.**

That moment must work reliably.

---

# Product truth rules

These are hard constraints.

A website may establish:

- the person/business exists
- what services they publicly say they offer
- their public contact information
- possibly the area they publicly say they serve

A website does NOT establish:

- current availability
- willingness to take this specific job
- arrival time
- price
- acceptance
- that they are “verified”

Do not invent or infer those facts.

Only a real repair-person reply may establish:

- whether they can take the job
- when they can come
- what price they mentioned
- other conditions they explicitly stated

Preserve the original reply.

If something is ambiguous, leave it ambiguous.

Do not let the model invent missing price/time information.

The user chooses the repair person.

Patch must not silently hire someone or spend money.

---

# Technical requirements

Use the sponsor stack meaningfully.

## Convex

Convex must be the real backend and source of truth.

Use it for things such as:

- repair requests
- discovered repair people
- source evidence
- outreach attempts
- replies
- extracted reply facts
- chosen repair person
- event/history records where useful
- live UI updates

The frontend should react to Convex data rather than pretending with local fake state.

Use a simple status vocabulary that supports the product flow:

`reported → looking → waiting → options_ready → chosen`

If you must change a shared contract, update every consumer and document why.

## Firecrawl

Firecrawl should perform real work.

Given:

- the repair description
- the repair category inferred from it
- the user’s area/location

find a small number of plausible repair businesses or people.

For each candidate, keep:

- name
- website
- contact email if publicly available
- public service evidence
- source URL

Example:

**Name:**  
ABC Locks & Doors

**Evidence:**  
Door lock repair and replacement

**Source:**  
their own service page

Prefer a small number of strong candidates over a giant noisy directory.

Do not use Firecrawl output to fake real-time availability.

## AgentMail

AgentMail must perform real outbound and inbound work.

A repair person should NOT need:

- a Patch account
- a Patch dashboard
- a new app
- a special portal

They should receive an ordinary message/email.

A message should be understandable by a real tradesperson.

Example:

> Hi, someone nearby needs help with a bedroom doorknob. The handle turns but the door isn’t opening properly.
>
> Are you available today or tomorrow?
>
> If so, please reply with when you could come and roughly what you’d charge.

Avoid robotic language.

When they reply, the reply should enter the Patch system through the actual inbound path.

Wire the webhook or inbound mechanism correctly.

Store enough message identity to prevent duplicates.

## OpenAI

OpenAI should perform useful interpretation, but not become the visible product.

Use it where appropriate for:

1. Understanding the user’s repair description.
2. Turning a vague repair description into useful search context.
3. Reading repair-person replies.
4. Extracting facts from those replies.

For an inbound repair-person reply, extract things such as:

- `canTakeJob: true | false | unclear`
- `arrivalText`
- `priceAmount`
- `currency`
- `note`

Never invent a value.

If no price exists:

`priceAmount = null`

If timing is vague:

preserve the actual wording where useful.

Example:

Reply:

> Yes, around 2 should work. Callout is 12k.

Good output:

- `canTakeJob: true`
- `arrivalText: "around 2"`
- `priceAmount: 12000`
- `currency: "NGN"`

Reply:

> I should be able to help. Call me tomorrow.

Good output:

- `canTakeJob`: unclear or true only if the wording clearly supports it
- `arrivalText: "tomorrow"` only if appropriate
- `priceAmount: null`

Preserve raw reply text alongside extracted facts.

---

# Reliability requirements

Do not build a happy-path toy.

At minimum protect against:

1. **The same inbound email/reply arriving twice.**  
   It must not create two options.

2. **The user pressing outreach twice.**  
   Do not send duplicate requests to the same person for the same repair.

3. **A late reply arriving after the user already chose someone.**  
   It may still be recorded, but it must not undo or replace the chosen person.

4. **AI extraction failure.**  
   Keep the original reply visible/available and fail safely.

5. **Firecrawl returning poor or incomplete information.**  
   The app should degrade gracefully rather than crash.

6. **No repair people found.**  
   Show a useful human state.

7. **No replies yet.**  
   Show a calm waiting state.

8. **Some repair people reply while others do not.**  
   Show what is known without waiting forever for everyone.

9. **Missing secrets or external-service configuration.**  
   Fail with actionable setup information, not a blank screen.

Prefer a small working reliable product over broad features.

---

# User experience

This must feel like a real consumer product.

Not:

- an admin dashboard
- a developer tool
- an agent observability UI
- a generic hackathon template
- an AI chatbot
- a property-management SaaS

Design mobile-first.

Desktop should still look polished.

The app should be understandable in roughly five seconds.

The homepage should communicate immediately that Patch helps when something at home breaks.

A direction such as:

> Something broke?

> Tell Patch what happened. We’ll get you real prices and times from people who can fix it.

is appropriate.

Do not treat this wording as sacred if better human writing improves it.

The product voice should be:

- calm
- confident
- specific
- warm without fake friendliness
- concise
- written like a strong human product copywriter

Avoid user-facing words such as:

- provider
- workflow
- orchestration
- state
- mutation
- webhook
- extraction
- agent
- structured data
- pipeline
- inference
- service execution

Do not show:

> Provider response received

Show:

> Tunde can come today around 2 PM.

Do not show:

> Outreach initiated

Show:

> We’ve asked 3 people who handle this kind of repair.

Do not show:

> Select provider

Show:

> Who should take the job?

Do not show:

> Processing vendor response

Show something natural if processing is briefly necessary.

---

# Visual direction

Make Patch look intentionally designed.

Aim for:

- excellent typography
- strong hierarchy
- generous spacing
- restrained use of surfaces
- clear action states
- careful mobile layout
- subtle motion when it helps
- high-quality waiting states
- obvious current repair status
- strong visual distinction between:
  - what Patch found on the web
  - what a real person later replied

Avoid common AI-generated UI fingerprints:

- gradient soup
- glowing blobs
- excessive rounded cards
- pills for everything
- icon-in-a-rounded-square everywhere
- tiny grey explanatory copy
- giant generic SaaS dashboard
- decorative charts
- fake metrics
- fake “live” indicators
- all-caps microcopy everywhere
- unnecessary side navigation
- excessive explanatory paragraphs
- five equal cards in a row
- visual noise

The interface should feel closer to a polished modern consumer utility than a B2B control panel.

Use responsive layouts.

Do not make important text tiny.

---

# Screens / states

You may choose the exact routing and layout, but the experience must clearly support these states.

## Home

Immediate understanding.

Primary action:

> Tell Patch what broke

## Report problem

Inputs should include only what we genuinely need.

Likely:

- description
- optional photo
- area/location

Do not turn this into a 12-field form.

## Looking

Something like:

> Finding people who handle this kind of repair

Show useful progress without fake precision.

## People found

Show a small number of candidates.

Example:

**Tunde Repairs**

Door and lock repairs listed on their website.

Source link available.

Do not show fake rating/count information unless it came from a real source and is genuinely useful.

Main action:

> Ask for price and time

## Waiting

Example:

> We’ve asked 3 people.

Then something natural about replies appearing here.

The page should remain useful as replies arrive one by one.

## Options / replies

Real reply-derived information becomes the main material.

Example:

**Tunde**  
Today, around 2 PM  
₦12,000

**Musa**  
Tomorrow morning  
₦9,500

If something was not stated, do not fill it with a guess.

The user should be able to inspect the original message if needed.

## Choose

Question:

> Who should take the job?

Do not frame it like a technical approval screen.

## Done

Example:

> Tunde is coming today around 2 PM.

Keep it satisfying and simple.

---

# Photo support

The user may optionally attach a repair photo.

Implement this only if it can be done reliably without threatening the core demo.

If supported:

- store/upload it correctly
- show it in the repair
- make sure the flow works on mobile
- do not make photo upload mandatory

If photo support starts consuming disproportionate time, preserve the input design but prioritize the working core loop.

---

# Not in scope

Do not add:

- payments
- escrow
- subscriptions
- contractor accounts
- contractor dashboards
- maps
- live GPS tracking
- messaging/chat room
- landlord functionality
- tenant functionality
- rent collection
- leases
- invoices
- ratings marketplace
- review system
- bidding marketplace
- automatic hiring
- automatic spending
- insurance
- predictive maintenance
- analytics dashboard
- AI repair diagnosis
- AR features
- SMS unless absolutely necessary for the existing real flow
- WhatsApp integration
- giant service marketplace
- social features

Do not invent “nice to have” features.

If something does not improve the recording-ready core flow, skip it.

---

# Code quality

Keep the implementation understandable.

Use TypeScript.

Do not introduce unnecessary frameworks.

Use a simple React/Vite structure unless there is a strong implementation reason to change it.

Keep integration code separated enough that failures can be debugged quickly.

Centralize shared types.

Validate external input.

Do not expose server secrets to the browser.

Keep sponsor credentials server-side.

Use environment variables.

Update `.env.example` with every required variable but never commit real secrets.

Leave comments only where they genuinely clarify unusual logic.

Architecturally preserve these responsibilities even if you choose your own file layout:

- core repair truth
- web discovery
- mail
- AI interpretation
- frontend

---

# Build order

Work in the order that gets to an actual vertical slice fastest.

First understand the repo.

Then get the smallest real path working:

1. Create repair.
2. Store in Convex.
3. Display it from Convex.
4. Discover real candidates.
5. Store them.
6. Send real outreach.
7. Receive one real reply.
8. Parse it.
9. Store it.
10. Make the UI update.
11. Choose the repair person.

After that:

- improve visual quality
- improve waiting/error states
- harden duplicate handling
- improve reset/demo tooling
- finish docs
- deploy
- record-ready QA

Do not spend the first half of the task polishing the landing page while the email loop is still fake.

---

# Reality over demo theatre

Do not fake sponsor integrations just to make the interface move.

The hackathon demo should be able to show:

- Firecrawl really finding evidence
- AgentMail really sending
- a real inbound reply
- OpenAI really interpreting that reply
- Convex really updating the app

Where a deterministic backup is needed for demo safety, clearly separate:

**REAL MODE**

from

**DEMO RESET / SEEDED DATA**

Do not silently present seeded content as if it came from a real external event.

---

# Demo safety

Create a practical demo reset path.

I should be able to get Patch back into a clean recording state quickly.

For example:

- clear or archive previous demo repair
- create known demo repair
- remove old replies/outreach
- leave external configuration intact

Do not expose a dangerous public destructive admin button.

A protected/internal or development-only reset mechanism is fine.

Document exactly how to use it.

---

# Testing

You are responsible for testing your work.

At minimum verify:

- production build succeeds
- TypeScript succeeds
- main page loads
- repair creation works
- data persists in Convex
- live updates work
- Firecrawl path works with real credentials
- AgentMail outbound works
- AgentMail inbound works
- OpenAI extraction works
- duplicate inbound handling works
- selection persists
- mobile viewport is usable
- desktop viewport is usable
- refresh does not lose the active repair
- empty/error states do not crash
- secrets are not bundled into the frontend

If external credentials are missing, finish everything that can be finished and stop only when that exact external secret/action is required.

Do not use missing credentials as an excuse to stop early.

---

# Deployment

Leave a production-ready build.

Deploy the app to an allowed public destination for the hackathon.

Use the existing project/deployment setup if one already exists.

If deployment credentials or an account choice requires me, ask only when that action becomes necessary.

Do not ask me setup questions that you can answer by inspecting the repository or documentation.

After deployment:

- open the production app
- test the real production URL
- verify environment variables
- run through the core journey
- fix production-only failures
- verify mobile rendering
- verify refresh/deep state behavior

Do not declare the project finished merely because local development works.

---

# hackathon.md

Finish `hackathon.md`.

It should explain clearly:

- what Patch does
- the everyday problem
- why the product is useful
- the demo journey
- how Convex is used
- how Firecrawl is used
- how AgentMail is used
- how OpenAI is used
- the important truth boundary between public web evidence and actual repair-person replies
- setup instructions
- production URL
- demo instructions
- any known limitations

Write it like an engineer who actually built the thing.

Avoid AI-generated hype.

---

# README

Finish `README.md` with:

- concise product explanation
- screenshot/demo section if appropriate
- stack
- local setup
- environment variables
- Convex setup
- AgentMail setup
- Firecrawl setup
- OpenAI setup
- run commands
- architecture explanation
- demo/reset instructions
- deployment information

Keep it clean.

---

# Submission readiness

Before finishing, prepare everything needed to record and submit:

- working public app
- clean public GitHub repository
- root `hackathon.md`
- clear README
- no secrets committed
- no obviously dead code
- no fake integrations
- no broken links
- no unfinished placeholder copy visible to judges
- known demo scenario ready
- deterministic reset path
- final demo sequence documented

Also create:

`docs/DEMO.md`

with the exact recommended recording sequence.

Target recording should be around 90 seconds if possible and comfortably under 3 minutes.

The demo should spend almost no time explaining architecture.

Show the actual product.

Recommended story:

**0–10s**  
“My bedroom doorknob broke.”

**10–25s**  
Submit it and show Patch finding relevant people.

**25–40s**  
Ask them for price and time.

**40–55s**  
Show the actual outbound message.

**55–70s**  
Send a real reply from the repair-person side.

**70–80s**  
Return to Patch and show the reply appearing automatically.

**80–90s**  
Choose the repair person.

End on:

> Tunde is coming today around 2 PM.

---

# Copy standard

Before finalizing, inspect every piece of visible copy.

Remove phrases that sound generated, corporate, or technical.

Bad:

> Service provider outreach initiated.

Good:

> We’ve asked 3 people.

Bad:

> AI analysis complete.

Good:

No message at all if the user does not need to know.

Bad:

> Provider evidence verified.

Good:

> Door and lock repairs are listed on their website.

Bad:

> Repair request successfully created.

Good:

> We’re on it.

Use language a real consumer product would use.

---

# Visual QA standard

Before declaring completion, inspect the app screen by screen.

Fix:

- awkward spacing
- small text
- weird card nesting
- unnecessary borders
- weak hierarchy
- bad mobile wrapping
- generic placeholder icons
- repetitive pills
- overlong paragraphs
- inconsistent button sizing
- dead space
- awkward loading states
- misaligned content
- desktop layouts that simply stretch the mobile screen badly

The finished product should look deliberate enough to record without apologizing for the UI.

---

# When to ask me

Do not repeatedly ask me for approval.

Make reasonable engineering decisions yourself.

Only interrupt me when you genuinely require something only I can provide, such as:

- an API key
- account authentication
- verification email
- a deployment authorization
- a domain/account choice that cannot be inferred

When you need one of these, tell me:

1. exactly what you need
2. where to obtain it
3. where it must be added
4. what you will do immediately after I provide it

Then continue.

---

# Final acceptance test

Do not call Patch complete until this statement is true:

**A new user can open the deployed app, describe a broken doorknob, have Patch find relevant repair people from the public web, send real requests for price and time, receive at least one real repair-person reply through AgentMail, have OpenAI extract only the facts contained in that reply, see the result appear live through Convex, choose that person, refresh the app, and still see the correct repair state.**

And:

- the UI looks recording-ready
- the public build works
- README is finished
- `hackathon.md` is finished
- demo reset works
- demo instructions exist
- no secret is exposed
- no core step is simulated without being clearly identified

---

# Priority rule

When forced to choose between:

**more features**

and

**a stronger working core demo**

always choose the stronger working core demo.

When forced to choose between:

**architecture elegance**

and

**getting the real external loop working safely**

get the real loop working.

When forced to choose between:

**explaining the product**

and

**making the product obvious through interaction**

make the product obvious.

---

# Start now

Inspect the repository first.

Then implement.

Do not return with only an implementation plan.

You own the finished result.

Keep working through build errors, integration problems, external-service setup, UI cleanup, testing, deployment, and demo preparation until Patch is genuinely recording-ready.

Only stop for an external credential, authentication step, or action that genuinely requires me.
