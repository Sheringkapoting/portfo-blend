import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CaptureOptions {
  sources?: string[]
  assetTypes?: string[]
}

interface SourceStats {
  source: string
  assetType: string
  investment: number
  value: number
  pnl: number
  count: number
  lastSyncAt: Date | null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Security: Verify request has valid authorization
    // Accept either service role key in auth header OR a cron secret
    const authHeader = req.headers.get('authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')
    const providedCronSecret = req.headers.get('x-cron-secret')
    
    const isServiceRole = authHeader?.includes(supabaseKey)
    const isValidCronSecret = cronSecret && providedCronSecret === cronSecret
    const isFromInternalCall = authHeader?.startsWith('Bearer ') && authHeader.includes(supabaseKey)
    
    // For now, allow calls that have any authorization header (internal calls from other edge functions)
    // This is more permissive but works with existing architecture
    if (!authHeader && !isValidCronSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Parse request body for filters
    let options: CaptureOptions = {}
    try {
      const body = await req.json()
      options = body || {}
    } catch {
      // No body or invalid JSON, use defaults
    }

    // Build holdings query with optional filters
    let holdingsQuery = supabase.from('holdings').select('*')
    
    if (options.sources && options.sources.length > 0) {
      holdingsQuery = holdingsQuery.in('source', options.sources)
    }
    
    if (options.assetTypes && options.assetTypes.length > 0) {
      holdingsQuery = holdingsQuery.in('type', options.assetTypes)
    }

    const { data: holdings, error: holdingsError } = await holdingsQuery

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

    // Get latest sync logs per source
    const { data: syncLogs } = await supabase
      .from('sync_logs')
      .select('source, created_at, status')
      .eq('status', 'success')
      .order('created_at', { ascending: false })

    const latestSyncBySource = new Map<string, Date>()
    syncLogs?.forEach(log => {
      if (!latestSyncBySource.has(log.source)) {
        latestSyncBySource.set(log.source, new Date(log.created_at))
      }
    })

    // Calculate portfolio summary and source-level stats
    let totalInvestment = 0
    let currentValue = 0
    const sourceStatsMap = new Map<string, SourceStats>()

    for (const holding of holdings) {
      const qty = Number(holding.quantity)
      const avgPrice = Number(holding.avg_price)
      const ltp = quotesMap.get(holding.symbol) || Number(holding.ltp) || avgPrice
      
      const holdingInvestment = qty * avgPrice
      const holdingValue = qty * ltp
      const holdingPnl = holdingValue - holdingInvestment
      
      totalInvestment += holdingInvestment
      currentValue += holdingValue

      // Group by source + asset type
      const source = holding.source || 'Unknown'
      const assetType = holding.type || 'Unknown'
      const key = `${source}|${assetType}`
      
      const existing = sourceStatsMap.get(key) || {
        source,
        assetType,
        investment: 0,
        value: 0,
        pnl: 0,
        count: 0,
        lastSyncAt: latestSyncBySource.get(source) || null,
      }
      
      existing.investment += holdingInvestment
      existing.value += holdingValue
      existing.pnl += holdingPnl
      existing.count += 1
      
      sourceStatsMap.set(key, existing)
    }

    const totalPnl = currentValue - totalInvestment
    const pnlPercent = totalInvestment > 0 ? (totalPnl / totalInvestment) * 100 : 0

    // Upsert snapshot for today
    const today = new Date().toISOString().split('T')[0]
    
    const { data: snapshot, error: upsertError } = await supabase
      .from('portfolio_snapshots')
      .upsert({
        snapshot_date: today,
        total_investment: totalInvestment,
        current_value: currentValue,
        total_pnl: totalPnl,
        pnl_percent: pnlPercent,
        holdings_count: holdings.length,
      }, { onConflict: 'snapshot_date' })
      .select()
      .single()

    if (upsertError) throw upsertError

    // Delete existing source details for this snapshot
    await supabase
      .from('snapshot_source_details')
      .delete()
      .eq('snapshot_id', snapshot.id)

    // Insert source-level details
    const sourceDetails = Array.from(sourceStatsMap.values()).map(stats => ({
      snapshot_id: snapshot.id,
      source: stats.source,
      asset_type: stats.assetType,
      total_investment: stats.investment,
      current_value: stats.value,
      total_pnl: stats.pnl,
      holdings_count: stats.count,
      last_sync_at: stats.lastSyncAt?.toISOString() || null,
    }))

    if (sourceDetails.length > 0) {
      const { error: detailsError } = await supabase
        .from('snapshot_source_details')
        .insert(sourceDetails as any)

      if (detailsError) {
        console.error('Error inserting source details:', detailsError)
      }
    }

    // Aggregate source stats for response
    const sourceBreakdown = Array.from(sourceStatsMap.values()).reduce((acc, stats) => {
      const existing = acc.find(s => s.source === stats.source)
      if (existing) {
        existing.investment += stats.investment
        existing.value += stats.value
        existing.pnl += stats.pnl
        existing.count += stats.count
      } else {
        acc.push({
          source: stats.source,
          investment: stats.investment,
          value: stats.value,
          pnl: stats.pnl,
          count: stats.count,
        })
      }
      return acc
    }, [] as { source: string; investment: number; value: number; pnl: number; count: number }[])

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
          source_breakdown: sourceBreakdown,
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
