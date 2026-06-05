export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
export const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
export const turnstileSiteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || '';
export const turnstileBaseUrl = process.env.EXPO_PUBLIC_TURNSTILE_BASE_URL || 'https://www.yoriax.com';
export const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL || turnstileBaseUrl;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const hasTurnstileConfig = Boolean(turnstileSiteKey);
