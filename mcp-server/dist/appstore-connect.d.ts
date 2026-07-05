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
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
type LogFn = (toolName: string, args: unknown, summary: string) => Promise<void>;
export declare function registerAppStoreConnectTools(server: McpServer, logAction?: LogFn): void;
export {};
