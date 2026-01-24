-- Add broker column to holdings table
ALTER TABLE public.holdings 
ADD COLUMN IF NOT EXISTS broker TEXT;
