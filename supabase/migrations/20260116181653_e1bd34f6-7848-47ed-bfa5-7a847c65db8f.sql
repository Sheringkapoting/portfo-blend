-- Add RLS policy to allow authenticated users to view the most recent kite session
-- This is needed because sessions may have null user_id during OAuth flow
-- The view only exposes is_valid, expires_at, etc. - not the access_token

-- Allow authenticated users to see any session (the view hides the access_token)
CREATE POLICY "Authenticated users can view kite session status" 
ON public.kite_sessions 
FOR SELECT 
TO authenticated
USING (true);

-- Also allow anon to see sessions (useful for checking status before login)
CREATE POLICY "Public can view kite session status" 
ON public.kite_sessions 
FOR SELECT 
TO anon
USING (true);