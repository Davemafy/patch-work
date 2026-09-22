# Patch

Something broke at home? Tell Patch. It finds a few people whose public websites say they handle that repair, asks for their real price and time, and brings their replies back into one place.

`describe the repair → find relevant people → ask for price/time → receive real replies → choose someone`

Patch keeps two kinds of evidence separate:

- A public website can establish service fit and public contact details.
- Only the repair person's reply can establish availability, timing, price, or willingness to take this job.

## Stack

- React 19, Vite and TypeScript
- Convex database, actions, file storage, live queries and HTTP actions
- Firecrawl search with source-page content
- AgentMail outbound email and signed inbound webhooks
- OpenAI GPT-OSS served through Groq's OpenAI-compatible Responses API with strict JSON schemas
- Vitest and `convex-test`

## Architecture

The browser writes a repair to Convex and subscribes to one live repair view. A Convex action uses OpenAI to turn the person's description into search context, then asks Firecrawl for source-backed local matches. Selected contact details are stored with their source URL.

When the user asks for price and time, a transaction reserves one outreach record per repair/business pair before AgentMail sends an ordinary email. AgentMail posts replies to the signed Convex HTTP endpoint. The raw message is reserved by external message ID before OpenAI extracts conservative facts. Convex updates the UI live. Choosing someone is a final user mutation; later replies are recorded but cannot change that choice.

Sponsor keys are only read by Convex functions. Vite receives only the public Convex deployment URL.

## Local setup

Requires Node.js 20 or newer.

```bash
npm install
npx convex dev
npm run dev
```

`npx convex dev` signs into Convex, creates or links the project, writes `VITE_CONVEX_URL` to `.env.local`, generates the typed API, and syncs backend functions.

### Convex environment variables

Set these on development and production Convex deployments:

```bash
npx convex env set FIRECRAWL_API_KEY fc-...
npx convex env set AGENTMAIL_API_KEY am_...
npx convex env set AGENTMAIL_INBOX_ID patch@agentmail.to
npx convex env set AGENTMAIL_WEBHOOK_SECRET whsec_...
npx convex env set GROQ_API_KEY gsk_...
npx convex env set DEMO_RESET_SECRET a-long-random-value
```

Use `npx convex env set --prod ...` for production. The list is also in `.env.example`. Never prefix a sponsor secret with `VITE_`.

### Firecrawl

Create a Firecrawl API key and set `FIRECRAWL_API_KEY` in Convex. Patch calls the v2 search endpoint with the repair category and area, requests page markdown, and retains service evidence and its source URL. Weak or empty results produce an honest empty state.

### AgentMail

1. Create or choose an AgentMail inbox.
2. Set its address/ID as `AGENTMAIL_INBOX_ID` and its key as `AGENTMAIL_API_KEY` in Convex.
3. In AgentMail, create an inbox webhook for `message.received` pointing to:

   ```text
   https://YOUR-CONVEX-DEPLOYMENT.convex.site/agentmail/webhook
   ```

4. Copy the webhook signing secret (starting `whsec_`) into `AGENTMAIL_WEBHOOK_SECRET`.
5. Send a test message to the inbox. An invalid signature returns 401; a valid unrelated event returns 204.

Outbound requests include text and HTML. An outreach row is reserved before sending, so a second click cannot send the same person another request for the same repair. Failed sends may be retried.

### OpenAI GPT-OSS through Groq

Set `GROQ_API_KEY` in Convex. Patch calls the OpenAI-compatible Responses API at `https://api.groq.com/openai/v1` with `openai/gpt-oss-20b`. GPT-OSS has exactly two narrow jobs with strict structured output: turn a repair description into search context, and turn a raw repair-person reply into conservative facts. Patch stores the original reply before extraction. If extraction fails, the original remains visible and Patch supplies no invented price, time, availability, willingness, or acceptance.

## Commands

```bash
npm run dev          # Vite development server
npm run typecheck    # application and Convex TypeScript
npm run lint         # ESLint
npm test             # parsing + Convex transaction tests
npm run build        # production build
npx convex dev       # sync development backend
npx convex deploy    # deploy production backend
```

## Demo reset

Reset archives active repairs while preserving service configuration:

```bash
curl -X POST \
  -H "Authorization: Bearer $DEMO_RESET_SECRET" \
  https://YOUR-CONVEX-DEPLOYMENT.convex.site/demo/reset
```

The endpoint returns 404 when the secret is absent or wrong and is not exposed in the UI. After reset, open the app without a `?repair=` query. See [`docs/DEMO.md`](docs/DEMO.md) for the recording run.

## Production deployment

Production deploys run through [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). GitHub Actions reads the production `CONVEX_DEPLOY_KEY` from the repository secret, verifies that it resolves to the production deployment of the `patch-work` Convex project, derives `VITE_CONVEX_URL` from that verified deployment, embeds the static build in the Convex bundle, and runs `npx convex deploy`. The deploy key identifies the production deployment; `CONVEX_DEPLOYMENT` is not required. The workflow refuses development keys and keys for any other project.

Generate that key from Convex dashboard → team `david-imafidon` → project `patch-work` → deployment `Production` (`coordinated-iguana-167`). The guarded dry run verifies both the project identity and deployment name before any production write.

The same deployment serves both boundaries:

- App: `https://coordinated-iguana-167.convex.site`
- AgentMail webhook: `https://coordinated-iguana-167.convex.site/agentmail/webhook`

The production Convex environment must contain `FIRECRAWL_API_KEY`, `AGENTMAIL_API_KEY`, `AGENTMAIL_INBOX_ID`, `AGENTMAIL_WEBHOOK_SECRET`, and `GROQ_API_KEY`. `OPENAI_API_KEY` is not used. Pushes to `main` and manual workflow dispatches run the complete deployment gate.

After the workflow succeeds, run the real email journey from the public app; a green workflow alone is not acceptance evidence.

## Tested guarantees

- one outreach reservation per repair/person, with retry after a failed send
- one stored reply per AgentMail message ID
- signed webhook verification before processing
- raw reply retained even when AI extraction fails
- late replies cannot replace or undo a chosen person
- chosen state survives refresh because the URL and Convex record are authoritative
- mobile-first responsive layout with reduced-motion support

## Current limitation

Patch only sends where Firecrawl finds a public email address in the business's source material. It deliberately does not guess an address or pretend a phone-only business was contacted.
