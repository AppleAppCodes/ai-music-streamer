import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { SupabaseClient, User as SupabaseUser } from '@supabase/supabase-js';
import { isAdminUser } from '@/lib/admin';
import { createRouteClient } from '@/utils/supabase/route';

export const adminCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export type AdminAuthContext = {
  admin: SupabaseClient;
  user: SupabaseUser;
};

class AdminApiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AdminApiConfigError';
  }
}

export function createAdminServiceClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    throw new AdminApiConfigError('Missing SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL.');
  }

  if (!serviceKey) {
    throw new AdminApiConfigError('Missing SUPABASE_SERVICE_ROLE_KEY / SUPABASE_SERVICE_KEY.');
  }

  return createSupabaseClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function optionsResponse() {
  return NextResponse.json(null, { status: 204, headers: adminCorsHeaders });
}

export function jsonError(message: string, status: number, details?: string) {
  return NextResponse.json(
    details ? { error: message, details } : { error: message },
    { status, headers: adminCorsHeaders },
  );
}

export function jsonOk<T>(payload: T, init?: ResponseInit) {
  return NextResponse.json(payload, {
    ...init,
    headers: {
      ...adminCorsHeaders,
      ...(init?.headers || {}),
    },
  });
}

export async function requireAdminAuth(
  request: NextRequest,
): Promise<{ context: AdminAuthContext; error?: never } | { context?: never; error: NextResponse }> {
  try {
    const routeClient = await createRouteClient(request);
    const {
      data: { user },
      error,
    } = await routeClient.auth.getUser();

    if (error || !user) {
      return { error: jsonError('Authentication required', 401) };
    }

    if (!isAdminUser(user)) {
      return { error: jsonError('Admin access required', 403) };
    }

    return {
      context: {
        admin: createAdminServiceClient(),
        user,
      },
    };
  } catch (error) {
    if (error instanceof AdminApiConfigError) {
      return { error: jsonError('Admin API is not configured', 500, error.message) };
    }

    console.error('[YORIAX admin auth]', error);
    return { error: jsonError('Failed to authenticate admin request', 500) };
  }
}

export function asTrimmedString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function asOptionalTrimmedString(value: unknown): string | null {
  if (value == null) return null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function asOptionalBoolean(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;
  }
  return null;
}

export function asOptionalInteger(value: unknown): number | null {
  if (value == null || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function normalizeForPath(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'upload';
}
