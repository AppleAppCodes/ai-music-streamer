import { NextRequest } from 'next/server';
import {
  adminCorsHeaders,
  asOptionalBoolean,
  asOptionalInteger,
  asOptionalTrimmedString,
  asTrimmedString,
  isHttpUrl,
  jsonError,
  jsonOk,
  optionsResponse,
  requireAdminAuth,
} from '@/lib/yoriax-admin-api';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = request.nextUrl;
  const search = asOptionalTrimmedString(searchParams.get('search'));
  const limit = Math.min(asOptionalInteger(searchParams.get('limit')) ?? 50, 200);

  let query = auth.context.admin
    .from('artist_profiles')
    .select('id,artist_name,instagram_url,tiktok_url,youtube_url,sort_order,is_original,created_at')
    .order('sort_order', { ascending: true })
    .order('artist_name', { ascending: true })
    .limit(limit);

  if (search) {
    query = query.ilike('artist_name', `%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    return jsonError('Failed to fetch artists', 500, error.message);
  }

  return jsonOk({ artists: data ?? [] }, { headers: adminCorsHeaders });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return jsonError('Invalid JSON body', 400);
  }

  const artistName = asTrimmedString((body as Record<string, unknown>).artist_name);
  if (!artistName) {
    return jsonError('Missing required field: artist_name', 400);
  }

  const instagramUrl = asOptionalTrimmedString((body as Record<string, unknown>).instagram_url);
  const tiktokUrl = asOptionalTrimmedString((body as Record<string, unknown>).tiktok_url);
  const youtubeUrl = asOptionalTrimmedString((body as Record<string, unknown>).youtube_url);
  const urls = [instagramUrl, tiktokUrl, youtubeUrl].filter(Boolean) as string[];
  const invalidUrl = urls.find((url) => !isHttpUrl(url));
  if (invalidUrl) {
    return jsonError(`Invalid URL: ${invalidUrl}`, 400);
  }

  const bodyRecord = body as Record<string, unknown>;
  const sortOrder = asOptionalInteger(bodyRecord.sort_order);
  const isOriginal = asOptionalBoolean(bodyRecord.is_original);
  const artistProfile: Record<string, string | number | boolean | null> = {
    artist_name: artistName,
  };

  if ('instagram_url' in bodyRecord) artistProfile.instagram_url = instagramUrl;
  if ('tiktok_url' in bodyRecord) artistProfile.tiktok_url = tiktokUrl;
  if ('youtube_url' in bodyRecord) artistProfile.youtube_url = youtubeUrl;
  if ('sort_order' in bodyRecord) artistProfile.sort_order = sortOrder ?? 0;
  if ('is_original' in bodyRecord) artistProfile.is_original = isOriginal ?? false;

  const { data, error } = await auth.context.admin
    .from('artist_profiles')
    .upsert(artistProfile, { onConflict: 'artist_name' })
    .select('id,artist_name,instagram_url,tiktok_url,youtube_url,sort_order,is_original,created_at')
    .single();

  if (error) {
    return jsonError('Failed to upsert artist', 500, error.message);
  }

  return jsonOk({ artist: data }, { status: 201, headers: adminCorsHeaders });
}
