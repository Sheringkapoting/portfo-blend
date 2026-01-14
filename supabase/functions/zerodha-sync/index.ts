import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface KiteHolding {
  tradingsymbol: string
  exchange: string
  isin: string
  quantity: number
  average_price: number
  last_price: number
  pnl: number
  t1_quantity?: number
  instrument_token?: number
}

interface KiteQuote {
  instrument_token: number
  last_price: number
  volume: number
  change: number
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Security: Verify request has authorization
    const authHeader = req.headers.get('authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const supabase = createClient(supabaseUrl, supabaseKey)

    const apiKey = Deno.env.get('KITE_API_KEY')
    
    if (!apiKey) {
      throw new Error('Kite API key not configured')
    }

    // Try to get access token from stored session first
    let accessToken = ''
    const { data: session } = await supabase
      .from('kite_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (session && new Date(session.expires_at) > new Date()) {
      accessToken = session.access_token
    } else {
      // Fall back to environment variable
      accessToken = Deno.env.get('KITE_ACCESS_TOKEN') || ''
    }
    
    if (!accessToken) {
      throw new Error('No valid Kite session. Please connect your Zerodha account.')
    }

    // Fetch holdings from Kite API
    const holdingsResponse = await fetch('https://api.kite.trade/portfolio/holdings', {
      headers: {
        'X-Kite-Version': '3',
        'Authorization': `token ${apiKey}:${accessToken}`,
      },
    })

    if (!holdingsResponse.ok) {
      const errorText = await holdingsResponse.text()
      throw new Error(`Kite API error: ${holdingsResponse.status} - ${errorText}`)
    }

    const holdingsData = await holdingsResponse.json()
    const kiteHoldings: KiteHolding[] = holdingsData.data || []

    // Map to our holdings format
    const holdings = kiteHoldings.map((h) => ({
      symbol: h.tradingsymbol,
      name: h.tradingsymbol, // Kite doesn't provide full name
      type: guessAssetType(h.tradingsymbol, h.exchange),
      sector: 'Other', // Will need enrichment
      quantity: h.quantity,
      avg_price: h.average_price,
      ltp: h.last_price,
      exchange: h.exchange,
      source: 'Zerodha',
      isin: h.isin,
    }))

    // Delete existing Zerodha holdings and insert new ones
    await supabase.from('holdings').delete().eq('source', 'Zerodha')
    
    if (holdings.length > 0) {
      const { error: insertError } = await supabase.from('holdings').insert(holdings)
      if (insertError) throw insertError
    }

    // Log the sync
    await supabase.from('sync_logs').insert({
      source: 'Zerodha',
      status: 'success',
      holdings_count: holdings.length,
    })

    // Fetch quotes for all symbols
    const symbols = kiteHoldings.map(h => `${h.exchange}:${h.tradingsymbol}`).join(',')
    
    if (symbols) {
      const quotesResponse = await fetch(`https://api.kite.trade/quote?i=${symbols}`, {
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${apiKey}:${accessToken}`,
        },
      })

      if (quotesResponse.ok) {
        const quotesData = await quotesResponse.json()
        const quotes = Object.entries(quotesData.data || {}).map(([key, value]: [string, any]) => ({
          symbol: key.split(':')[1],
          ltp: value.last_price,
          change_percent: value.net_change,
          volume: value.volume,
          source: 'Zerodha',
        }))

        // Upsert quotes
        for (const quote of quotes) {
          await supabase.from('quotes_cache')
            .upsert(quote, { onConflict: 'symbol' })
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        holdings_count: holdings.length,
        message: `Synced ${holdings.length} holdings from Zerodha`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Zerodha sync error:', errorMessage)
    
    // Try to log the error
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)
      await supabase.from('sync_logs').insert({
        source: 'Zerodha',
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

function guessAssetType(symbol: string, exchange: string): string {
  const upperSymbol = symbol.toUpperCase()
  
  if (upperSymbol.includes('BEES') || upperSymbol.includes('ETF')) return 'ETF'
  if (upperSymbol.startsWith('SGB')) return 'SGB'
  if (exchange === 'MCX') return 'Commodity'
  if (upperSymbol.includes('NIFTY') || upperSymbol.includes('SENSEX')) return 'Index'
  
  return 'Equity'
}
