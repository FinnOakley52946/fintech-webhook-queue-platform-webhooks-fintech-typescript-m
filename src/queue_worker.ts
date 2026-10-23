import { infrai } from "./infrai_client";
import { paymentEventSchema, type PaymentDecision } from "./payment_event";
import { z } from "zod";

const queue = process.env.INFRAI_QUEUE ?? "fintech-payments";

const queuedPaymentSchema = z.object({
  idempotency_key: z.string(),
  event: paymentEventSchema,
  decision: z.object({
    action: z.enum(["record", "notify_failure", "manual_review"]),
    audit: z.object({
      event_id: z.string(),
      payment_id: z.string(),
      decided_at: z.string(),
      reason: z.string(),
    }),
  }),
});

function applyDecision(decision: PaymentDecision): void {
  console.log(JSON.stringify({
    audit: decision.audit,
    action: decision.action,
    outcome: decision.action === "manual_review" ? "payment held for analyst review" : "payment event recorded",
  }));
}

const batch = await infrai.queue.consume({ queue, max_messages: 10, visibility_timeout: 60 });
for (const message of batch.items) {
  const parsed = queuedPaymentSchema.safeParse(message.payload);
  if (!parsed.success) {
    console.error("Skipped malformed queue payload", { message_id: message.message_id });
    continue;
  }
  applyDecision(parsed.data.decision as PaymentDecision);
  await infrai.queue.ack({ queue, message_id: message.message_id });
}
