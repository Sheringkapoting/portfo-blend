-- SECURITY FIX: Remove dangerous public RLS policies that expose access tokens
-- These policies allow anyone to read all Kite access tokens

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can view kite session status" ON kite_sessions;
DROP POLICY IF EXISTS "Public can view kite session status" ON kite_sessions;

-- The existing user-scoped policy remains:
-- "Users can view own kite session status" with USING (auth.uid() = user_id)
-- "Service role full access on kite_sessions" for backend operations