import { NextRequest } from 'next/server';
import {
  adminCorsHeaders,
  asOptionalBoolean,
  asTrimmedString,
  jsonError,
  jsonOk,
  optionsResponse,
  requireAdminAuth,
} from '@/lib/yoriax-admin-api';

// The admin user list intentionally includes `email` and account-state columns.
// These are no longer readable by the browser-facing `anon` / `authenticated`
// roles (see migrations restricting profile column grants), so the list is
// served exclusively through this service-role route after an admin auth check.
const USER_COLUMNS =
  'id, username, created_at, subscription_tier, followers_count, email, country, last_active_at, avatar_url, is_banned, role';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth.error) return auth.error;

  const { data: users, error } = await auth.context.admin
    .from('profiles')
    .select(USER_COLUMNS)
    .order('created_at', { ascending: false });

  if (error) {
    return jsonError('Failed to fetch users', 500, error.message);
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: dailyActiveUsers, error: dauError } = await auth.context.admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .gte('last_active_at', since);

  if (dauError) {
    return jsonError('Failed to count active users', 500, dauError.message);
  }

  return jsonOk(
    { users: users ?? [], dailyActiveUsers: dailyActiveUsers ?? 0 },
    { headers: adminCorsHeaders },
  );
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return jsonError('Invalid JSON body', 400);
  }

  const bodyRecord = body as Record<string, unknown>;
  const id = asTrimmedString(bodyRecord.id);
  if (!id) {
    return jsonError('Missing required field: id', 400);
  }

  const isBanned = asOptionalBoolean(bodyRecord.is_banned);
  if (isBanned === null) {
    return jsonError('Missing or invalid field: is_banned', 400);
  }

  const { data, error } = await auth.context.admin
    .from('profiles')
    .update({ is_banned: isBanned })
    .eq('id', id)
    .select('id, is_banned')
    .single();

  if (error) {
    return jsonError('Failed to update user', 500, error.message);
  }

  return jsonOk({ user: data }, { headers: adminCorsHeaders });
}
