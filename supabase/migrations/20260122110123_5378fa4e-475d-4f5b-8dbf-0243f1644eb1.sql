-- Drop and recreate the view with security_invoker = true
DROP VIEW IF EXISTS public.kite_sessions_status;

CREATE VIEW public.kite_sessions_status
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
FROM public.kite_sessions;

-- Grant access to authenticated users to view the status
GRANT SELECT ON public.kite_sessions_status TO authenticated;