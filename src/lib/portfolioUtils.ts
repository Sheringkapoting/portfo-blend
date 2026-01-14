import { 
  Holding, 
  EnrichedHolding, 
  PortfolioSummary, 
  SectorAllocation, 
  TypeAllocation, 
  SourceAllocation,
  Recommendation 
} from '@/types/portfolio';

export function enrichHolding(holding: Holding): EnrichedHolding {
  const investedValue = holding.quantity * holding.avgPrice;
  const currentValue = holding.quantity * holding.ltp;
  const pnl = currentValue - investedValue;
  const pnlPercent = investedValue > 0 ? (pnl / investedValue) * 100 : 0;
  
  const recommendation = getRecommendation(pnlPercent, holding.sector);

  return {
    ...holding,
    investedValue,
    currentValue,
    pnl,
    pnlPercent,
    recommendation
  };
}

function getRecommendation(pnlPercent: number, sector: string): Recommendation {
  // Simple recommendation logic based on P&L% and sector
  if (pnlPercent >= 50) {
    return 'TRIM / PROFIT';
  } else if (pnlPercent >= 25) {
    return 'RIDE TREND';
  } else if (pnlPercent >= 5) {
    return 'HOLD';
  } else if (pnlPercent >= -10) {
    return 'ACCUMULATE';
  } else {
    return 'REVIEW';
  }
}

export function calculatePortfolioSummary(holdings: EnrichedHolding[]): PortfolioSummary {
  const totalInvestment = holdings.reduce((sum, h) => sum + h.investedValue, 0);
  const currentValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);
  const totalPnl = currentValue - totalInvestment;
  const pnlPercent = totalInvestment > 0 ? (totalPnl / totalInvestment) * 100 : 0;

  return {
    totalInvestment,
    currentValue,
    totalPnl,
    pnlPercent,
    holdingsCount: holdings.length
  };
}

export function calculateSectorAllocation(holdings: EnrichedHolding[]): SectorAllocation[] {
  const sectorMap = new Map<string, number>();
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  holdings.forEach(h => {
    const current = sectorMap.get(h.sector) || 0;
    sectorMap.set(h.sector, current + h.currentValue);
  });

  return Array.from(sectorMap.entries())
    .map(([sector, value]) => ({
      sector: sector as any,
      value,
      percent: (value / totalValue) * 100
    }))
    .sort((a, b) => b.value - a.value);
}

export function calculateTypeAllocation(holdings: EnrichedHolding[]): TypeAllocation[] {
  const typeMap = new Map<string, number>();
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  holdings.forEach(h => {
    const current = typeMap.get(h.type) || 0;
    typeMap.set(h.type, current + h.currentValue);
  });

  return Array.from(typeMap.entries())
    .map(([type, value]) => ({
      type: type as any,
      value,
      percent: (value / totalValue) * 100
    }))
    .sort((a, b) => b.value - a.value);
}

export function calculateSourceAllocation(holdings: EnrichedHolding[]): SourceAllocation[] {
  const sourceMap = new Map<string, number>();
  const totalValue = holdings.reduce((sum, h) => sum + h.currentValue, 0);

  holdings.forEach(h => {
    const current = sourceMap.get(h.source) || 0;
    sourceMap.set(h.source, current + h.currentValue);
  });

  return Array.from(sourceMap.entries())
    .map(([source, value]) => ({
      source: source as any,
      value,
      percent: (value / totalValue) * 100
    }))
    .sort((a, b) => b.value - a.value);
}

export function formatCurrency(value: number, compact?: boolean): string {
  if (compact && Math.abs(value) >= 100000) {
    const lakhs = value / 100000;
    return `₹${lakhs.toFixed(2)}L`;
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

export function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  }).format(value);
}
