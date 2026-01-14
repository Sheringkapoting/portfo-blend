import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import * as XLSX from 'https://esm.sh/xlsx@0.18.5'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ParsedHolding {
  symbol: string
  name: string
  type: string
  sector: string
  quantity: number
  avg_price: number
  ltp: number
  exchange: string
  source: string
  isin?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      throw new Error('No file uploaded')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Read the Excel file
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    
    // Find the Holdings report sheet
    const sheetName = workbook.SheetNames.find(name => 
      name.toLowerCase().includes('holding')
    ) || workbook.SheetNames[0]
    
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
    
    // Parse the data - INDMoney format typically has headers in first row
    const headers = jsonData[0] as string[]
    const rows = jsonData.slice(1) as any[][]
    
    // Find column indices (flexible matching)
    const findCol = (patterns: string[]) => 
      headers.findIndex(h => 
        patterns.some(p => h?.toString().toLowerCase().includes(p.toLowerCase()))
      )
    
    const nameCol = findCol(['name', 'stock', 'fund', 'scheme'])
    const symbolCol = findCol(['symbol', 'ticker', 'code'])
    const qtyCol = findCol(['qty', 'quantity', 'units', 'holdings'])
    const avgPriceCol = findCol(['avg', 'average', 'buy price', 'cost'])
    const ltpCol = findCol(['ltp', 'current', 'market', 'nav', 'price'])
    const isinCol = findCol(['isin'])
    const typeCol = findCol(['type', 'asset', 'category'])

    const holdings: ParsedHolding[] = []

    for (const row of rows) {
      if (!row || row.length === 0) continue
      
      const name = row[nameCol]?.toString() || ''
      if (!name) continue
      
      const symbol = row[symbolCol]?.toString() || name.split(' ')[0].toUpperCase()
      const quantity = parseFloat(row[qtyCol]) || 0
      const avgPrice = parseFloat(row[avgPriceCol]) || 0
      const ltp = parseFloat(row[ltpCol]) || avgPrice
      const isin = row[isinCol]?.toString() || undefined
      const typeHint = row[typeCol]?.toString() || ''
      
      if (quantity <= 0) continue

      const assetType = guessAssetType(name, symbol, isin, typeHint)
      const sector = guessSector(name, symbol)
      const exchange = guessExchange(assetType, isin)

      holdings.push({
        symbol,
        name,
        type: assetType,
        sector,
        quantity,
        avg_price: avgPrice,
        ltp,
        exchange,
        source: 'INDMoney',
        isin,
      })
    }

    // Delete existing INDMoney holdings and insert new ones
    await supabase.from('holdings').delete().eq('source', 'INDMoney')
    
    if (holdings.length > 0) {
      const { error: insertError } = await supabase.from('holdings').insert(holdings)
      if (insertError) throw insertError
    }

    // Log the sync
    await supabase.from('sync_logs').insert({
      source: 'INDMoney',
      status: 'success',
      holdings_count: holdings.length,
    })

    return new Response(
      JSON.stringify({ 
        success: true, 
        holdings_count: holdings.length,
        message: `Imported ${holdings.length} holdings from INDMoney Excel`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('INDMoney parse error:', errorMessage)
    
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)
      await supabase.from('sync_logs').insert({
        source: 'INDMoney',
        status: 'error',
        error_message: errorMessage,
      })
    } catch {}

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

function guessAssetType(name: string, symbol: string, isin?: string, typeHint?: string): string {
  const combined = `${name} ${symbol} ${typeHint}`.toLowerCase()
  
  if (isin?.startsWith('US')) return 'US Stock'
  if (combined.includes('mutual') || combined.includes('fund') || combined.includes('growth') || combined.includes('direct')) return 'Mutual Fund'
  if (combined.includes('etf') || combined.includes('bees')) return 'ETF'
  if (combined.includes('sgb') || combined.includes('sovereign gold')) return 'SGB'
  if (combined.includes('reit')) return 'REIT'
  if (combined.includes('bond')) return 'Bond'
  
  return 'Equity'
}

function guessSector(name: string, symbol: string): string {
  const combined = `${name} ${symbol}`.toLowerCase()
  
  if (combined.includes('tech') || combined.includes('it') || combined.includes('software') || combined.includes('infosys') || combined.includes('tcs')) return 'IT'
  if (combined.includes('bank') || combined.includes('hdfc') || combined.includes('icici') || combined.includes('axis')) return 'Banking'
  if (combined.includes('pharma') || combined.includes('health') || combined.includes('medical')) return 'Pharma'
  if (combined.includes('auto') || combined.includes('motor') || combined.includes('tesla')) return 'Auto'
  if (combined.includes('power') || combined.includes('energy')) return 'Power'
  if (combined.includes('telecom') || combined.includes('airtel') || combined.includes('jio')) return 'Telecom'
  if (combined.includes('metal') || combined.includes('steel') || combined.includes('mining')) return 'Metals'
  if (combined.includes('fmcg') || combined.includes('consumer')) return 'FMCG'
  if (combined.includes('real') || combined.includes('reit') || combined.includes('embassy')) return 'Real Estate'
  if (combined.includes('gold') || combined.includes('silver') || combined.includes('commodity')) return 'Commodity'
  if (combined.includes('nifty') || combined.includes('index') || combined.includes('sensex')) return 'Index'
  if (combined.includes('diversified') || combined.includes('flexi')) return 'Diversified'
  
  return 'Other'
}

function guessExchange(assetType: string, isin?: string): string {
  if (isin?.startsWith('US')) return 'NASDAQ'
  if (assetType === 'Mutual Fund') return 'MF'
  return 'NSE'
}
