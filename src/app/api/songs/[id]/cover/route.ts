import { NextRequest, NextResponse } from 'next/server';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { isAdminUser } from '@/lib/admin';
import {
  ALLOWED_COVER_IMAGE_EXTENSIONS,
  ALLOWED_COVER_IMAGE_TYPES,
  extensionForMimeType,
  getUploadFileExtension,
  MAX_COVER_IMAGE_BYTES,
  validateUploadFile,
} from '@/lib/upload-validation';
import { createClient } from '@/utils/supabase/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json(null, { status: 204, headers: corsHeaders });
}

async function getAuthenticatedUser(
  request: NextRequest,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<SupabaseUser | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return user;

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  const {
    data: { user: tokenUser },
    error,
  } = await supabase.auth.getUser(token);

  return error ? null : tokenUser;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const user = await getAuthenticatedUser(request, supabase);

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers: corsHeaders },
      );
    }

    if (!isAdminUser(user)) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403, headers: corsHeaders },
      );
    }

    const formData = await request.formData();
    const coverFile = formData.get('cover');

    if (!coverFile || !(coverFile instanceof File)) {
      return NextResponse.json(
        { error: 'Missing required file: cover' },
        { status: 400, headers: corsHeaders },
      );
    }

    const validationError = validateUploadFile(coverFile, {
      allowedExtensions: ALLOWED_COVER_IMAGE_EXTENSIONS,
      allowedMimeTypes: ALLOWED_COVER_IMAGE_TYPES,
      label: 'Cover',
      maxBytes: MAX_COVER_IMAGE_BYTES,
    });

    if (validationError) {
      return NextResponse.json(
        { error: validationError },
        { status: 400, headers: corsHeaders },
      );
    }

    const { data: song, error: songError } = await supabase
      .from('songs')
      .select('id')
      .eq('id', id)
      .single();

    if (songError || !song) {
      return NextResponse.json(
        { error: 'Song not found' },
        { status: 404, headers: corsHeaders },
      );
    }

    const extension = extensionForMimeType(
      coverFile.type,
      getUploadFileExtension(coverFile) || 'webp',
    );
    const path = `songs/cover_${id}_${Date.now()}.${extension}`;
    const coverBuffer = await coverFile.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from('covers')
      .upload(path, coverBuffer, {
        contentType: coverFile.type || 'image/webp',
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: 'Failed to upload cover', details: uploadError.message },
        { status: 500, headers: corsHeaders },
      );
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('covers').getPublicUrl(path);

    const { error: updateError } = await supabase
      .from('songs')
      .update({ cover_url: publicUrl })
      .eq('id', id);

    if (updateError) {
      await supabase.storage.from('covers').remove([path]);
      return NextResponse.json(
        { error: 'Failed to update cover', details: updateError.message },
        { status: 500, headers: corsHeaders },
      );
    }

    return NextResponse.json({ cover_url: publicUrl }, { headers: corsHeaders });
  } catch (error) {
    console.error('[POST /api/songs/:id/cover]', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: corsHeaders },
    );
  }
}
