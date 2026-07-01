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
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
type LogFn = (toolName: string, args: unknown, summary: string) => Promise<void>;
type AppleAdsConfig = {
    clientId: string;
    teamId: string;
    keyId: string;
    privateKey: string;
    orgId?: string;
};
declare function buildClientAssertion(config: AppleAdsConfig): string;
declare function fmtMoney(value: unknown): string;
declare function fmtMetrics(metrics: Record<string, unknown> | undefined | null): string;
type DateRange = 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'custom';
declare function resolveDateRange(range: DateRange, startDate?: string, endDate?: string): {
    startTime: string;
    endTime: string;
};
export declare function registerAppleAdsTools(server: McpServer, logAction: LogFn): void;
export declare const _internal: {
    buildClientAssertion: typeof buildClientAssertion;
    resolveDateRange: typeof resolveDateRange;
    fmtMetrics: typeof fmtMetrics;
    fmtMoney: typeof fmtMoney;
};
export {};
