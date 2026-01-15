-- Fix the SECURITY DEFINER view issue by using SECURITY INVOKER
DROP VIEW IF EXISTS kite_sessions_status;

CREATE VIEW kite_sessions_status WITH (security_invoker = true) AS
SELECT 
  id,
  user_id,
  expires_at,
  created_at,
  updated_at,
  token_type,
  (expires_at > now()) AS is_valid
FROM kite_sessions;

-- Enable RLS on the underlying table is already done
-- Create a policy for users to read their own sessions via the view
CREATE POLICY "Users can view own kite session status"
ON kite_sessions FOR SELECT
USING (auth.uid() = user_id);

-- Grant SELECT on the view to authenticated users
GRANT SELECT ON kite_sessions_status TO authenticated;