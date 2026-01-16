export interface Holding {
  id: string;
  symbol: string;
  name: string;
  type: AssetType;
  sector: Sector;
  quantity: number;
  avgPrice: number;
  ltp: number;
  exchange: string;
  source: Source;
  isin?: string;
  xirr?: number;
  broker?: string;
}

export interface EnrichedHolding extends Holding {
  investedValue: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  recommendation: Recommendation;
}

export type AssetType = 
  | 'Equity' 
  | 'ETF' 
  | 'SGB' 
  | 'Commodity' 
  | 'Index' 
  | 'US Stock' 
  | 'Mutual Fund'
  | 'Bond'
  | 'REIT'
  | 'NPS'
  | 'EPF'
  | 'PPF';

export type Sector = 
  | 'IT'
  | 'Banking'
  | 'Finance'
  | 'Power'
  | 'Auto'
  | 'Pharma'
  | 'FMCG'
  | 'Metals'
  | 'Telecom'
  | 'Infra'
  | 'Energy'
  | 'Commodity'
  | 'Index'
  | 'International'
  | 'Diversified'
  | 'Real Estate'
  | 'Consumer'
  | 'Chemicals'
  | 'Other';

export type Source = string;

export type Recommendation = 
  | 'HOLD'
  | 'ACCUMULATE'
  | 'TRIM / PROFIT'
  | 'RIDE TREND'
  | 'REVIEW';

export interface PortfolioSummary {
  totalInvestment: number;
  currentValue: number;
  totalPnl: number;
  pnlPercent: number;
  holdingsCount: number;
}

export interface SectorAllocation {
  sector: Sector;
  value: number;
  percent: number;
}

export interface TypeAllocation {
  type: AssetType;
  value: number;
  percent: number;
}

export interface SourceAllocation {
  source: Source;
  value: number;
  percent: number;
}
