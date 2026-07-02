/**
 * Builds a PostgREST-safe quoted ilike pattern for use inside `.or(...)`.
 *
 * Unquoted commas/parentheses in user input are `.or()` syntax characters, so
 * searches like "hip,hop" or "(live)" used to fail with 400. Quoting the
 * pattern makes them literals; embedded quotes/backslashes are stripped.
 */
export function ilikePattern(query: string): string {
  const sanitized = query.trim().replace(/["\\]/g, '');
  return `"%${sanitized}%"`;
}
