-- SECURITY FIX: Restrict kite_sessions table - trading tokens must NEVER be client-accessible
-- Drop all existing public policies on kite_sessions
DROP POLICY IF EXISTS "Allow public read access on kite_sessions" ON public.kite_sessions;
DROP POLICY IF EXISTS "Allow public insert access on kite_sessions" ON public.kite_sessions;
DROP POLICY IF EXISTS "Allow public update access on kite_sessions" ON public.kite_sessions;
DROP POLICY IF EXISTS "Allow public delete access on kite_sessions" ON public.kite_sessions;

-- Block ALL client access to kite_sessions - only service role (edge functions) can access
CREATE POLICY "Block all client access on kite_sessions" ON public.kite_sessions
  FOR ALL USING (false);

-- SECURITY FIX: Restrict holdings table - public SELECT only, no INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "Allow public insert holdings" ON public.holdings;
DROP POLICY IF EXISTS "Allow public update holdings" ON public.holdings;
DROP POLICY IF EXISTS "Allow public delete holdings" ON public.holdings;
-- Keep SELECT policy for viewing portfolio data

-- SECURITY FIX: Restrict quotes_cache - keep SELECT for market data, remove write access
DROP POLICY IF EXISTS "Allow public insert quotes" ON public.quotes_cache;
DROP POLICY IF EXISTS "Allow public update quotes" ON public.quotes_cache;
DROP POLICY IF EXISTS "Allow public delete quotes" ON public.quotes_cache;
-- Keep SELECT policy for viewing market data

-- SECURITY FIX: Restrict sync_logs - public SELECT only to view sync status
DROP POLICY IF EXISTS "Allow public insert sync_logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Allow public update sync_logs" ON public.sync_logs;
DROP POLICY IF EXISTS "Allow public delete sync_logs" ON public.sync_logs;

-- SECURITY FIX: Restrict portfolio_snapshots - public SELECT only
DROP POLICY IF EXISTS "Allow public insert access on portfolio_snapshots" ON public.portfolio_snapshots;
DROP POLICY IF EXISTS "Allow public update access on portfolio_snapshots" ON public.portfolio_snapshots;
DROP POLICY IF EXISTS "Allow public delete access on portfolio_snapshots" ON public.portfolio_snapshots;

-- SECURITY FIX: Restrict snapshot_source_details - public SELECT only
DROP POLICY IF EXISTS "Allow public insert on snapshot_source_details" ON public.snapshot_source_details;
DROP POLICY IF EXISTS "Allow public update on snapshot_source_details" ON public.snapshot_source_details;
DROP POLICY IF EXISTS "Allow public delete on snapshot_source_details" ON public.snapshot_source_details;