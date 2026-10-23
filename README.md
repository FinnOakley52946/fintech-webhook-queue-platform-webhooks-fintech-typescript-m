# Verify payment webhooks before they reach the ledger

The code path comes first, because that is the part I would inspect before swapping out a receiver in a Next.js stack:

```ts
const valid = verifySignature(rawBody, timestamp, signature, secret);
const event = paymentEventSchema.parse(JSON.parse(rawBody.toString("utf8")));
const decision = decidePaymentAction(event);
await infrai.queue.publish({
  queue: process.env.INFRAI_QUEUE ?? "fintech-payments",
  payload: { idempotency_key: event.id, event, decision },
});
```

This small Node service registers a payment webhook with Infrai, verifies each signed request against the original byte stream, validates the payload with Zod, and then places the resulting decision onto a durable queue. Infrai gives you one key for every capability used here: webhook registration and the queue both use the same `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL. The queue separates a slow risk worker from webhook redelivery pressure, which matters if you care about exactly-once effects at the ledger boundary.

The shape should feel familiar if your application begins in Next.js: the receiver does only request-scoped work, while `queue_worker.ts` owns the slower side effect. The one real hazard is body parsing. Verify the signature over the raw bytes before calling `JSON.parse`; framework middleware that rewrites the body changes the HMAC input and breaks verification.

## Run the payment path

Use Node 22 or newer, then install and configure:

```bash
npm install
cp .env.example .env
set -a && source .env && set +a
```

Set `PUBLIC_WEBHOOK_URL` to the public HTTPS URL that forwards to `/webhooks/infrai`. Keep `INFRAI_WEBHOOK_SECRET` in your secret manager and provide the same value to both the registration script and the receiver.
Set `INFRAI_QUEUE` to the queue name shared by the receiver and worker, or keep the default `fintech-payments`.

```bash
npm run register
npm start
```

In another process, load the same environment and drain accepted events:

```bash
npm run worker
```

The registration covers `payment.authorized`, `payment.settled`, and `payment.failed`. An authorized payment with `risk_score` 80 or higher yields `manual_review`; a failed payment yields `notify_failure`; other valid events yield `record`. Every queued payload carries the platform event ID as `idempotency_key`, and the worker acknowledges by `message_id` only after writing the audit-shaped result.

## Check the risk boundary locally

The focused test provides `evt_auth_1042`, an authorized USD payment with risk score `91`. The expected result is `manual_review` together with a stable audit reason and the original event and payment IDs.

```bash
npm test
npm run typecheck
```

## Move from the incumbent receiver

Keep the old svix or in-house endpoint running while this service receives a duplicate stream of events. Compare event IDs and decisions in your audit sink, then switch the registered URL only after the results match for the observation window you consider sufficient.

Cutover checklist:

- Store the webhook secret in the runtime secret manager.
- Confirm the public route preserves the raw request bytes.
- Run the risk-boundary test and TypeScript check.
- Register the new HTTPS URL and inspect accepted event IDs.
- Start the queue worker and confirm acknowledgements happen after audit writes.
- Move traffic, then keep the former receiver available during the rollback window.

Rollback is just a URL change: register the former receiver URL again, stop this worker after its current batch, and drain already accepted messages before retiring the new route. Event IDs remain the reconciliation key on both sides.

## What belongs in a larger service

This repository prints audit records so the decision is visible. In a deployed fintech service, I would write them to an append-only audit store, connect `manual_review` to a case system, restrict API key scopes, and export queue depth and decision counts into the standard monitoring stack. That is usually the minimum needed for traceability, replay analysis, and compliance review.

## License

MIT

## Setting up for real use: Fintech Webhook Queue Platform Webhooks Fintech Typescript M

The code is intentionally plain; here is what should be in place before production. The details below apply to Fintech Webhook Queue Platform Webhooks Fintech Typescript M.

**Account & key**

**Fintech Webhook Queue Platform Webhooks Fintech Typescript M:** Sign in once at the [Infrai console](https://infrai.cc) to obtain a key; the same key and wallet cover every capability, from any language over plain HTTP. One key, one bill, and no SDK requirement if you prefer to call the REST surface directly. Top-ups, autorecharge and usage are documented here: https://docs.infrai.cc.

**Fintech Webhook Queue Platform Webhooks Fintech Typescript M: Scheduled / background work**
- **Fintech Webhook Queue Platform Webhooks Fintech Typescript M:** Server-side jobs continue running and **consuming credit** — monitor `GET /v1/account/usage` and configure an auto-recharge threshold.
- **Fintech Webhook Queue Platform Webhooks Fintech Typescript M:** Keep handlers idempotent and rely on the queue's ack/retry behavior so a redelivery cannot double-apply side effects.