import { NextRequest } from 'next/server';
import {
  asTrimmedString,
  jsonError,
  jsonOk,
  optionsResponse,
  requireAdminAuth,
} from '@/lib/yoriax-admin-api';

export async function OPTIONS() {
  return optionsResponse();
}

// Expo push service: accepts up to 100 messages per request, returns one
// ticket per message in order. https://docs.expo.dev/push-notifications/sending-notifications/
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK_SIZE = 100;
const MAX_TITLE_LENGTH = 80;
const MAX_BODY_LENGTH = 240;

type ExpoPushTicket = { status: string; details?: { error?: string } };

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth.error) return auth.error;
  const { admin } = auth.context;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }
  const title = asTrimmedString((payload as Record<string, unknown>)?.title);
  const body = asTrimmedString((payload as Record<string, unknown>)?.body);
  if (!title || !body) return jsonError('title and body are required', 400);
  if (title.length > MAX_TITLE_LENGTH || body.length > MAX_BODY_LENGTH) {
    return jsonError(`title max ${MAX_TITLE_LENGTH} chars, body max ${MAX_BODY_LENGTH} chars`, 400);
  }

  const { data: rows, error } = await admin.from('push_tokens').select('token');
  if (error) return jsonError('Failed to load push tokens', 500, error.message);
  const tokens = (rows ?? [])
    .map((row) => row.token as string)
    .filter((token) => typeof token === 'string' && token.startsWith('Expo'));
  if (tokens.length === 0) return jsonOk({ recipients: 0, sent: 0, failed: 0, removed: 0 });

  let sent = 0;
  let failed = 0;
  const deadTokens: string[] = [];

  for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
    const chunk = tokens.slice(i, i + CHUNK_SIZE);
    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(chunk.map((to) => ({ to, title, body, sound: 'default' }))),
    });
    if (!res.ok) {
      failed += chunk.length;
      continue;
    }
    const json = (await res.json().catch(() => null)) as { data?: ExpoPushTicket[] } | null;
    (json?.data ?? []).forEach((ticket, index) => {
      if (ticket.status === 'ok') {
        sent += 1;
      } else {
        failed += 1;
        // Uninstalled/expired devices — prune so future sends stay clean.
        if (ticket.details?.error === 'DeviceNotRegistered') deadTokens.push(chunk[index]);
      }
    });
  }

  if (deadTokens.length > 0) {
    await admin.from('push_tokens').delete().in('token', deadTokens);
  }

  return jsonOk({ recipients: tokens.length, sent, failed, removed: deadTokens.length });
}
