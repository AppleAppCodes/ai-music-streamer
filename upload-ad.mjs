import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const file = fs.readFileSync('public/ads/yoriax-ad.m4a');
supabase.storage.from('ads').upload('yoriax-ad.mp3', file, {
  contentType: 'audio/mp4',
  upsert: true
}).then(({ data, error }) => {
  if (error) {
    console.error('Upload failed:', error);
    process.exit(1);
  }
  console.log('Upload success:', data);
});
