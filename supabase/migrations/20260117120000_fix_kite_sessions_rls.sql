-- 1. Drop the insecure existing policies
DROP POLICY IF EXISTS "Authenticated users can view kite session status" ON public.kite_sessions;
DROP POLICY IF EXISTS "Public can view kite session status" ON public.kite_sessions;

-- 2. Create a new secure policy for SELECT
-- This policy allows a user to select ONLY their own session record.
CREATE POLICY "Users can view their own kite session"
ON public.kite_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. Create a new secure policy for UPDATE
-- This policy allows a user to update ONLY their own session record.
CREATE POLICY "Users can update their own kite session"
ON public.kite_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 4. Enable RLS on the table if it's not already
ALTER TABLE public.kite_sessions ENABLE ROW LEVEL SECURITY;
