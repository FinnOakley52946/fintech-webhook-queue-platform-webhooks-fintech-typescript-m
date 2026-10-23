import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { infrai, InfraiError } from "./infrai_client";
import { decidePaymentAction, paymentEventSchema } from "./payment_event";
import { verifySignature } from "./signature";

const queue = process.env.INFRAI_QUEUE ?? "fintech-payments";

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

async function receive(request: IncomingMessage, response: ServerResponse): Promise<void> {
  if (request.method !== "POST" || request.url !== "/webhooks/infrai") {
    json(response, 404, { error: "not_found" });
    return;
  }

  const secret = process.env.INFRAI_WEBHOOK_SECRET;
  if (!secret) throw new Error("INFRAI_WEBHOOK_SECRET is required");
  const rawBody = await readBody(request);
  const valid = verifySignature(
    rawBody,
    request.headers["x-infrai-timestamp"] as string | undefined,
    request.headers["x-infrai-signature"] as string | undefined,
    secret,
  );
  if (!valid) {
    json(response, 401, { error: "invalid_signature" });
    return;
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(rawBody.toString("utf8"));
  } catch {
    json(response, 400, { error: "invalid_json" });
    return;
  }
  const parsed = paymentEventSchema.safeParse(decoded);
  if (!parsed.success) {
    json(response, 400, { error: "invalid_event", issues: parsed.error.issues });
    return;
  }

  const decision = decidePaymentAction(parsed.data);
  const queued = await infrai.queue.publish({
    queue,
    payload: { idempotency_key: parsed.data.id, event: parsed.data, decision },
  });
  json(response, 202, { accepted: true, message_id: queued.message_id, action: decision.action });
}

const server = createServer((request, response) => {
  receive(request, response).catch((error: unknown) => {
    if (error instanceof InfraiError && error.status < 500) {
      json(response, error.status, { error: error.code });
      return;
    }
    console.error(error);
    json(response, 503, { error: "event_not_accepted" });
  });
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Payment webhook listening on http://localhost:${port}`));
