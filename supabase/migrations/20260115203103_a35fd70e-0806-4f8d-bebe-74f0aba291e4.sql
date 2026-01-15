-- Fix 1: Add user_id column to snapshot_source_details and fix RLS
ALTER TABLE snapshot_source_details 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_snapshot_source_details_user_id 
ON snapshot_source_details(user_id);

-- Populate user_id from related snapshots
UPDATE snapshot_source_details sd
SET user_id = ps.user_id
FROM portfolio_snapshots ps
WHERE sd.snapshot_id = ps.id AND sd.user_id IS NULL;

-- Drop old permissive policies on snapshot_source_details
DROP POLICY IF EXISTS "Allow public read access to snapshot source details" ON snapshot_source_details;
DROP POLICY IF EXISTS "Allow public insert to snapshot source details" ON snapshot_source_details;
DROP POLICY IF EXISTS "Allow public update to snapshot source details" ON snapshot_source_details;
DROP POLICY IF EXISTS "Allow public delete to snapshot source details" ON snapshot_source_details;

-- Create proper RLS policies for snapshot_source_details
CREATE POLICY "Users view own snapshot details"
ON snapshot_source_details FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Service role manages snapshot details"
ON snapshot_source_details FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Fix 2: Fix service role policies to use auth.role() instead of USING (true)
-- Fix kite_sessions service role policy
DROP POLICY IF EXISTS "Service role full access on kite_sessions" ON kite_sessions;
CREATE POLICY "Service role full access on kite_sessions"
ON kite_sessions FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Fix portfolio_snapshots service role policy
DROP POLICY IF EXISTS "Allow service role write access on portfolio_snapshots" ON portfolio_snapshots;
CREATE POLICY "Service role write access on portfolio_snapshots"
ON portfolio_snapshots FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Fix sync_logs service role policy
DROP POLICY IF EXISTS "Service role insert sync logs" ON sync_logs;
CREATE POLICY "Service role manages sync logs"
ON sync_logs FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Fix exchange_rates duplicate/permissive policies
DROP POLICY IF EXISTS "Allow service role to manage exchange rates" ON exchange_rates;

-- Fix 3: Create a view for kite_sessions that doesn't expose access_token
CREATE OR REPLACE VIEW kite_sessions_status AS
SELECT 
  id,
  user_id,
  expires_at,
  created_at,
  updated_at,
  token_type,
  (expires_at > now()) AS is_valid
FROM kite_sessions;

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON kite_sessions_status TO authenticated;

-- Fix 4: Block client-side direct access to kite_sessions (remove user SELECT policy)
-- Keep service role access only
DROP POLICY IF EXISTS "Users can view their own kite sessions" ON kite_sessions;

-- Fix 5: Add documentation comment to the SECURITY DEFINER function
COMMENT ON FUNCTION public.handle_new_user() IS 
'SECURITY DEFINER: Only modify with extreme caution. Bypasses RLS. Must only operate on NEW.id user data. This function creates a profile for new users. Do not add queries to other tables or user-controlled inputs.';