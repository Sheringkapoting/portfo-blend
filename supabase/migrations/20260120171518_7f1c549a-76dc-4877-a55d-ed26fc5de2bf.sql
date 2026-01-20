-- SECURITY FIX: Remove user SELECT policy on kite_sessions table
-- Users should ONLY access session status via the kite_sessions_status VIEW
-- which correctly excludes the access_token field

-- Drop the policy that exposes access_token to users
DROP POLICY IF EXISTS "Users can view own kite session status" ON kite_sessions;

-- Service role policy remains for edge functions to manage sessions
-- "Service role full access on kite_sessions" stays in place

-- Grant SELECT on the VIEW (not the table) to authenticated users
-- The view already exists and excludes access_token
GRANT SELECT ON kite_sessions_status TO authenticated;