export interface MFCASSync {
  id: string;
  user_id: string;
  pan: string;
  phone?: string;
  email?: string;
  otp_method?: 'phone' | 'email';
  otp_reference?: string;
  sync_status: 'pending_otp' | 'otp_sent' | 'verified' | 'syncing' | 'completed' | 'failed';
  time_period?: string;
  updated_till?: string;
  nickname?: string;
  error_message?: string;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MFFolio {
  id: string;
  user_id: string;
  pan: string;
  folio_number: string;
  amc_name: string;
  amc_code?: string;
  scheme_name: string;
  scheme_code?: string;
  isin?: string;
  advisor?: string;
  registrar?: string;
  created_at: string;
  updated_at: string;
}

export interface MFTransaction {
  id: string;
  user_id: string;
  folio_id: string;
  pan: string;
  folio_number: string;
  scheme_name: string;
  scheme_code?: string;
  isin?: string;
  amc_name: string;
  transaction_date: string;
  transaction_type: string;
  amount?: number;
  units?: number;
  nav?: number;
  balance_units?: number;
  description?: string;
  dividend_rate?: number;
  created_at: string;
  updated_at: string;
}

export interface MFScheme {
  id: string;
  scheme_code: string;
  scheme_name: string;
  isin?: string;
  amc_name: string;
  amc_code?: string;
  category?: string;
  sub_category?: string;
  scheme_type?: string;
  current_nav?: number;
  nav_date?: string;
  expense_ratio?: number;
  aum?: number;
  min_investment?: number;
  min_sip_investment?: number;
  exit_load?: string;
  lock_in_period?: string;
  created_at: string;
  updated_at: string;
}

export interface MFHoldingSummary {
  id: string;
  user_id: string;
  folio_id: string;
  pan: string;
  folio_number: string;
  scheme_name: string;
  scheme_code?: string;
  isin?: string;
  amc_name: string;
  total_units: number;
  current_nav?: number;
  current_value?: number;
  invested_value?: number;
  total_purchase_units?: number;
  total_redemption_units?: number;
  total_dividend_amount?: number;
  avg_nav?: number;
  xirr?: number;
  absolute_return?: number;
  absolute_return_percent?: number;
  first_investment_date?: string;
  last_transaction_date?: string;
  created_at: string;
  updated_at: string;
}

export interface MFAllocationByAMC {
  amc_name: string;
  value: number;
  percent: number;
  schemes_count: number;
}

export interface MFAllocationByCategory {
  category: string;
  value: number;
  percent: number;
  schemes_count: number;
}

export interface MFPortfolioSummary {
  total_invested: number;
  current_value: number;
  total_returns: number;
  returns_percent: number;
  total_schemes: number;
  total_folios: number;
  total_dividend_received: number;
  avg_xirr?: number;
}

export interface MFSIPDetails {
  scheme_name: string;
  folio_number: string;
  sip_amount: number;
  sip_date: number;
  sip_frequency: 'monthly' | 'quarterly';
  total_installments: number;
  active: boolean;
}
