-- Fix SECURITY DEFINER view issue by using security_invoker = true
-- This ensures RLS policies of the querying user are applied

DROP VIEW IF EXISTS kite_sessions_status;

CREATE VIEW kite_sessions_status 
WITH (security_invoker = true)
AS
SELECT 
  id,
  user_id,
  token_type,
  created_at,
  updated_at,
  expires_at,
  CASE WHEN expires_at > now() THEN true ELSE false END as is_valid
FROM kite_sessions;