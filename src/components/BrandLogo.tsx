'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Edit2, Loader2 } from 'lucide-react';
import type { User as SupabaseUser } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { isAdminUser } from '@/lib/admin';

const DEFAULT_LOGO = '/brand/yoriax-logo-symbol.png';
const STORAGE_FOLDER = 'branding';
const STORAGE_BASENAME = 'site-logo';

type BrandLogoProps = {
  user: SupabaseUser | null;
  width?: number;
  height?: number;
  className?: string;
  imageClassName?: string;
  alt?: string;
  priority?: boolean;
};

function pickLatestLogo(files: Array<{ name: string; updated_at?: string | null; created_at?: string | null }>) {
  const candidates = files.filter((f) => f.name.startsWith(`${STORAGE_BASENAME}.`));
  if (candidates.length === 0) return null;
  return [...candidates].sort((a, b) => {
    const ta = new Date(a.updated_at || a.created_at || 0).getTime();
    const tb = new Date(b.updated_at || b.created_at || 0).getTime();
    return tb - ta;
  })[0];
}

export default function BrandLogo({
  user,
  width = 40,
  height = 40,
  className = '',
  imageClassName,
  alt = 'YORIAX',
  priority = false,
}: BrandLogoProps) {
  const [logoUrl, setLogoUrl] = useState<string>(DEFAULT_LOGO);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAdmin = isAdminUser(user);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase.storage
        .from('covers')
        .list(STORAGE_FOLDER, { search: STORAGE_BASENAME });
      if (error || !data || !mounted) return;
      const latest = pickLatestLogo(data);
      if (!latest) return;
      const { data: pub } = supabase.storage
        .from('covers')
        .getPublicUrl(`${STORAGE_FOLDER}/${latest.name}`);
      const cacheKey = encodeURIComponent(latest.updated_at || latest.created_at || latest.name);
      if (mounted) setLogoUrl(`${pub.publicUrl}?v=${cacheKey}`);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !isAdmin) return;
    setIsUploading(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `${STORAGE_FOLDER}/${STORAGE_BASENAME}.${ext}`;
      const { data: existing } = await supabase.storage
        .from('covers')
        .list(STORAGE_FOLDER, { search: STORAGE_BASENAME });
      const stale = (existing || [])
        .filter((f) => f.name.startsWith(`${STORAGE_BASENAME}.`) && f.name !== `${STORAGE_BASENAME}.${ext}`)
        .map((f) => `${STORAGE_FOLDER}/${f.name}`);
      if (stale.length > 0) {
        await supabase.storage.from('covers').remove(stale);
      }
      const { error: uploadError } = await supabase.storage
        .from('covers')
        .upload(path, file, { upsert: true, contentType: file.type || `image/${ext}` });
      if (uploadError) throw uploadError;
      const { data: pub } = supabase.storage.from('covers').getPublicUrl(path);
      setLogoUrl(`${pub.publicUrl}?v=${Date.now()}`);
    } catch (err) {
      console.error('Failed to upload brand logo', err);
      alert('Logo konnte nicht hochgeladen werden.');
    } finally {
      setIsUploading(false);
      if (event.target) event.target.value = '';
    }
  };

  const isCustomLogo = logoUrl !== DEFAULT_LOGO;
  const sizeStyle: CSSProperties = { width, height };

  const image = (
    <Image
      src={logoUrl}
      alt={alt}
      width={width}
      height={height}
      priority={priority}
      unoptimized={isCustomLogo}
      className={imageClassName ?? 'h-full w-full rounded-xl object-cover'}
      onClick={
        isAdmin
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              fileInputRef.current?.click();
            }
          : undefined
      }
    />
  );

  if (!isAdmin) {
    return <div className={className} style={sizeStyle}>{image}</div>;
  }

  return (
    <div className={`group/brandlogo relative inline-flex shrink-0 ${className}`} style={sizeStyle}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
      {image}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-black/65 opacity-0 transition-opacity group-hover/brandlogo:opacity-100"
        title="YORIAX Logo austauschen"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin text-white" />
        ) : (
          <Edit2 className="h-4 w-4 text-white" />
        )}
      </span>
    </div>
  );
}
