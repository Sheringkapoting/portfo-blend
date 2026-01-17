import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { authenticateUser } from '../_shared/auth.ts'
import { guessAssetType, enrichHoldings } from '../_shared/holdings.ts'

interface SyncParams {
  userId: string
  isBackground: boolean
}

async function getKiteSession(supabase: SupabaseClient, userId: string) {
  const { data: session, error } = await supabase
    .from('kite_sessions')
    .select('id, access_token, expires_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error(`[${userId}] Error fetching session:`, error)
    throw new Error('Failed to fetch Kite session')
  }

  if (!session || new Date(session.expires_at) <= new Date()) {
    throw new Error('No valid Kite session. Please connect your Zerodha account.')
  }

  return session
}

async function syncZerodhaHoldings(supabase: SupabaseClient, { userId, isBackground }: SyncParams) {
  const session = await getKiteSession(supabase, userId)
  const apiKey = Deno.env.get('KITE_API_KEY')
  if (!apiKey) throw new Error('Kite API key not configured')

  const holdingsResponse = await fetch('https://api.kite.trade/portfolio/holdings', {
    headers: {
      'X-Kite-Version': '3',
      'Authorization': `token ${apiKey}:${session.access_token}`,
    },
  })

  if (!holdingsResponse.ok) {
    const errorText = await holdingsResponse.text()
    if (holdingsResponse.status === 403 || holdingsResponse.status === 401) {
      throw new Error('Session expired. Please reconnect your Zerodha account.')
    }
    console.error(`[${userId}] Kite API error:`, errorText)
    throw new Error('Failed to fetch holdings from Zerodha.')
  }

  const { data: kiteHoldings = [] } = await holdingsResponse.json()

  const holdings = kiteHoldings.map((h: any) => ({
    symbol: h.tradingsymbol,
    name: h.tradingsymbol,
    type: guessAssetType(h.tradingsymbol, h.exchange),
    sector: 'Unknown',
    quantity: h.quantity,
    avg_price: h.average_price,
    ltp: h.last_price,
    exchange: h.exchange,
    source: 'Zerodha',
    isin: h.isin,
    user_id: userId,
  }))

  const enrichedHoldings = await enrichHoldings(supabase, holdings)

  await supabase.from('holdings').delete().eq('source', 'Zerodha').eq('user_id', userId)

  if (enrichedHoldings.length > 0) {
    const { error: insertError } = await supabase.from('holdings').insert(enrichedHoldings)
    if (insertError) {
      console.error(`[${userId}] Error inserting holdings:`, insertError)
      throw new Error('Failed to save holdings')
    }
  }

  await supabase.from('sync_logs').insert({
    source: 'Zerodha',
    status: 'success',
    holdings_count: enrichedHoldings.length,
    user_id: userId,
    is_background_sync: isBackground,
  })

  return {
    success: true,
    holdings_count: enrichedHoldings.length,
    message: `Synced ${enrichedHoldings.length} holdings from Zerodha`,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  let userId: string | undefined
  const isBackground = new URL(req.url).searchParams.get('is_background') === 'true'

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { user, error: authError } = await authenticateUser(supabase)
    if (authError) throw authError
    userId = user.id

    const result = await syncZerodhaHoldings(supabase, { userId, isBackground })

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[${userId || 'unknown'}] Zerodha sync error:`, errorMessage)

    try {
      const serviceSupabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      await serviceSupabase.from('sync_logs').insert({
        source: 'Zerodha',
        status: 'error',
        error_message: errorMessage,
        user_id: userId,
        is_background_sync: isBackground,
      })
    } catch (logError) {
      console.error(`[${userId || 'unknown'}] Failed to log error:`, logError)
    }

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})