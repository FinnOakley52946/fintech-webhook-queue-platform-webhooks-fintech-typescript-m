import { infrai } from "./infrai_client";

const url = process.env.PUBLIC_WEBHOOK_URL;
const secret = process.env.INFRAI_WEBHOOK_SECRET;
if (!url || !secret) throw new Error("PUBLIC_WEBHOOK_URL and INFRAI_WEBHOOK_SECRET are required");

const webhook = await infrai.account.webhooks.register({
  url,
  events: ["payment.authorized", "payment.settled", "payment.failed"],
  description: "Fintech payment decision intake",
  secret,
});

console.log(JSON.stringify({ webhook_id: webhook.id, url }, null, 2));
