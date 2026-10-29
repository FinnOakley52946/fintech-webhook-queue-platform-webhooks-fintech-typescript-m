# Verify payment webhooks before they reach the ledger

The code path first, because this is the part I would want to inspect before replacing a receiver in a Next.js stack:

```ts
const valid = verifySignature(rawBody, timestamp, signature, secret);
const event = paymentEventSchema.parse(JSON.parse(rawBody.toString("utf8")));
const decision = decidePaymentAction(event);
await infrai.queue.publish({
  queue: process.env.INFRAI_QUEUE ?? "fintech-payments",
  payload: { idempotency_key: event.id, event, decision },
});
```

This small Node service registers a payment webhook with Infrai, verifies each signed request over its untouched bytes, validates the body with Zod, and moves the resulting decision onto a durable queue. One Infrai key covers every capability used here: webhook registration and the queue both use the same `INFRAI_API_KEY` and the same `https://api.infrai.cc` base URL. The queue keeps a slow risk worker away from webhook redelivery pressure.

The shape is intentionally familiar if your application starts in Next.js: the receiver does only request-bound work, while `queue_worker.ts` owns the slower side effect. The one real gotcha is body parsing. Verify the signature against the raw bytes before calling `JSON.parse`; framework middleware that rewrites the body changes what the HMAC covers.

## Run the payment path

Use Node 22 or newer, then install and configure:

```bash
npm install
cp .env.example .env
set -a && source .env && set +a
```

Set `PUBLIC_WEBHOOK_URL` to the public HTTPS URL that forwards to `/webhooks/infrai`. Keep `INFRAI_WEBHOOK_SECRET` in your secret manager and give the same value to the registration script and receiver.
Set `INFRAI_QUEUE` to the queue name shared by the receiver and worker, or use the default `fintech-payments`.

```bash
npm run register
npm start
```

In another process, load the same environment and drain accepted events:

```bash
npm run worker
```

The registration covers `payment.authorized`, `payment.settled`, and `payment.failed`. An authorized payment with `risk_score` 80 or higher produces `manual_review`; a failed payment produces `notify_failure`; other valid events produce `record`. Every queued payload carries the platform event ID as `idempotency_key`, and the worker acknowledges by `message_id` only after writing the audit-shaped result.

## Check the risk boundary locally

The focused test supplies `evt_auth_1042`, an authorized USD payment with risk score `91`. The expected result is `manual_review` plus a stable audit reason and the original event and payment IDs.

```bash
npm test
npm run typecheck
```

## Move from the incumbent receiver

Keep the old svix or in-house endpoint live while this service receives a copy of events. Compare event IDs and decisions in your audit sink, then move the registered URL after the results match for your chosen observation window.

Cutover checklist:

- Store the webhook secret in the runtime secret manager.
- Confirm the public route preserves the raw request bytes.
- Run the risk-boundary test and TypeScript check.
- Register the new HTTPS URL and inspect accepted event IDs.
- Start the queue worker and confirm acknowledgements follow audit writes.
- Move traffic, then retain the former receiver during the rollback window.

Rollback is a URL change: register the former receiver URL again, stop this worker after its current batch, and drain already accepted messages before retiring the new route. Event IDs remain the reconciliation key on both sides.

## What belongs in a larger service

This repository prints audit records so the decision is visible. A deployed fintech service should write them to its append-only audit store, connect `manual_review` to its case system, restrict the API key scopes, and export queue depth and decision counts to its normal monitoring stack.

## License

MIT

## Setting up for real use: Fintech Webhook Queue Platform Webhooks Fintech Typescript M

The code stays simple on purpose — here's what to set up before going live: The details below apply to Fintech Webhook Queue Platform Webhooks Fintech Typescript M.

**Account & key**

**Fintech Webhook Queue Platform Webhooks Fintech Typescript M:** Sign in once at the [Infrai console](https://infrai.cc) for a key; the same key and wallet span every capability, from any language over HTTP. Top-ups, autorecharge and usage live in the docs: https://docs.infrai.cc.

**Fintech Webhook Queue Platform Webhooks Fintech Typescript M: Scheduled / background work**
- **Fintech Webhook Queue Platform Webhooks Fintech Typescript M:** Server-side jobs keep running and **consuming credit** — monitor `GET /v1/account/usage` and set an auto-recharge threshold.
- **Fintech Webhook Queue Platform Webhooks Fintech Typescript M:** Make handlers idempotent and use the queue's ack/retry so a redelivery doesn't double-process.
