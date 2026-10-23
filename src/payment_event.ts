import { z } from "zod";

export const paymentEventSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["payment.authorized", "payment.settled", "payment.failed"]),
  occurred_at: z.string().datetime(),
  payment: z.object({
    id: z.string().min(1),
    amount_minor: z.number().int().positive(),
    currency: z.string().length(3),
    customer_id: z.string().min(1),
    risk_score: z.number().min(0).max(100),
  }),
});

export type PaymentEvent = z.infer<typeof paymentEventSchema>;

export type PaymentDecision = {
  action: "record" | "notify_failure" | "manual_review";
  audit: {
    event_id: string;
    payment_id: string;
    decided_at: string;
    reason: string;
  };
};

export function decidePaymentAction(event: PaymentEvent): PaymentDecision {
  if (event.type === "payment.authorized" && event.payment.risk_score >= 80) {
    return {
      action: "manual_review",
      audit: {
        event_id: event.id,
        payment_id: event.payment.id,
        decided_at: event.occurred_at,
        reason: "authorized payment met the high-risk review threshold",
      },
    };
  }
  if (event.type === "payment.failed") {
    return {
      action: "notify_failure",
      audit: {
        event_id: event.id,
        payment_id: event.payment.id,
        decided_at: event.occurred_at,
        reason: "payment failure requires an operations notification",
      },
    };
  }
  return {
    action: "record",
    audit: {
      event_id: event.id,
      payment_id: event.payment.id,
      decided_at: event.occurred_at,
      reason: "payment event recorded without intervention",
    },
  };
}
