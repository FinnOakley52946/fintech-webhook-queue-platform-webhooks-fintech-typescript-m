import assert from "node:assert/strict";
import test from "node:test";
import { decidePaymentAction, paymentEventSchema } from "../src/payment_event";

test("high-risk authorization is held for manual review with an audit reason", () => {
  const event = paymentEventSchema.parse({
    id: "evt_auth_1042",
    type: "payment.authorized",
    occurred_at: "2026-09-17T09:30:00.000Z",
    payment: {
      id: "pay_1042",
      amount_minor: 125000,
      currency: "USD",
      customer_id: "cus_88",
      risk_score: 91,
    },
  });

  assert.deepEqual(decidePaymentAction(event), {
    action: "manual_review",
    audit: {
      event_id: "evt_auth_1042",
      payment_id: "pay_1042",
      decided_at: "2026-09-17T09:30:00.000Z",
      reason: "authorized payment met the high-risk review threshold",
    },
  });
});
