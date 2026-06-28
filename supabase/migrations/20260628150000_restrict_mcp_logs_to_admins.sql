-- mcp_logs records admin/operator MCP tool calls -- including `arguments` and
-- `response_summary`, which can contain user PII (e.g. get_user_info results)
-- and reveal admin activity. The existing SELECT policy
-- ("Allow read access to authenticated users", USING true) let ANY signed-in
-- user read all of it. Restrict reads to admins. Writes come from the
-- service-role MCP route and bypass RLS, so they are unaffected; the admin
-- dashboard reads mcp_logs only inside its admin-gated section, so it keeps
-- working.

drop policy if exists "Allow read access to authenticated users" on public.mcp_logs;

create policy "Admins can read mcp logs"
on public.mcp_logs
for select
to authenticated
using ((select public.is_admin()));
