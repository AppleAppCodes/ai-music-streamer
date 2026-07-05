/**
 * App Store Connect API integration for the YORIAX MCP server.
 *
 * Lets MCP agents (Hermes, OpenClaw …) answer App-Store questions with live
 * data: review status of versions, TestFlight build processing, customer
 * reviews and daily download/sales reports.
 *
 * Credentials (env vars override ~/.yoriax/appstore-connect.env):
 *   ASC_ISSUER_ID          – Users and Access → Integrations → App Store Connect API
 *   ASC_KEY_ID             – team key id
 *   ASC_PRIVATE_KEY        – .p8 contents, or ASC_PRIVATE_KEY_PATH – path to the .p8
 *   ASC_APP_ID             – Apple app id (YORIAX: 6780680190)
 *   ASC_VENDOR_NUMBER      – for sales reports (Payments and Financial Reports page)
 *
 * Auth: the ES256-signed JWT is used directly as the bearer token
 * (aud "appstoreconnect-v1", max 20 minutes lifetime) — no token exchange.
 */

import { sign as cryptoSign } from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { gunzipSync } from 'zlib';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const API_BASE = 'https://api.appstoreconnect.apple.com/v1';
const CREDENTIALS_FILE = path.join(os.homedir(), '.yoriax', 'appstore-connect.env');

type AscConfig = {
  issuerId: string;
  keyId: string;
  privateKey: string;
  appId: string;
  vendorNumber?: string;
};

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

function loadConfig(): AscConfig | null {
  const fileValues = readCredentialsFile();
  const get = (key: string) => process.env[key] || fileValues[key] || '';

  const issuerId = get('ASC_ISSUER_ID');
  const keyId = get('ASC_KEY_ID');
  let privateKey = get('ASC_PRIVATE_KEY');
  const privateKeyPath = get('ASC_PRIVATE_KEY_PATH');
  if (!privateKey && privateKeyPath) {
    try {
      privateKey = fs.readFileSync(privateKeyPath, 'utf8');
    } catch {
      privateKey = '';
    }
  }
  privateKey = privateKey.replace(/\\n/g, '\n').trim();
  const appId = get('ASC_APP_ID');

  if (!issuerId || !keyId || !privateKey || !appId) return null;

  return { issuerId, keyId, privateKey, appId, vendorNumber: get('ASC_VENDOR_NUMBER') || undefined };
}

const SETUP_HELP = [
  'App Store Connect ist nicht konfiguriert. Lege die Datei ~/.yoriax/appstore-connect.env an',
  '(KEY=VALUE pro Zeile) oder setze dieselben Werte als Environment-Variablen:',
  '',
  '  ASC_ISSUER_ID        (App Store Connect → Benutzer und Zugriff → Integrationen)',
  '  ASC_KEY_ID',
  '  ASC_PRIVATE_KEY oder ASC_PRIVATE_KEY_PATH (.p8-Datei)',
  '  ASC_APP_ID           (YORIAX: 6780680190)',
  '  ASC_VENDOR_NUMBER    (optional, nur für Verkaufs-/Download-Reports)',
].join('\n');

// ── Auth: signed JWT is the bearer token ────────────────────────────────────

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

let cachedToken: { token: string; expiresAt: number } | null = null;

function getBearerToken(config: AscConfig): string {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token;

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: config.keyId, typ: 'JWT' };
  const payload = { iss: config.issuerId, iat: now, exp: now + 900, aud: 'appstoreconnect-v1' };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  // JWT ES256 requires the raw r||s signature (ieee-p1363), not DER.
  const signature = cryptoSign('sha256', Buffer.from(signingInput), {
    key: config.privateKey,
    dsaEncoding: 'ieee-p1363',
  });
  const token = `${signingInput}.${signature.toString('base64url')}`;
  cachedToken = { token, expiresAt: Date.now() + 10 * 60 * 1000 };
  return token;
}

async function ascRequest(config: AscConfig, pathname: string, accept?: string): Promise<Response> {
  return fetch(`${API_BASE}${pathname}`, {
    headers: {
      Authorization: `Bearer ${getBearerToken(config)}`,
      ...(accept ? { Accept: accept } : {}),
    },
  });
}

async function ascJson(config: AscConfig, pathname: string): Promise<any> {
  const res = await ascRequest(config, pathname);
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 400);
    try {
      const parsed = JSON.parse(text);
      detail = (parsed.errors ?? [])
        .map((e: any) => `${e.status} ${e.code}: ${e.detail ?? e.title}`)
        .join(' | ') || detail;
    } catch {
      // keep raw text
    }
    throw new Error(`App Store Connect API ${res.status}: ${detail}`);
  }
  return JSON.parse(text);
}

const APP_STORE_STATE_LABELS: Record<string, string> = {
  READY_FOR_SALE: '✅ Im App Store live',
  READY_FOR_DISTRIBUTION: '✅ Im App Store live',
  PROCESSING_FOR_DISTRIBUTION: '⚙️ Wird für die Verteilung verarbeitet',
  READY_FOR_REVIEW: '📝 Bereit zur Einreichung',
  WAITING_FOR_EXPORT_COMPLIANCE: '⏳ Wartet auf Export-Compliance',
  ACCEPTED: '✅ Angenommen',
  IN_REVIEW: '🔎 Wird gerade geprüft',
  WAITING_FOR_REVIEW: '⏳ Wartet auf Prüfung',
  PENDING_DEVELOPER_RELEASE: '🟢 Freigegeben – wartet auf deine Veröffentlichung',
  PENDING_APPLE_RELEASE: '🟢 Freigegeben – wartet auf Apple-Release',
  PREPARE_FOR_SUBMISSION: '📝 In Vorbereitung (noch nicht eingereicht)',
  REJECTED: '❌ Abgelehnt',
  METADATA_REJECTED: '❌ Metadaten abgelehnt',
  DEVELOPER_REJECTED: '↩️ Von dir zurückgezogen',
  INVALID_BINARY: '❌ Ungültiges Binary',
  PROCESSING_FOR_APP_STORE: '⚙️ Wird fürs App Store verarbeitet',
  REPLACED_WITH_NEW_VERSION: '↻ Durch neuere Version ersetzt',
  REMOVED_FROM_SALE: '🚫 Aus dem Verkauf genommen',
};

function formatDate(value?: string): string {
  if (!value) return '–';
  return new Date(value).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' });
}

export function registerAppStoreConnectTools(server: McpServer) {
  // ── Tool: asc_app_status ──────────────────────────────────────────────────
  server.tool(
    'asc_app_status',
    'Review-/Freigabe-Status der YORIAX-App-Versionen in App Store Connect: welche Version ist live, welche ist in Prüfung, welche wurde abgelehnt. Nutze dieses Tool, wenn David fragt, ob eine Version "durch" ist oder wie der Stand der App-Prüfung ist.',
    {},
    async () => {
      const config = loadConfig();
      if (!config) return { content: [{ type: 'text', text: SETUP_HELP }] };
      try {
        const json = await ascJson(
          config,
          `/apps/${config.appId}/appStoreVersions?limit=8&fields[appStoreVersions]=versionString,appVersionState,createdDate,releaseType`
        );
        // Apple reports superseded released versions as READY_FOR_DISTRIBUTION
        // too — only the newest released entry is the one actually in the store.
        let liveSeen = false;
        const lines = (json.data ?? []).map((v: any) => {
          const state = v.attributes?.appVersionState ?? 'UNBEKANNT';
          const released = state === 'READY_FOR_DISTRIBUTION' || state === 'READY_FOR_SALE';
          let label = APP_STORE_STATE_LABELS[state] ?? state;
          if (released && liveSeen) label = '✅ Veröffentlicht (durch neuere Version ersetzt)';
          if (released) liveSeen = true;
          return `• ${v.attributes?.versionString}: ${label} (angelegt ${formatDate(v.attributes?.createdDate)})`;
        });
        return {
          content: [{ type: 'text', text: lines.length ? `🍏 App-Store-Versionen von YORIAX:\n\n${lines.join('\n')}` : 'Keine Versionen gefunden.' }],
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `❌ ${err.message}` }] };
      }
    }
  );

  // ── Tool: asc_testflight_builds ───────────────────────────────────────────
  server.tool(
    'asc_testflight_builds',
    'Die neuesten TestFlight-Builds der YORIAX-App mit Verarbeitungsstatus (verarbeitet/in Verarbeitung/abgelaufen). Nutze dieses Tool, wenn David fragt, ob ein Build schon in TestFlight verfügbar ist.',
    {
      limit: z.number().int().min(1).max(30).optional().describe('Wie viele Builds (Standard 10)'),
    },
    async ({ limit }) => {
      const config = loadConfig();
      if (!config) return { content: [{ type: 'text', text: SETUP_HELP }] };
      try {
        const json = await ascJson(
          config,
          `/builds?filter[app]=${config.appId}&sort=-uploadedDate&limit=${limit ?? 10}` +
            `&fields[builds]=version,uploadedDate,processingState,expired,preReleaseVersion&include=preReleaseVersion&fields[preReleaseVersions]=version`
        );
        const preReleaseById = new Map<string, string>(
          (json.included ?? [])
            .filter((i: any) => i.type === 'preReleaseVersions')
            .map((i: any) => [i.id, i.attributes?.version])
        );
        const stateLabel = (b: any) => {
          if (b.attributes?.expired) return '⌛ abgelaufen';
          switch (b.attributes?.processingState) {
            case 'VALID': return '✅ verfügbar';
            case 'PROCESSING': return '⚙️ wird verarbeitet';
            case 'FAILED': return '❌ fehlgeschlagen';
            case 'INVALID': return '❌ ungültig';
            default: return b.attributes?.processingState ?? '–';
          }
        };
        const lines = (json.data ?? []).map((b: any) => {
          const marketing = preReleaseById.get(b.relationships?.preReleaseVersion?.data?.id) ?? '?';
          return `• ${marketing} (Build ${b.attributes?.version}): ${stateLabel(b)} · hochgeladen ${formatDate(b.attributes?.uploadedDate)}`;
        });
        return {
          content: [{ type: 'text', text: lines.length ? `✈️ TestFlight-Builds:\n\n${lines.join('\n')}` : 'Keine Builds gefunden.' }],
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `❌ ${err.message}` }] };
      }
    }
  );

  // ── Tool: asc_customer_reviews ────────────────────────────────────────────
  server.tool(
    'asc_customer_reviews',
    'Die neuesten App-Store-Kundenrezensionen der YORIAX-App (Sterne, Titel, Text, Land). Nutze dieses Tool, wenn David nach Bewertungen oder Nutzer-Feedback im App Store fragt.',
    {
      limit: z.number().int().min(1).max(50).optional().describe('Wie viele Rezensionen (Standard 10)'),
    },
    async ({ limit }) => {
      const config = loadConfig();
      if (!config) return { content: [{ type: 'text', text: SETUP_HELP }] };
      try {
        const json = await ascJson(
          config,
          `/apps/${config.appId}/customerReviews?sort=-createdDate&limit=${limit ?? 10}` +
            `&fields[customerReviews]=rating,title,body,reviewerNickname,createdDate,territory`
        );
        const lines = (json.data ?? []).map((r: any) => {
          const a = r.attributes ?? {};
          const stars = '★'.repeat(a.rating ?? 0) + '☆'.repeat(5 - (a.rating ?? 0));
          const title = a.title ? ` „${a.title}"` : '';
          const body = a.body ? `\n   ${String(a.body).slice(0, 300)}` : '';
          return `• ${stars}${title} — ${a.reviewerNickname ?? 'anonym'} (${a.territory ?? '–'}, ${formatDate(a.createdDate)})${body}`;
        });
        return {
          content: [{ type: 'text', text: lines.length ? `⭐ Neueste Rezensionen:\n\n${lines.join('\n\n')}` : 'Noch keine Rezensionen vorhanden.' }],
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `❌ ${err.message}` }] };
      }
    }
  );

  // ── Tool: asc_sales_report ────────────────────────────────────────────────
  server.tool(
    'asc_sales_report',
    'Tages-Report zu App-Store-Downloads/Verkäufen der YORIAX-App (Sales and Trends, Einheiten pro Produkt). Nutze dieses Tool, wenn David nach Download-Zahlen aus dem App Store fragt. Hinweis: Der Report für einen Tag steht erst am Folgetag (ca. ab Mittag deutscher Zeit) bereit.',
    {
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Report-Tag als YYYY-MM-DD (Standard: gestern)'),
    },
    async ({ date }) => {
      const config = loadConfig();
      if (!config) return { content: [{ type: 'text', text: SETUP_HELP }] };
      if (!config.vendorNumber) {
        return { content: [{ type: 'text', text: 'ASC_VENDOR_NUMBER fehlt in ~/.yoriax/appstore-connect.env (steht in App Store Connect unter „Payments and Financial Reports").' }] };
      }
      const reportDate = date ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      try {
        const res = await ascRequest(
          config,
          `/salesReports?filter[frequency]=DAILY&filter[reportDate]=${reportDate}` +
            `&filter[reportSubType]=SUMMARY&filter[reportType]=SALES&filter[vendorNumber]=${config.vendorNumber}`,
          'application/a-gzip'
        );
        if (res.status === 404) {
          return {
            content: [{ type: 'text', text: `📭 Für ${reportDate} liegt (noch) kein Report vor — entweder gab es an dem Tag keine Downloads/Verkäufe, oder Apple hat den Report noch nicht erzeugt (kommt ca. am Folgetag mittags deutscher Zeit).` }],
          };
        }
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`App Store Connect API ${res.status}: ${text.slice(0, 300)}`);
        }
        const tsv = gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8');
        const rows = tsv.trim().split('\n').map((line) => line.split('\t'));
        const header = rows[0];
        const col = (name: string) => header.indexOf(name);
        const iTitle = col('Title');
        const iType = col('Product Type Identifier');
        const iUnits = col('Units');
        const iCountry = col('Country Code');

        // App download product types: 1/1F/1T = new downloads, 3/3F = redownloads, 7/7F = updates.
        const summary = new Map<string, number>();
        const countries = new Map<string, number>();
        let newDownloads = 0;
        let updates = 0;
        for (const row of rows.slice(1)) {
          if (row.length <= Math.max(iTitle, iType, iUnits)) continue;
          const units = Number(row[iUnits] ?? 0) || 0;
          const type = row[iType] ?? '';
          const key = `${row[iTitle]} [${type}]`;
          summary.set(key, (summary.get(key) ?? 0) + units);
          if (iCountry >= 0) countries.set(row[iCountry], (countries.get(row[iCountry]) ?? 0) + units);
          if (type.startsWith('1')) newDownloads += units;
          if (type.startsWith('7')) updates += units;
        }
        const lines = [...summary.entries()].map(([key, units]) => `• ${key}: ${units}`);
        const countryLine = [...countries.entries()].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${n}`).join(' · ');
        return {
          content: [{
            type: 'text',
            text: `📥 App-Store-Report für ${reportDate}:\n\nNeue Downloads: ${newDownloads} · Updates: ${updates}\n\n${lines.join('\n')}${countryLine ? `\n\nLänder: ${countryLine}` : ''}\n\n(Produkttypen: 1*=Neu-Download, 3*=Re-Download, 7*=Update)`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: 'text', text: `❌ ${err.message}` }] };
      }
    }
  );
}
