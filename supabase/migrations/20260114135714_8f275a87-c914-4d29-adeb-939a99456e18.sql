-- Create table to track individual source contributions to each snapshot
CREATE TABLE public.snapshot_source_details (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id UUID REFERENCES public.portfolio_snapshots(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  asset_type TEXT,
  total_investment NUMERIC DEFAULT 0,
  current_value NUMERIC DEFAULT 0,
  total_pnl NUMERIC DEFAULT 0,
  holdings_count INTEGER DEFAULT 0,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_snapshot_source_details_snapshot_id ON public.snapshot_source_details(snapshot_id);
CREATE INDEX idx_snapshot_source_details_source ON public.snapshot_source_details(source);

-- Enable RLS
ALTER TABLE public.snapshot_source_details ENABLE ROW LEVEL SECURITY;

-- Public read access (matches portfolio_snapshots policy)
CREATE POLICY "Allow public read access to snapshot source details"
ON public.snapshot_source_details
FOR SELECT
USING (true);

-- Public insert/update for edge functions
CREATE POLICY "Allow public insert to snapshot source details"
ON public.snapshot_source_details
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public update to snapshot source details"
ON public.snapshot_source_details
FOR UPDATE
USING (true);

CREATE POLICY "Allow public delete to snapshot source details"
ON public.snapshot_source_details
FOR DELETE
USING (true);