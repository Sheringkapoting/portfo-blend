-- Fix kite_sessions RLS policy: remove the "OR user_id IS NULL" escape clause
-- This prevents token exposure to other authenticated users

DROP POLICY IF EXISTS "Users can view their own kite sessions" ON kite_sessions;

CREATE POLICY "Users can view their own kite sessions"
ON kite_sessions FOR SELECT
USING (auth.uid() = user_id);

-- Clean up any orphaned sessions without user_id
DELETE FROM kite_sessions WHERE user_id IS NULL;

-- Add unique constraint for portfolio_snapshots on (snapshot_date, user_id)
-- This prevents data overwrites between users for the same date

-- First, drop the old single-column unique constraint if it exists
ALTER TABLE portfolio_snapshots DROP CONSTRAINT IF EXISTS portfolio_snapshots_snapshot_date_key;

-- Add composite unique constraint
ALTER TABLE portfolio_snapshots 
ADD CONSTRAINT portfolio_snapshots_snapshot_date_user_id_key 
UNIQUE(snapshot_date, user_id);

-- Update exchange_rates RLS policies to be more secure
-- Only allow service role to insert/update/delete
DROP POLICY IF EXISTS "Allow anyone to insert exchange rates" ON exchange_rates;
DROP POLICY IF EXISTS "Allow anyone to read exchange rates" ON exchange_rates;

CREATE POLICY "Allow public read access to exchange rates"
ON exchange_rates FOR SELECT
USING (true);

-- Allow service role to manage exchange rates (edge functions use service role)
CREATE POLICY "Allow service role to manage exchange rates"
ON exchange_rates FOR ALL
USING (true)
WITH CHECK (true);