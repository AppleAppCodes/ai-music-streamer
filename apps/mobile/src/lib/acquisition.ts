import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getAdAttributionToken } from 'yoriax-remote-commands';
import { supabase } from './supabase';

const CHECK_FLAG_KEY = 'yoriax:acquisition-checked:v1';
const APPLE_ATTRIBUTION_API = 'https://api-adservices.apple.com/api/v1/';

/**
 * Records where this install came from (Apple Search Ads campaign vs organic)
 * on the user's profile — the basis for CAC/LTV analyses. Runs once per
 * install: transient failures leave no flag and retry on the next launch.
 */
export async function recordAcquisitionAttribution(userId: string) {
  if (Platform.OS !== 'ios' || !supabase) return;

  try {
    if (await AsyncStorage.getItem(CHECK_FLAG_KEY)) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('acquisition_source')
      .eq('id', userId)
      .maybeSingle();

    if (profile?.acquisition_source) {
      await AsyncStorage.setItem(CHECK_FLAG_KEY, '1');
      return;
    }

    let update: Record<string, unknown> = {
      acquisition_source: 'organic',
      acquisition_attributed_at: new Date().toISOString(),
    };

    const token = await getAdAttributionToken();
    if (token) {
      const response = await fetch(APPLE_ATTRIBUTION_API, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: token,
      });

      if (response.ok) {
        const attribution = (await response.json()) as {
          attribution?: boolean;
          campaignId?: number | string;
          adGroupId?: number | string;
          keywordId?: number | string;
        };
        if (attribution?.attribution === true) {
          update = {
            acquisition_source: 'apple_ads',
            acquisition_campaign_id: attribution.campaignId != null ? String(attribution.campaignId) : null,
            acquisition_ad_group_id: attribution.adGroupId != null ? String(attribution.adGroupId) : null,
            acquisition_keyword_id: attribution.keywordId != null ? String(attribution.keywordId) : null,
            acquisition_attributed_at: new Date().toISOString(),
          };
        }
      } else if (response.status !== 404) {
        // Transient Apple-API error — retry on the next launch.
        return;
      }
      // 404 = token known but no ad attribution → organic.
    }

    await supabase.from('profiles').update(update).eq('id', userId);
    await AsyncStorage.setItem(CHECK_FLAG_KEY, '1');
  } catch {
    // Never disturb startup; retry next launch.
  }
}

// Versions must match the "Stand" dates on yoriax.com/agb and /datenschutz.
export const TERMS_VERSIONS = { agb: '2026-07-03', datenschutz: '2026-07-03' } as const;

/**
 * Logs that this signed-in user has accepted the current terms/privacy
 * versions (shown as notice on the auth screen). Idempotent via the unique
 * (user, document, version) constraint.
 */
export async function recordTermsAcceptance(userId: string, source: 'ios' | 'web') {
  if (!supabase) return;
  try {
    await supabase.from('terms_acceptances').upsert(
      [
        { user_id: userId, document: 'agb', version: TERMS_VERSIONS.agb, source },
        { user_id: userId, document: 'datenschutz', version: TERMS_VERSIONS.datenschutz, source },
      ],
      { onConflict: 'user_id,document,version', ignoreDuplicates: true },
    );
  } catch {
    // Best effort — retried on next sign-in.
  }
}
