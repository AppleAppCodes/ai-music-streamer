/**
 * Platform analytics for the YORIAX MCP server.
 *
 * Read-only tools so MCP agents (Hermes, OpenClaw etc.) can answer
 * "wie läuft die Plattform?" with real numbers: live KPIs, daily metric
 * snapshots (metrics_daily) and top songs by honestly tracked plays.
 *
 * All queries run with the service-role client (RLS bypass); the data
 * sources are the tracking layer (song_daily_plays, user_activity_days,
 * metrics_daily) — NOT the display play counters shown in the app.
 * These tools only read, so they are not written to mcp_logs (the
 * Bot-Control log is for database changes).
 */
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SupabaseClient } from '@supabase/supabase-js';
export declare function registerAnalyticsTools(server: McpServer, supabase: SupabaseClient): void;
