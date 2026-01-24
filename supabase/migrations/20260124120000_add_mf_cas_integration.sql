-- Migration: Add Mutual Fund CAS Integration Tables
-- This enables PAN-based MF portfolio tracking via MFCentral CAS API

-- Table to track CAS sync requests and OTP verification
CREATE TABLE public.mf_cas_sync (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pan TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  otp_method TEXT CHECK (otp_method IN ('phone', 'email')),
  otp_reference TEXT,
  sync_status TEXT NOT NULL CHECK (sync_status IN ('pending_otp', 'otp_sent', 'verified', 'syncing', 'completed', 'failed')),
  time_period TEXT,
  updated_till DATE,
  nickname TEXT,
  error_message TEXT,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to store folio information
CREATE TABLE public.mf_folios (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pan TEXT NOT NULL,
  folio_number TEXT NOT NULL,
  amc_name TEXT NOT NULL,
  amc_code TEXT,
  scheme_name TEXT NOT NULL,
  scheme_code TEXT,
  isin TEXT,
  advisor TEXT,
  registrar TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, folio_number, scheme_code)
);

-- Table to store all MF transactions
CREATE TABLE public.mf_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  folio_id UUID REFERENCES public.mf_folios(id) ON DELETE CASCADE,
  pan TEXT NOT NULL,
  folio_number TEXT NOT NULL,
  scheme_name TEXT NOT NULL,
  scheme_code TEXT,
  isin TEXT,
  amc_name TEXT NOT NULL,
  transaction_date DATE NOT NULL,
  transaction_type TEXT NOT NULL,
  amount NUMERIC(15, 2),
  units NUMERIC(15, 4),
  nav NUMERIC(10, 4),
  balance_units NUMERIC(15, 4),
  description TEXT,
  dividend_rate NUMERIC(10, 4),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to store scheme master data
CREATE TABLE public.mf_schemes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scheme_code TEXT UNIQUE NOT NULL,
  scheme_name TEXT NOT NULL,
  isin TEXT,
  amc_name TEXT NOT NULL,
  amc_code TEXT,
  category TEXT,
  sub_category TEXT,
  scheme_type TEXT,
  current_nav NUMERIC(10, 4),
  nav_date DATE,
  expense_ratio NUMERIC(5, 4),
  aum NUMERIC(15, 2),
  min_investment NUMERIC(10, 2),
  min_sip_investment NUMERIC(10, 2),
  exit_load TEXT,
  lock_in_period TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to store aggregated current holdings per scheme
CREATE TABLE public.mf_holdings_summary (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  folio_id UUID REFERENCES public.mf_folios(id) ON DELETE CASCADE,
  pan TEXT NOT NULL,
  folio_number TEXT NOT NULL,
  scheme_name TEXT NOT NULL,
  scheme_code TEXT,
  isin TEXT,
  amc_name TEXT NOT NULL,
  total_units NUMERIC(15, 4) NOT NULL,
  current_nav NUMERIC(10, 4),
  current_value NUMERIC(15, 2),
  invested_value NUMERIC(15, 2),
  total_purchase_units NUMERIC(15, 4),
  total_redemption_units NUMERIC(15, 4),
  total_dividend_amount NUMERIC(15, 2),
  avg_nav NUMERIC(10, 4),
  xirr NUMERIC(8, 4),
  absolute_return NUMERIC(15, 2),
  absolute_return_percent NUMERIC(8, 4),
  first_investment_date DATE,
  last_transaction_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, folio_number, scheme_code)
);

-- Enable RLS on all tables
ALTER TABLE public.mf_cas_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mf_folios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mf_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mf_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mf_holdings_summary ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user-specific data access
CREATE POLICY "Users can view their own CAS sync records" 
  ON public.mf_cas_sync FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own CAS sync records" 
  ON public.mf_cas_sync FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own CAS sync records" 
  ON public.mf_cas_sync FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own folios" 
  ON public.mf_folios FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own folios" 
  ON public.mf_folios FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own folios" 
  ON public.mf_folios FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own transactions" 
  ON public.mf_transactions FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions" 
  ON public.mf_transactions FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions" 
  ON public.mf_transactions FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view scheme master data" 
  ON public.mf_schemes FOR SELECT 
  USING (true);

CREATE POLICY "Service role can manage scheme data" 
  ON public.mf_schemes FOR ALL 
  USING (auth.role() = 'service_role');

CREATE POLICY "Users can view their own holdings summary" 
  ON public.mf_holdings_summary FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own holdings summary" 
  ON public.mf_holdings_summary FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own holdings summary" 
  ON public.mf_holdings_summary FOR UPDATE 
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX idx_mf_cas_sync_user_id ON public.mf_cas_sync(user_id);
CREATE INDEX idx_mf_cas_sync_pan ON public.mf_cas_sync(pan);
CREATE INDEX idx_mf_folios_user_id ON public.mf_folios(user_id);
CREATE INDEX idx_mf_folios_pan ON public.mf_folios(pan);
CREATE INDEX idx_mf_folios_folio_number ON public.mf_folios(folio_number);
CREATE INDEX idx_mf_transactions_user_id ON public.mf_transactions(user_id);
CREATE INDEX idx_mf_transactions_folio_id ON public.mf_transactions(folio_id);
CREATE INDEX idx_mf_transactions_pan ON public.mf_transactions(pan);
CREATE INDEX idx_mf_transactions_date ON public.mf_transactions(transaction_date);
CREATE INDEX idx_mf_schemes_code ON public.mf_schemes(scheme_code);
CREATE INDEX idx_mf_schemes_isin ON public.mf_schemes(isin);
CREATE INDEX idx_mf_holdings_summary_user_id ON public.mf_holdings_summary(user_id);
CREATE INDEX idx_mf_holdings_summary_pan ON public.mf_holdings_summary(pan);

-- Create updated_at triggers
CREATE TRIGGER update_mf_cas_sync_updated_at
  BEFORE UPDATE ON public.mf_cas_sync
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mf_folios_updated_at
  BEFORE UPDATE ON public.mf_folios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mf_transactions_updated_at
  BEFORE UPDATE ON public.mf_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mf_schemes_updated_at
  BEFORE UPDATE ON public.mf_schemes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mf_holdings_summary_updated_at
  BEFORE UPDATE ON public.mf_holdings_summary
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
