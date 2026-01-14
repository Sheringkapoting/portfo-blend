-- Create holdings table to cache portfolio data
CREATE TABLE public.holdings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  symbol TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  sector TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  avg_price NUMERIC NOT NULL,
  ltp NUMERIC NOT NULL,
  exchange TEXT NOT NULL,
  source TEXT NOT NULL,
  isin TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quotes cache table for live market data
CREATE TABLE public.quotes_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  ltp NUMERIC NOT NULL,
  change_percent NUMERIC,
  volume BIGINT,
  source TEXT NOT NULL,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sync_logs table to track API sync status
CREATE TABLE public.sync_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  holdings_count INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on holdings (will be public for now since no auth)
ALTER TABLE public.holdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access (no auth required for personal tool)
CREATE POLICY "Allow public read holdings" ON public.holdings FOR SELECT USING (true);
CREATE POLICY "Allow public insert holdings" ON public.holdings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update holdings" ON public.holdings FOR UPDATE USING (true);
CREATE POLICY "Allow public delete holdings" ON public.holdings FOR DELETE USING (true);

CREATE POLICY "Allow public read quotes" ON public.quotes_cache FOR SELECT USING (true);
CREATE POLICY "Allow public insert quotes" ON public.quotes_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update quotes" ON public.quotes_cache FOR UPDATE USING (true);
CREATE POLICY "Allow public delete quotes" ON public.quotes_cache FOR DELETE USING (true);

CREATE POLICY "Allow public read sync_logs" ON public.sync_logs FOR SELECT USING (true);
CREATE POLICY "Allow public insert sync_logs" ON public.sync_logs FOR INSERT WITH CHECK (true);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for holdings and quotes
CREATE TRIGGER update_holdings_updated_at
  BEFORE UPDATE ON public.holdings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add index for faster lookups
CREATE INDEX idx_holdings_source ON public.holdings(source);
CREATE INDEX idx_holdings_symbol ON public.holdings(symbol);
CREATE INDEX idx_quotes_symbol ON public.quotes_cache(symbol);