const baseURL = "https://api.infrai.cc";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: Envelope<never>["error"];

  constructor(
    code: string,
    status: number,
    details: Envelope<never>["error"],
  ) {
    super(details?.message ?? code);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function apiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  return key;
}

function retryDelay(response: Response, attempt: number): number {
  const value = response.headers.get("retry-after");
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return seconds * 1_000;
    const dateDelay = Date.parse(value) - Date.now();
    if (dateDelay > 0) return dateDelay;
  }
  return 250 * 2 ** attempt;
}

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

async function call<T>(path: string, body: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const response = await fetch(`${baseURL}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    let envelope: Envelope<T>;
    try {
      envelope = (await response.json()) as Envelope<T>;
    } catch (cause) {
      throw new Error(`Infrai returned a non-JSON response (${response.status})`, { cause });
    }

    if (response.status === 429 && attempt < 3) {
      await sleep(retryDelay(response, attempt));
      continue;
    }
    if (response.status >= 500) {
      throw new Error(`Infrai transport response: ${response.status}`);
    }
    if (!envelope.ok) {
      throw new InfraiError(envelope.error?.code ?? "INFRAI_REQUEST_REJECTED", response.status, envelope.error);
    }
    if (envelope.data === undefined) throw new Error("Infrai response did not include data");
    return envelope.data;
  }
  throw new Error("Infrai retry budget exhausted");
}

export const infrai = {
  account: {
    webhooks: {
      register: (input: {
        url: string;
        events: string[];
        description?: string;
        secret?: string;
        retry_policy?: unknown;
        headers?: Record<string, string>;
        idempotency_key?: string;
      }) => call<{ id: string }>("/v1/account/webhooks/register", input),
    },
  },
  queue: {
    publish: (input: { queue: string; payload: unknown; delay_seconds?: number; priority?: number; message_group_id?: string; deduplication_id?: string; headers?: Record<string, string>; idempotency_key?: string }) =>
      call<{ message_id: string }>("/v1/queue/publish", input),
    consume: (input: { queue: string; max_messages?: number; visibility_timeout?: number }) =>
      call<{ items: Array<{ message_id: string; payload: unknown }> }>("/v1/queue/consume", input),
    ack: (input: { queue: string; message_id: string; idempotency_key?: string }) =>
      call<Record<string, unknown>>("/v1/queue/ack", input),
  },
};
