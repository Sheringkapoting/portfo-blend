-- Add permissive INSERT policy for sync_logs so service role can insert with user_id
-- The current policy only allows SELECT for users

-- Drop existing policies and recreate properly
DROP POLICY IF EXISTS "Users can view their own sync logs" ON public.sync_logs;

-- Create permissive SELECT policy
CREATE POLICY "Users can view their own sync logs" 
ON public.sync_logs 
FOR SELECT 
USING (auth.uid() = user_id);

-- Allow service role to insert (for edge functions)
CREATE POLICY "Service role insert sync logs" 
ON public.sync_logs 
FOR INSERT 
WITH CHECK (true);