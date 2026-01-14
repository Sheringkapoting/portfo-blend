import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Fetch all holdings
    const { data: holdings, error: holdingsError } = await supabase
      .from('holdings')
      .select('*')

    if (holdingsError) throw holdingsError

    if (!holdings || holdings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No holdings to snapshot' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get latest quotes
    const { data: quotes } = await supabase
      .from('quotes_cache')
      .select('*')

    const quotesMap = new Map(quotes?.map(q => [q.symbol, q.ltp]) || [])

    // Calculate portfolio summary
    let totalInvestment = 0
    let currentValue = 0

    for (const holding of holdings) {
      const qty = Number(holding.quantity)
      const avgPrice = Number(holding.avg_price)
      const ltp = quotesMap.get(holding.symbol) || Number(holding.ltp)
      
      totalInvestment += qty * avgPrice
      currentValue += qty * ltp
    }

    const totalPnl = currentValue - totalInvestment
    const pnlPercent = totalInvestment > 0 ? (totalPnl / totalInvestment) * 100 : 0

    // Upsert snapshot for today
    const today = new Date().toISOString().split('T')[0]
    
    const { error: upsertError } = await supabase
      .from('portfolio_snapshots')
      .upsert({
        snapshot_date: today,
        total_investment: totalInvestment,
        current_value: currentValue,
        total_pnl: totalPnl,
        pnl_percent: pnlPercent,
        holdings_count: holdings.length,
      }, { onConflict: 'snapshot_date' })

    if (upsertError) throw upsertError

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Captured snapshot for ${today}`,
        data: {
          date: today,
          total_investment: totalInvestment,
          current_value: currentValue,
          total_pnl: totalPnl,
          pnl_percent: pnlPercent,
          holdings_count: holdings.length,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Snapshot capture error:', errorMessage)
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
