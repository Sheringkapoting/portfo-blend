-- Create portfolio_snapshots table for daily tracking
CREATE TABLE public.portfolio_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  total_investment NUMERIC NOT NULL DEFAULT 0,
  current_value NUMERIC NOT NULL DEFAULT 0,
  total_pnl NUMERIC NOT NULL DEFAULT 0,
  pnl_percent NUMERIC NOT NULL DEFAULT 0,
  holdings_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(snapshot_date)
);

-- Enable RLS
ALTER TABLE public.portfolio_snapshots ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (since this is a personal portfolio app)
CREATE POLICY "Allow public read access on portfolio_snapshots"
ON public.portfolio_snapshots
FOR SELECT
USING (true);

-- Create policy for service role insert/update
CREATE POLICY "Allow service role write access on portfolio_snapshots"
ON public.portfolio_snapshots
FOR ALL
USING (true)
WITH CHECK (true);

-- Create kite_sessions table for storing OAuth tokens
CREATE TABLE public.kite_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  access_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.kite_sessions ENABLE ROW LEVEL SECURITY;

-- Create policy for public read access (to check if connected)
CREATE POLICY "Allow public read access on kite_sessions"
ON public.kite_sessions
FOR SELECT
USING (true);

-- Create policy for service role write access
CREATE POLICY "Allow service role write access on kite_sessions"
ON public.kite_sessions
FOR ALL
USING (true)
WITH CHECK (true);

-- Create index for snapshot date queries
CREATE INDEX idx_portfolio_snapshots_date ON public.portfolio_snapshots(snapshot_date DESC);

-- Add trigger for updated_at on kite_sessions
CREATE OR REPLACE FUNCTION public.update_kite_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_kite_sessions_updated_at
BEFORE UPDATE ON public.kite_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_kite_sessions_updated_at();