import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

export function guessAssetType(symbol: string, exchange: string): string {
  const upperSymbol = symbol.toUpperCase()
  
  if (upperSymbol.includes('BEES') || upperSymbol.includes('ETF')) return 'ETF'
  if (upperSymbol.startsWith('SGB')) return 'SGB'
  if (exchange === 'MCX') return 'Commodity'
  if (upperSymbol.includes('NIFTY') || upperSymbol.includes('SENSEX')) return 'Index'
  
  return 'Equity'
}

export async function enrichHoldings(supabase: SupabaseClient, holdings: any[]) {
  // In a real application, you would enrich holdings with more data
  // For example, fetching company names, sectors, etc. from a database
  return holdings
}
