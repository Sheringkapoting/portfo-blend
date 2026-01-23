-- Fix security issue: Add RLS policies to kite_sessions_status view
-- Users should be able to view their own session status

-- Drop and recreate the view with proper security
DROP VIEW IF EXISTS kite_sessions_status;

CREATE VIEW kite_sessions_status AS
SELECT 
  id,
  user_id,
  token_type,
  created_at,
  updated_at,
  expires_at,
  CASE WHEN expires_at > now() THEN true ELSE false END as is_valid
FROM kite_sessions;

-- Enable RLS on the base table (already enabled, but ensure it)
ALTER TABLE kite_sessions ENABLE ROW LEVEL SECURITY;

-- Add policy for users to view their own sessions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'kite_sessions' 
    AND policyname = 'Users can view their own kite sessions'
  ) THEN
    CREATE POLICY "Users can view their own kite sessions"
    ON kite_sessions FOR SELECT
    USING (auth.uid() = user_id);
  END IF;
END $$;

-- Grant access to authenticated users for the view
GRANT SELECT ON kite_sessions_status TO authenticated;