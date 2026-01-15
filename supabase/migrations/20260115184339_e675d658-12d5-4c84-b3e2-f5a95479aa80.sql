-- Add XIRR column to holdings table for storing actual XIRR from Excel data
ALTER TABLE public.holdings ADD COLUMN IF NOT EXISTS xirr numeric DEFAULT NULL;

-- Create exchange_rates table for caching currency conversion rates
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate NUMERIC NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  source TEXT DEFAULT 'external_api',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(from_currency, to_currency)
);

-- Enable RLS on exchange_rates
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

-- Everyone can read exchange rates (they're not user-specific)
CREATE POLICY "Exchange rates are publicly readable"
ON public.exchange_rates
FOR SELECT
USING (true);

-- Only service role can insert/update exchange rates (via edge function)
CREATE POLICY "Service role can manage exchange rates"
ON public.exchange_rates
FOR ALL
USING (auth.role() = 'service_role');

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_exchange_rates_currencies ON public.exchange_rates(from_currency, to_currency);
CREATE INDEX IF NOT EXISTS idx_holdings_xirr ON public.holdings(xirr) WHERE xirr IS NOT NULL;