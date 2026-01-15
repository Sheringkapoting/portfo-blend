import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateAuth, unauthorizedResponse, corsHeaders } from '../_shared/auth.ts'

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
    // Validate JWT authentication
    const authResult = await validateAuth(req)
    if (!authResult.isValid) {
      return unauthorizedResponse(authResult.error || 'Authentication failed')
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const apiKey = Deno.env.get('KITE_API_KEY')
    
    if (!apiKey) {
      throw new Error('Kite API key not configured')
    }

    // Try to get access token from stored session first
    let accessToken = ''
    const sessionQuery = supabase
      .from('kite_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      
    // If user is authenticated, get their session
    if (authResult.userId) {
      sessionQuery.eq('user_id', authResult.userId)
    }
    
    const { data: session } = await sessionQuery.single()

    if (session && new Date(session.expires_at) > new Date()) {
      accessToken = session.access_token
    } else {
      // Fall back to environment variable (for backward compatibility)
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

    // Map to our holdings format with user_id
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
      user_id: authResult.userId || null,
    }))

    // Delete existing Zerodha holdings for this user and insert new ones
    const deleteQuery = supabase.from('holdings').delete().eq('source', 'Zerodha')
    if (authResult.userId) {
      deleteQuery.eq('user_id', authResult.userId)
    }
    await deleteQuery
    
    if (holdings.length > 0) {
      const { error: insertError } = await supabase.from('holdings').insert(holdings)
      if (insertError) throw insertError
    }

    // Log the sync
    await supabase.from('sync_logs').insert({
      source: 'Zerodha',
      status: 'success',
      holdings_count: holdings.length,
      user_id: authResult.userId || null,
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
