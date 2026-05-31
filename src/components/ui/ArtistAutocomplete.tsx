'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useTranslation } from 'react-i18next';

interface ArtistAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
}

export default function ArtistAutocomplete({ value, onChange }: ArtistAutocompleteProps) {
  const { t } = useTranslation();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    // Click outside handler
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (value.trim().length < 1) {
        setSuggestions([]);
        return;
      }

      // Get unique artist names matching the input
      const { data, error } = await supabase
        .from('songs')
        .select('artist_name')
        .ilike('artist_name', `%${value}%`)
        .not('artist_name', 'is', null)
        .limit(10);

      if (!error && data) {
        // Extract unique names
        const uniqueNames = Array.from(new Set(data.map(d => d.artist_name).filter(Boolean))) as string[];
        // Don't show the exact match as the only suggestion if the user already fully typed it
        if (uniqueNames.length === 1 && uniqueNames[0].toLowerCase() === value.toLowerCase()) {
          setSuggestions([]);
        } else {
          setSuggestions(uniqueNames);
        }
      }
    };

    const debounceTimer = setTimeout(() => {
      fetchSuggestions();
    }, 300);

    return () => clearTimeout(debounceTimer);
  }, [value, supabase]);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <label className="block text-sm font-semibold text-white/80 mb-2">{t('upload.artistName')}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          if (suggestions.length > 0) setIsOpen(true);
        }}
        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        placeholder={t('upload.artistPlaceholder')}
        required
      />
      
      {isOpen && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-neutral-900 border border-white/10 rounded-xl shadow-lg max-h-60 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <li
              key={index}
              onClick={() => {
                onChange(suggestion);
                setIsOpen(false);
              }}
              className="px-4 py-3 hover:bg-white/10 cursor-pointer text-white transition-colors"
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
