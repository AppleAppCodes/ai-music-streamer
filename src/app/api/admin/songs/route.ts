import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import {
  ALLOWED_AUDIO_EXTENSIONS,
  ALLOWED_AUDIO_TYPES,
  ALLOWED_COVER_IMAGE_EXTENSIONS,
  ALLOWED_COVER_IMAGE_TYPES,
  extensionForMimeType,
  getUploadFileExtension,
  MAX_AUDIO_BYTES,
  MAX_COVER_IMAGE_BYTES,
  validateUploadFile,
} from '@/lib/upload-validation';
import {
  asOptionalBoolean,
  asOptionalInteger,
  asOptionalTrimmedString,
  asTrimmedString,
  isHttpUrl,
  jsonError,
  jsonOk,
  normalizeForPath,
  optionsResponse,
  requireAdminAuth,
} from '@/lib/yoriax-admin-api';

export async function OPTIONS() {
  return optionsResponse();
}

function formString(formData: FormData, key: string): string | null {
  return asTrimmedString(formData.get(key));
}

function optionalFormString(formData: FormData, key: string): string | null {
  return asOptionalTrimmedString(formData.get(key));
}

function formFile(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  return value instanceof File ? value : null;
}

async function uploadStorageFile({
  file,
  pathPrefix,
  fallbackExtension,
}: {
  file: File;
  pathPrefix: string;
  fallbackExtension: string;
}) {
  const ext = extensionForMimeType(file.type, getUploadFileExtension(file) || fallbackExtension);
  const storagePath = `${pathPrefix}.${ext}`;
  const body = await file.arrayBuffer();
  return { storagePath, body, contentType: file.type || undefined };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = request.nextUrl;
  const artist = asOptionalTrimmedString(searchParams.get('artist'));
  const search = asOptionalTrimmedString(searchParams.get('search'));
  const limit = Math.min(asOptionalInteger(searchParams.get('limit')) ?? 100, 500);

  let query = auth.context.admin
    .from('songs')
    .select('id,title,artist_name,genre,mood,duration,track_number,plays,is_approved,created_at,cover_url,audio_url')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (artist) {
    query = query.ilike('artist_name', artist);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,artist_name.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) {
    return jsonError('Failed to fetch songs', 500, error.message);
  }

  return jsonOk({ songs: data ?? [] });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminAuth(request);
  if (auth.error) return auth.error;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return jsonError('Invalid multipart/form-data body', 400);
  }

  const title = formString(formData, 'title');
  const artistName = formString(formData, 'artist_name');
  if (!title || !artistName) {
    return jsonError('Missing required fields: title, artist_name', 400);
  }

  const skipExisting = asOptionalBoolean(formData.get('skip_existing')) ?? false;
  const audioFile = formFile(formData, 'audio');
  const coverFile = formFile(formData, 'cover');
  const coverUrlFromBody = optionalFormString(formData, 'cover_url');

  if (!audioFile) {
    return jsonError('Missing required file: audio', 400);
  }

  if (!coverFile && !coverUrlFromBody) {
    return jsonError('Missing required file or URL: cover / cover_url', 400);
  }

  if (coverUrlFromBody && !isHttpUrl(coverUrlFromBody)) {
    return jsonError('Invalid cover_url', 400);
  }

  const audioValidationError = validateUploadFile(audioFile, {
    allowedExtensions: ALLOWED_AUDIO_EXTENSIONS,
    allowedMimeTypes: ALLOWED_AUDIO_TYPES,
    label: 'Audio-Datei',
    maxBytes: MAX_AUDIO_BYTES,
  });
  if (audioValidationError) {
    return jsonError(audioValidationError, 400);
  }

  if (coverFile) {
    const coverValidationError = validateUploadFile(coverFile, {
      allowedExtensions: ALLOWED_COVER_IMAGE_EXTENSIONS,
      allowedMimeTypes: ALLOWED_COVER_IMAGE_TYPES,
      label: 'Cover',
      maxBytes: MAX_COVER_IMAGE_BYTES,
    });
    if (coverValidationError) {
      return jsonError(coverValidationError, 400);
    }
  }

  const { data: existingRows, error: duplicateError } = await auth.context.admin
    .from('songs')
    .select('id,title,artist_name')
    .ilike('title', title)
    .ilike('artist_name', artistName)
    .limit(1);

  if (duplicateError) {
    return jsonError('Failed to verify duplicate status', 500, duplicateError.message);
  }

  const existingSong = existingRows?.[0] ?? null;
  if (existingSong) {
    if (skipExisting) {
      return jsonOk({ skipped: true, song: existingSong }, { status: 200 });
    }
    return jsonError(`Song already exists: ${title} by ${artistName}`, 409);
  }

  const isOriginal = asOptionalBoolean(formData.get('artist_is_original')) ?? false;
  const { error: artistError } = await auth.context.admin
    .from('artist_profiles')
    .upsert(
      {
        artist_name: artistName,
        is_original: isOriginal,
      },
      { onConflict: 'artist_name', ignoreDuplicates: false },
    );

  if (artistError) {
    return jsonError('Failed to upsert artist profile', 500, artistError.message);
  }

  const uploadPrefix = `catalog-upload/${normalizeForPath(artistName)}/${Date.now()}_${randomUUID()}`;
  const uploadedPaths: Array<{ bucket: 'songs' | 'covers'; path: string }> = [];

  const audioUpload = await uploadStorageFile({
    file: audioFile,
    pathPrefix: `${uploadPrefix}_song`,
    fallbackExtension: 'mp3',
  });

  const { error: audioUploadError } = await auth.context.admin.storage
    .from('songs')
    .upload(audioUpload.storagePath, audioUpload.body, {
      contentType: audioUpload.contentType || 'audio/mpeg',
      upsert: false,
    });

  if (audioUploadError) {
    return jsonError('Failed to upload audio', 500, audioUploadError.message);
  }
  uploadedPaths.push({ bucket: 'songs', path: audioUpload.storagePath });

  let coverUrl = coverUrlFromBody;
  if (coverFile) {
    const coverUpload = await uploadStorageFile({
      file: coverFile,
      pathPrefix: `${uploadPrefix}_cover`,
      fallbackExtension: 'jpg',
    });

    const { error: coverUploadError } = await auth.context.admin.storage
      .from('covers')
      .upload(coverUpload.storagePath, coverUpload.body, {
        contentType: coverUpload.contentType || 'image/jpeg',
        upsert: false,
      });

    if (coverUploadError) {
      await auth.context.admin.storage.from('songs').remove([audioUpload.storagePath]);
      return jsonError('Failed to upload cover', 500, coverUploadError.message);
    }

    uploadedPaths.push({ bucket: 'covers', path: coverUpload.storagePath });
    const {
      data: { publicUrl },
    } = auth.context.admin.storage.from('covers').getPublicUrl(coverUpload.storagePath);
    coverUrl = publicUrl;
  }

  const {
    data: { publicUrl: audioUrl },
  } = auth.context.admin.storage.from('songs').getPublicUrl(audioUpload.storagePath);

  const creatorId = optionalFormString(formData, 'creator_id');
  const duration = asOptionalInteger(formData.get('duration'));
  const trackNumber = asOptionalInteger(formData.get('track_number'));
  const humanEdit = asOptionalInteger(formData.get('human_edit'));

  const { data: song, error: insertError } = await auth.context.admin
    .from('songs')
    .insert({
      creator_id: creatorId,
      title,
      artist_name: artistName,
      genre: optionalFormString(formData, 'genre'),
      mood: optionalFormString(formData, 'mood'),
      language: optionalFormString(formData, 'language'),
      description: optionalFormString(formData, 'description'),
      ai_tool: optionalFormString(formData, 'ai_tool'),
      cover_url: coverUrl,
      audio_url: audioUrl,
      duration,
      track_number: trackNumber,
      human_edit: humanEdit ?? 0,
      vocals_type: optionalFormString(formData, 'vocals_type'),
      credits: [],
      plays: 0,
      is_approved: true,
    })
    .select()
    .single();

  if (insertError) {
    await Promise.all(
      uploadedPaths.map((entry) => auth.context.admin.storage.from(entry.bucket).remove([entry.path])),
    );
    return jsonError('Failed to create song', 500, insertError.message);
  }

  return jsonOk({ skipped: false, song }, { status: 201 });
}
