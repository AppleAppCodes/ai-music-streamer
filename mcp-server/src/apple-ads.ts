/**
 * Apple Search Ads (Apple Ads) integration for the YORIAX MCP server.
 *
 * Lets MCP agents (OpenClaw etc.) read and manage the YORIAX App Store ad
 * campaigns: campaigns, ad groups, keywords, search terms and reports.
 *
 * Environment variables required (create an API user under
 * Apple Search Ads UI → Account Settings → API):
 *   APPLE_ADS_CLIENT_ID        – e.g. SEARCHADS.xxxxxxxx-...
 *   APPLE_ADS_TEAM_ID          – e.g. SEARCHADS.xxxxxxxx-...
 *   APPLE_ADS_KEY_ID           – key UUID
 *   APPLE_ADS_PRIVATE_KEY      – EC P-256 private key PEM (literal \n allowed)
 *     or APPLE_ADS_PRIVATE_KEY_PATH – path to the .pem file
 *   APPLE_ADS_ORG_ID           – optional; auto-discovered via /acls if unset
 */

import { sign as cryptoSign } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const TOKEN_URL = 'https://appleid.apple.com/auth/oauth2/token';
const API_BASE = 'https://api.searchads.apple.com/api/v5';

type LogFn = (toolName: string, args: unknown, summary: string) => Promise<void>;

// ── Config ──────────────────────────────────────────────────────────────────

type AppleAdsConfig = {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
  orgId?: string;
};

// Single well-known credentials file so the server finds its Apple Ads config
// no matter which MCP client (OpenClaw, Antigravity, Claude Desktop …) starts
// it and without touching any client config. Env vars still take precedence.
const CREDENTIALS_FILE = path.join(os.homedir(), '.yoriax', 'apple-ads.env');

function readCredentialsFile(): Record<string, string> {
  try {
    const values: Record<string, string> = {};
    for (const line of fs.readFileSync(CREDENTIALS_FILE, 'utf8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      values[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return values;
  } catch {
    return {};
  }
}

function loadConfig(): AppleAdsConfig | null {
  const fileValues = readCredentialsFile();
  const get = (key: string) => process.env[key] || fileValues[key] || '';

  const clientId = get('APPLE_ADS_CLIENT_ID');
  const teamId = get('APPLE_ADS_TEAM_ID');
  const keyId = get('APPLE_ADS_KEY_ID');
  let privateKey = get('APPLE_ADS_PRIVATE_KEY');

  const privateKeyPath = get('APPLE_ADS_PRIVATE_KEY_PATH');
  if (!privateKey && privateKeyPath) {
    try {
      privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    } catch {
      privateKey = '';
    }
  }
  // Allow keys passed with escaped newlines through env managers.
  privateKey = privateKey.replace(/\\n/g, '\n').trim();

  if (!clientId || !teamId || !keyId || !privateKey) return null;

  return {
    clientId,
    teamId,
    keyId,
    privateKey,
    orgId: get('APPLE_ADS_ORG_ID') || undefined,
  };
}

const SETUP_HELP = [
  'Apple Ads ist nicht konfiguriert. Lege die Datei ~/.yoriax/apple-ads.env an (KEY=VALUE pro Zeile)',
  'oder setze dieselben Werte als Environment-Variablen:',
  '',
  '  APPLE_ADS_CLIENT_ID   (Apple Search Ads → Account Settings → API)',
  '  APPLE_ADS_TEAM_ID',
  '  APPLE_ADS_KEY_ID',
  '  APPLE_ADS_PRIVATE_KEY oder APPLE_ADS_PRIVATE_KEY_PATH (EC P-256 PEM)',
  '  APPLE_ADS_ORG_ID      (optional – sonst automatisch via /acls ermittelt)',
].join('\n');

// ── OAuth (client credentials with ES256 client assertion) ─────────────────

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function buildClientAssertion(config: AppleAdsConfig): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: config.keyId };
  const payload = {
    sub: config.clientId,
    aud: 'https://appleid.apple.com',
    iat: now,
    exp: now + 600,
    iss: config.teamId,
  };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  // JWT ES256 requires the raw r||s signature (ieee-p1363), not DER.
  const signature = cryptoSign('sha256', Buffer.from(signingInput), {
    key: config.privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  return `${signingInput}.${signature.toString('base64url')}`;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(config: AppleAdsConfig): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: buildClientAssertion(config),
    scope: 'searchadsorg',
  });

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apple OAuth failed (${res.status}): ${text.slice(0, 300)}`);
  }

  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    // Refresh 5 minutes before actual expiry.
    expiresAt: Date.now() + Math.max(60, json.expires_in - 300) * 1000,
  };
  return json.access_token;
}

// ── API client ──────────────────────────────────────────────────────────────

let cachedOrgId: string | null = null;

async function apiRequest<T = unknown>(
  config: AppleAdsConfig,
  path: string,
  options: { method?: string; body?: unknown; orgId?: string | null } = {},
): Promise<T> {
  const token = await getAccessToken(config);
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
  if (options.orgId !== null) {
    const orgId = options.orgId ?? (await resolveOrgId(config));
    headers['X-AP-Context'] = `orgId=${orgId}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await res.text();
  if (!res.ok) {
    let message = text.slice(0, 500);
    try {
      const parsed = JSON.parse(text) as { error?: { errors?: Array<{ message?: string; messageCode?: string; field?: string }> } };
      const errors = parsed.error?.errors;
      if (errors?.length) {
        message = errors.map((e) => `${e.messageCode || ''} ${e.message || ''}${e.field ? ` (field: ${e.field})` : ''}`.trim()).join(' | ');
      }
    } catch {
      // keep raw text
    }
    throw new Error(`Apple Ads API ${options.method || 'GET'} ${path} → ${res.status}: ${message}`);
  }
  return (text ? JSON.parse(text) : {}) as T;
}

async function resolveOrgId(config: AppleAdsConfig): Promise<string> {
  if (config.orgId) return config.orgId;
  if (cachedOrgId) return cachedOrgId;

  // /acls is called without the X-AP-Context header.
  const acls = await apiRequest<{ data?: Array<{ orgId?: number; orgName?: string }> }>(config, '/acls', { orgId: null });
  const first = acls.data?.[0];
  if (!first?.orgId) {
    throw new Error('Keine Apple Ads Organisation gefunden. Setze APPLE_ADS_ORG_ID oder prüfe die API-User-Rechte.');
  }
  cachedOrgId = String(first.orgId);
  return cachedOrgId;
}

// ── Formatting helpers ──────────────────────────────────────────────────────

type Money = { amount?: string | number | null; currency?: string | null };

function fmtMoney(value: unknown): string {
  if (value && typeof value === 'object' && 'amount' in (value as Record<string, unknown>)) {
    const money = value as Money;
    return `${money.amount ?? '0'} ${money.currency ?? ''}`.trim();
  }
  return String(value ?? '—');
}

function fmtMetrics(metrics: Record<string, unknown> | undefined | null): string {
  if (!metrics) return '(keine Metriken)';
  const parts: string[] = [];
  const preferred = ['impressions', 'taps', 'totalInstalls', 'installs', 'tapInstalls', 'viewInstalls', 'newDownloads', 'totalNewDownloads', 'redownloads', 'totalRedownloads', 'localSpend', 'avgCPT', 'avgCPA', 'totalAvgCPI', 'ttr', 'conversionRate'];
  const keys = Object.keys(metrics);
  const ordered = [...preferred.filter((k) => keys.includes(k)), ...keys.filter((k) => !preferred.includes(k)).sort()];
  for (const key of ordered) {
    const value = metrics[key];
    if (value === null || value === undefined) continue;
    if (typeof value === 'object') {
      parts.push(`${key}=${fmtMoney(value)}`);
    } else if (typeof value === 'number' && !Number.isInteger(value)) {
      parts.push(`${key}=${value.toFixed(4)}`);
    } else {
      parts.push(`${key}=${String(value)}`);
    }
  }
  return parts.join(' · ') || '(keine Metriken)';
}

type DateRange = 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'custom';

function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function resolveDateRange(range: DateRange, startDate?: string, endDate?: string): { startTime: string; endTime: string } {
  const now = new Date();
  const today = utcDateString(now);
  const daysAgo = (n: number) => utcDateString(new Date(now.getTime() - n * 86_400_000));

  switch (range) {
    case 'today':
      return { startTime: today, endTime: today };
    case 'yesterday':
      return { startTime: daysAgo(1), endTime: daysAgo(1) };
    case 'last_7_days':
      return { startTime: daysAgo(7), endTime: today };
    case 'last_30_days':
      return { startTime: daysAgo(30), endTime: today };
    case 'custom': {
      if (!startDate || !endDate) {
        throw new Error('Für range=custom sind start_date und end_date (YYYY-MM-DD) erforderlich.');
      }
      return { startTime: startDate, endTime: endDate };
    }
  }
}

function ok(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function fail(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: 'text' as const, text: `❌ ${message}` }] };
}

// ── Tool registration ───────────────────────────────────────────────────────

export function registerAppleAdsTools(server: McpServer, logAction: LogFn) {
  const requireConfig = (): AppleAdsConfig => {
    const config = loadConfig();
    if (!config) throw new Error(SETUP_HELP);
    return config;
  };

  // — Orgs / setup check —
  server.tool(
    'apple_ads_orgs',
    'Apple Ads: Listet die verfügbaren Apple Search Ads Organisationen (orgId, Name, Währung). Nützlich als Setup-/Verbindungstest und um APPLE_ADS_ORG_ID zu bestimmen.',
    {},
    async () => {
      try {
        const config = requireConfig();
        const acls = await apiRequest<{ data?: Array<Record<string, unknown>> }>(config, '/acls', { orgId: null });
        const rows = (acls.data || []).map((org) =>
          `• orgId=${org.orgId} – ${org.orgName} (${org.currency || '?'}, roles: ${Array.isArray(org.roleNames) ? (org.roleNames as string[]).join('/') : '?'})`,
        );
        return ok(rows.length ? `🍎 Apple Ads Organisationen:\n\n${rows.join('\n')}` : 'Keine Organisationen gefunden.');
      } catch (err) {
        return fail(err);
      }
    },
  );

  // — Campaigns —
  server.tool(
    'apple_ads_list_campaigns',
    'Apple Ads: Listet alle App Store Kampagnen mit Status, Budget, Tagesbudget, Ländern/Regionen und Serving-Status.',
    {
      limit: z.number().int().min(1).max(1000).optional().default(50).describe('Max. Anzahl (Default 50)'),
      offset: z.number().int().min(0).optional().default(0).describe('Pagination-Offset'),
    },
    async ({ limit, offset }) => {
      try {
        const config = requireConfig();
        const res = await apiRequest<{ data?: Array<Record<string, unknown>>; pagination?: { totalResults?: number } }>(
          config,
          `/campaigns?limit=${limit}&offset=${offset}`,
        );
        const campaigns = res.data || [];
        const rows = campaigns.map((c) => {
          const countries = Array.isArray(c.countriesOrRegions) ? (c.countriesOrRegions as string[]).join(', ') : '?';
          return [
            `• [${c.id}] "${c.name}"`,
            `   Status: ${c.status} (${c.displayStatus ?? c.servingStatus ?? '?'})`,
            `   Budget: ${fmtMoney(c.budgetAmount)} | Tagesbudget: ${fmtMoney(c.dailyBudgetAmount)}`,
            `   Länder/Regionen: ${countries}`,
          ].join('\n');
        });
        const total = res.pagination?.totalResults ?? campaigns.length;
        return ok(rows.length ? `🍎 ${total} Kampagne(n):\n\n${rows.join('\n\n')}` : '🍎 Keine Kampagnen gefunden.');
      } catch (err) {
        return fail(err);
      }
    },
  );

  server.tool(
    'apple_ads_get_campaign',
    'Apple Ads: Details einer einzelnen Kampagne (Status, Budgets, Länder, App-ID, Zeiten).',
    {
      campaign_id: z.string().describe('Kampagnen-ID'),
    },
    async ({ campaign_id }) => {
      try {
        const config = requireConfig();
        const res = await apiRequest<{ data?: Record<string, unknown> }>(config, `/campaigns/${campaign_id}`);
        const c = res.data;
        if (!c) return ok('Kampagne nicht gefunden.');
        return ok(`🍎 Kampagne ${c.id}:\n${JSON.stringify(c, null, 2)}`);
      } catch (err) {
        return fail(err);
      }
    },
  );

  // — Ad groups —
  server.tool(
    'apple_ads_list_adgroups',
    'Apple Ads: Listet die Ad Groups einer Kampagne (Status, Default-Bid, Serving-Status).',
    {
      campaign_id: z.string().describe('Kampagnen-ID'),
      limit: z.number().int().min(1).max(1000).optional().default(100),
      offset: z.number().int().min(0).optional().default(0),
    },
    async ({ campaign_id, limit, offset }) => {
      try {
        const config = requireConfig();
        const res = await apiRequest<{ data?: Array<Record<string, unknown>> }>(
          config,
          `/campaigns/${campaign_id}/adgroups?limit=${limit}&offset=${offset}`,
        );
        const groups = res.data || [];
        const rows = groups.map((g) =>
          `• [${g.id}] "${g.name}" – Status: ${g.status} (${g.displayStatus ?? g.servingStatus ?? '?'}), Default-Bid: ${fmtMoney(g.defaultBidAmount)}${g.cpaGoal ? `, CPA-Ziel: ${fmtMoney(g.cpaGoal)}` : ''}`,
        );
        return ok(rows.length ? `🍎 ${rows.length} Ad Group(s) in Kampagne ${campaign_id}:\n\n${rows.join('\n')}` : 'Keine Ad Groups gefunden.');
      } catch (err) {
        return fail(err);
      }
    },
  );

  // — Keywords (structure incl. bid/matchType) —
  server.tool(
    'apple_ads_list_keywords',
    'Apple Ads: Listet die Targeting-Keywords einer Ad Group inkl. Match Type, Bid und Status. (Performance-Metriken pro Keyword liefert apple_ads_report mit level=keywords.)',
    {
      campaign_id: z.string().describe('Kampagnen-ID'),
      adgroup_id: z.string().describe('Ad-Group-ID'),
      limit: z.number().int().min(1).max(1000).optional().default(200),
      offset: z.number().int().min(0).optional().default(0),
    },
    async ({ campaign_id, adgroup_id, limit, offset }) => {
      try {
        const config = requireConfig();
        const res = await apiRequest<{ data?: Array<Record<string, unknown>> }>(
          config,
          `/campaigns/${campaign_id}/adgroups/${adgroup_id}/targetingkeywords?limit=${limit}&offset=${offset}`,
        );
        const keywords = res.data || [];
        const rows = keywords.map((k) =>
          `• [${k.id}] "${k.text}" – ${k.matchType}, Bid: ${fmtMoney(k.bidAmount)}, Status: ${k.status}`,
        );
        return ok(rows.length ? `🍎 ${rows.length} Keyword(s):\n\n${rows.join('\n')}` : 'Keine Keywords gefunden.');
      } catch (err) {
        return fail(err);
      }
    },
  );

  // — Reports (campaigns / adgroups / keywords / searchterms) —
  server.tool(
    'apple_ads_report',
    'Apple Ads: Performance-Report mit Impressionen, Taps, Installs, Spend, CPT/CPA usw. level=campaigns (alle Kampagnen), adgroups/keywords/searchterms (brauchen campaign_id). Zeitraum: today, yesterday, last_7_days, last_30_days oder custom mit start_date/end_date.',
    {
      level: z.enum(['campaigns', 'adgroups', 'keywords', 'searchterms']).describe('Report-Ebene'),
      range: z.enum(['today', 'yesterday', 'last_7_days', 'last_30_days', 'custom']).describe('Zeitraum'),
      start_date: z.string().optional().describe('YYYY-MM-DD (nur bei range=custom)'),
      end_date: z.string().optional().describe('YYYY-MM-DD (nur bei range=custom)'),
      campaign_id: z.string().optional().describe('Erforderlich für adgroups/keywords/searchterms'),
      group_by_country: z.boolean().optional().default(false).describe('Nur level=campaigns: nach Land/Region aufschlüsseln'),
      order_by: z.string().optional().default('localSpend').describe('Sortier-Metrik (Default localSpend)'),
      limit: z.number().int().min(1).max(1000).optional().default(200),
    },
    async ({ level, range, start_date, end_date, campaign_id, group_by_country, order_by, limit }) => {
      try {
        const config = requireConfig();
        if (level !== 'campaigns' && !campaign_id) {
          return ok(`❌ Für level=${level} ist campaign_id erforderlich.`);
        }

        const { startTime, endTime } = resolveDateRange(range as DateRange, start_date, end_date);
        const groupBy = level === 'campaigns' && group_by_country ? ['countryOrRegion'] : undefined;

        const body: Record<string, unknown> = {
          startTime,
          endTime,
          timeZone: 'UTC',
          returnRecordsWithNoMetrics: false,
          returnRowTotals: true,
          returnGrandTotals: true,
          selector: {
            orderBy: [{ field: groupBy ? 'countryOrRegion' : order_by, sortOrder: groupBy ? 'ASCENDING' : 'DESCENDING' }],
            pagination: { offset: 0, limit },
          },
        };
        if (groupBy) body.groupBy = groupBy;

        const path =
          level === 'campaigns' ? '/reports/campaigns'
          : level === 'adgroups' ? `/reports/campaigns/${campaign_id}/adgroups`
          : level === 'keywords' ? `/reports/campaigns/${campaign_id}/keywords`
          : `/reports/campaigns/${campaign_id}/searchterms`;

        type ReportRow = { metadata?: Record<string, unknown>; total?: Record<string, unknown>; other?: boolean };
        const res = await apiRequest<{ data?: { reportingDataResponse?: { row?: ReportRow[]; grandTotals?: { total?: Record<string, unknown> } } } }>(
          config,
          path,
          { method: 'POST', body },
        );

        const rows = res.data?.reportingDataResponse?.row || [];
        const grand = res.data?.reportingDataResponse?.grandTotals?.total;

        const lines = rows.map((row) => {
          const md = row.metadata || {};
          let label: string;
          if (md.countryOrRegion && groupBy) label = `🌍 ${md.countryOrRegion} – "${md.campaignName ?? md.campaignId}"`;
          else if (md.searchTermText !== undefined) label = `🔎 "${md.searchTermText ?? '(low volume)'}" [${md.searchTermSource ?? '?'}] → Keyword: "${md.keyword ?? '—'}" (${md.matchType ?? '?'})`;
          else if (md.keyword !== undefined) label = `🔑 "${md.keyword}" (${md.matchType ?? '?'}, Bid: ${fmtMoney(md.bidAmount)}, Status: ${md.keywordStatus ?? '?'})`;
          else if (md.adGroupName !== undefined) label = `📁 "${md.adGroupName}" [${md.adGroupId}] (${md.adGroupStatus ?? '?'})`;
          else label = `📣 "${md.campaignName ?? '?'}" [${md.campaignId}] (${md.campaignStatus ?? '?'})`;
          return `${label}\n   ${fmtMetrics(row.total)}`;
        });

        const header = `🍎 Apple Ads Report – ${level}, ${startTime} bis ${endTime}${campaign_id ? `, Kampagne ${campaign_id}` : ''}`;
        const totalLine = grand ? `\n\nΣ Gesamt: ${fmtMetrics(grand)}` : '';
        return ok(lines.length ? `${header}\n\n${lines.join('\n\n')}${totalLine}` : `${header}\n\nKeine Daten im Zeitraum (oder noch keine Impressionen).${totalLine}`);
      } catch (err) {
        return fail(err);
      }
    },
  );

  // — Management: campaign status / budget —
  server.tool(
    'apple_ads_update_campaign',
    'Apple Ads: Kampagne verwalten – pausieren/aktivieren und/oder Tagesbudget ändern. ACHTUNG: Wirkt sofort auf echte Werbeausgaben. Frage David IMMER zuerst um Bestätigung, bevor du dieses Tool ausführst.',
    {
      campaign_id: z.string().describe('Kampagnen-ID'),
      status: z.enum(['ENABLED', 'PAUSED']).optional().describe('Neuer Status'),
      daily_budget: z.number().positive().optional().describe('Neues Tagesbudget (in Kampagnen-Währung)'),
    },
    async ({ campaign_id, status, daily_budget }) => {
      try {
        const config = requireConfig();
        if (!status && daily_budget === undefined) {
          return ok('❌ Nichts zu ändern: gib status und/oder daily_budget an.');
        }

        // Fetch the campaign first to reuse its currency for budget updates.
        const current = await apiRequest<{ data?: Record<string, unknown> }>(config, `/campaigns/${campaign_id}`);
        const currency = ((current.data?.dailyBudgetAmount ?? current.data?.budgetAmount) as Money | undefined)?.currency || 'EUR';

        const campaign: Record<string, unknown> = {};
        if (status) campaign.status = status;
        if (daily_budget !== undefined) campaign.dailyBudgetAmount = { amount: String(daily_budget), currency };

        await apiRequest(config, `/campaigns/${campaign_id}`, {
          method: 'PUT',
          body: { campaign, clearGeoTargetingOnCountryOrRegionChange: false },
        });

        const changes = [status ? `Status → ${status}` : null, daily_budget !== undefined ? `Tagesbudget → ${daily_budget} ${currency}` : null].filter(Boolean).join(', ');
        await logAction('apple_ads_update_campaign', { campaign_id, status, daily_budget }, `Apple Ads Kampagne ${campaign_id} aktualisiert: ${changes}`);
        return ok(`✅ Kampagne ${campaign_id} aktualisiert: ${changes}`);
      } catch (err) {
        await logAction('apple_ads_update_campaign', { campaign_id, status, daily_budget }, `FEHLER: ${err instanceof Error ? err.message : String(err)}`);
        return fail(err);
      }
    },
  );

  // — Management: keyword bid / status —
  server.tool(
    'apple_ads_update_keyword',
    'Apple Ads: Keyword verwalten – Gebot (Bid) ändern und/oder pausieren/aktivieren. ACHTUNG: Wirkt sofort auf echte Werbeausgaben. Frage David IMMER zuerst um Bestätigung, bevor du dieses Tool ausführst.',
    {
      campaign_id: z.string().describe('Kampagnen-ID'),
      adgroup_id: z.string().describe('Ad-Group-ID'),
      keyword_id: z.string().describe('Keyword-ID (aus apple_ads_list_keywords)'),
      bid: z.number().positive().optional().describe('Neues Gebot (in Kampagnen-Währung)'),
      status: z.enum(['ACTIVE', 'PAUSED']).optional().describe('Neuer Keyword-Status'),
    },
    async ({ campaign_id, adgroup_id, keyword_id, bid, status }) => {
      try {
        const config = requireConfig();
        if (bid === undefined && !status) {
          return ok('❌ Nichts zu ändern: gib bid und/oder status an.');
        }

        const current = await apiRequest<{ data?: Record<string, unknown> }>(config, `/campaigns/${campaign_id}`);
        const currency = ((current.data?.dailyBudgetAmount ?? current.data?.budgetAmount) as Money | undefined)?.currency || 'EUR';

        const update: Record<string, unknown> = { id: Number(keyword_id) };
        if (bid !== undefined) update.bidAmount = { amount: String(bid), currency };
        if (status) update.status = status;

        await apiRequest(config, `/campaigns/${campaign_id}/adgroups/${adgroup_id}/targetingkeywords/bulk`, {
          method: 'PUT',
          body: [update],
        });

        const changes = [bid !== undefined ? `Bid → ${bid} ${currency}` : null, status ? `Status → ${status}` : null].filter(Boolean).join(', ');
        await logAction('apple_ads_update_keyword', { campaign_id, adgroup_id, keyword_id, bid, status }, `Apple Ads Keyword ${keyword_id} aktualisiert: ${changes}`);
        return ok(`✅ Keyword ${keyword_id} aktualisiert: ${changes}`);
      } catch (err) {
        await logAction('apple_ads_update_keyword', { campaign_id, adgroup_id, keyword_id, bid, status }, `FEHLER: ${err instanceof Error ? err.message : String(err)}`);
        return fail(err);
      }
    },
  );
}

// Re-export for potential unit tests / reuse.
export const _internal = { buildClientAssertion, resolveDateRange, fmtMetrics, fmtMoney };
