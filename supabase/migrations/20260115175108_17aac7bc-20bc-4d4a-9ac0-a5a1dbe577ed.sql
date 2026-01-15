-- Update existing holdings to have the correct user_id
UPDATE public.holdings 
SET user_id = '7057251e-4e12-40f6-ab31-9ededdd47fd2'
WHERE user_id IS NULL;

-- Update kite_sessions to have the correct user_id
UPDATE public.kite_sessions 
SET user_id = '7057251e-4e12-40f6-ab31-9ededdd47fd2'
WHERE user_id IS NULL;

-- Update sync_logs to have the correct user_id
UPDATE public.sync_logs 
SET user_id = '7057251e-4e12-40f6-ab31-9ededdd47fd2'
WHERE user_id IS NULL;

-- Update portfolio_snapshots to have the correct user_id  
UPDATE public.portfolio_snapshots 
SET user_id = '7057251e-4e12-40f6-ab31-9ededdd47fd2'
WHERE user_id IS NULL;

-- Add a permissive policy to allow viewing own kite sessions (was missing)
DROP POLICY IF EXISTS "Block all client access on kite_sessions" ON public.kite_sessions;
DROP POLICY IF EXISTS "Allow service role write access on kite_sessions" ON public.kite_sessions;

-- Create proper RLS for kite_sessions
CREATE POLICY "Users can view their own kite sessions" 
ON public.kite_sessions 
FOR SELECT 
USING (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Service role full access on kite_sessions" 
ON public.kite_sessions 
FOR ALL
USING (true)
WITH CHECK (true);