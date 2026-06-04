export async function uploadSongCover(songId: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.set('cover', file);

  const response = await fetch(`/api/songs/${encodeURIComponent(songId)}/cover`, {
    body: formData,
    method: 'POST',
  });
  const payload = await response.json().catch(() => null) as { cover_url?: string; error?: string; details?: string } | null;

  if (!response.ok) {
    throw new Error(payload?.error || payload?.details || 'Cover konnte nicht aktualisiert werden.');
  }

  if (!payload?.cover_url) {
    throw new Error('Cover konnte nicht aktualisiert werden.');
  }

  return payload.cover_url;
}
