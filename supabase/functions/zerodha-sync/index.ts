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

    // For internal/service calls (from kite-callback), get userId from request body
    let effectiveUserId = authResult.userId
    if (authResult.isCronCall && !effectiveUserId) {
      try {
        const body = await req.clone().json()
        if (body?.user_id) {
          effectiveUserId = body.user_id
          console.log('Using user_id from request body for internal call:', effectiveUserId)
        }
      } catch {
        // No body or invalid JSON, continue without userId
      }
    }

    // Try to get access token from stored session
    // Only get user-specific session - no cross-user fallback for security
    let accessToken = ''
    let finalSession = null
    
    // Get user-specific session only
    if (effectiveUserId) {
      const { data: userSession } = await supabase
        .from('kite_sessions')
        .select('*')
        .eq('user_id', effectiveUserId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (userSession && new Date(userSession.expires_at) > new Date()) {
        finalSession = userSession
      }
    }
    
    // Check for orphan sessions (user_id is null) only during OAuth callback recovery
    // This allows the first sync after OAuth to claim the session
    if (!finalSession && effectiveUserId) {
      const { data: orphanSession } = await supabase
        .from('kite_sessions')
        .select('*')
        .is('user_id', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (orphanSession) {
        // Claim this orphan session for the current user
        const { error: updateError } = await supabase
          .from('kite_sessions')
          .update({ user_id: effectiveUserId })
          .eq('id', orphanSession.id)
          .is('user_id', null) // Extra safety: only update if still null
        
        if (!updateError) {
          finalSession = { ...orphanSession, user_id: effectiveUserId }
          console.log('Claimed orphan session for user:', effectiveUserId)
        } else {
          console.error('Failed to claim orphan session:', updateError)
        }
      }
    }

    if (finalSession) {
      accessToken = finalSession.access_token
      console.log('Using session:', finalSession.id, 'expires:', finalSession.expires_at)
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
      
      // Handle specific Kite API errors with user-friendly messages
      if (holdingsResponse.status === 403) {
        throw new Error('Session expired. Please reconnect your Zerodha account.')
      }
      if (holdingsResponse.status === 401) {
        throw new Error('Authentication failed. Please reconnect your Zerodha account.')
      }
      if (holdingsResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a few minutes.')
      }
      
      console.error('Kite API error response:', errorText)
      throw new Error(`Failed to fetch holdings. Please try again.`)
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
      user_id: effectiveUserId || null,
    }))

    // Delete existing Zerodha holdings for this user and insert new ones
    // Build delete query properly - need to await properly with correct chaining
    if (effectiveUserId) {
      // Delete only this user's Zerodha holdings
      const { error: deleteError } = await supabase
        .from('holdings')
        .delete()
        .eq('source', 'Zerodha')
        .eq('user_id', effectiveUserId)
      
      if (deleteError) {
        console.error('Delete error:', deleteError)
      }
    } else {
      // Fallback: delete Zerodha holdings with null user_id
      const { error: deleteError } = await supabase
        .from('holdings')
        .delete()
        .eq('source', 'Zerodha')
        .is('user_id', null)
      
      if (deleteError) {
        console.error('Delete error:', deleteError)
      }
    }
    
    if (holdings.length > 0) {
      const { error: insertError } = await supabase.from('holdings').insert(holdings)
      if (insertError) throw insertError
    }

    // Log the sync
    await supabase.from('sync_logs').insert({
      source: 'Zerodha',
      status: 'success',
      holdings_count: holdings.length,
      user_id: effectiveUserId || null,
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
