// Verified against: bun 1.4.4 (2026-11-15)
import { createHmac, timingSafeEqual } from 'node:crypto';

// Header that carries the signature (nuvemshop.dev webhook docs, "Verifying a webhook").
export const SIGNATURE_HEADER = 'x-linkedstore-hmac-sha256';

// The signature is the lowercase hex HMAC-SHA256 of the raw request body, keyed with the
// app's client_secret. The store's access_token is not the key.
export function verifyWebhook(
  rawBody: Uint8Array | string,
  signature: string | null | undefined,
  clientSecret: string,
): boolean {
  if (!signature) {
    return false;
  }
  const expected = Buffer.from(
    createHmac('sha256', clientSecret).update(rawBody).digest('hex'),
  );
  const received = Buffer.from(signature);
  // timingSafeEqual throws on unequal lengths, so reject those first.
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  );
}

// Fetch-API handler (Bun, Elysia, Hono, Next route handlers). Read the body once as bytes,
// verify, then parse. Answer 2xx inside 3 seconds: queue the work and return.
export async function handleWebhook(
  req: Request,
  clientSecret: string,
  enqueue: (event: unknown) => Promise<void>,
): Promise<Response> {
  const rawBody = new Uint8Array(await req.arrayBuffer());
  if (!verifyWebhook(rawBody, req.headers.get(SIGNATURE_HEADER), clientSecret)) {
    return new Response('invalid signature', { status: 401 });
  }
  let event: unknown;
  try {
    event = JSON.parse(new TextDecoder().decode(rawBody));
  } catch {
    return new Response('invalid json', { status: 400 });
  }
  await enqueue(event);
  return new Response(null, { status: 200 });
}
