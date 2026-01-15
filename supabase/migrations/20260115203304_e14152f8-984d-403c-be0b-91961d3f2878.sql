-- Fix quotes_cache: Add restrictive policies for write operations (service role only)
CREATE POLICY "Service role manages quotes cache"
ON quotes_cache FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Fix exchange_rates: Remove duplicate SELECT policy
DROP POLICY IF EXISTS "Allow public read access to exchange rates" ON exchange_rates;

-- Note: kite_sessions_status is a view with security_invoker = true, so it uses the underlying table's RLS.
-- The view accesses kite_sessions which has proper RLS policies:
-- - "Users can view own kite session status" for SELECT
-- - "Service role full access on kite_sessions" for ALL operations