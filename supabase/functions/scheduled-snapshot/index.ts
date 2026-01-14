import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// This function can be called by:
// 1. External cron service (cron-job.org, easycron.com, etc.)
// 2. pg_cron (if enabled)
// 3. Manual trigger
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Security: Verify request is from authorized source
    // Accept service role auth header OR cron secret for external schedulers
    const authHeader = req.headers.get('authorization')
    const cronSecret = Deno.env.get('CRON_SECRET')
    const providedCronSecret = req.headers.get('x-cron-secret')
    
    const isValidCronSecret = cronSecret && providedCronSecret === cronSecret
    
    if (!authHeader && !isValidCronSecret) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if we have a valid Kite session to refresh quotes first
    const { data: session } = await supabase
      .from('kite_sessions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    let syncedHoldings = false

    if (session && new Date(session.expires_at) > new Date()) {
      // Try to sync fresh data from Zerodha first
      try {
        const syncResponse = await fetch(`${supabaseUrl}/functions/v1/zerodha-sync`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
        })
        if (syncResponse.ok) {
          console.log('Fresh holdings synced before snapshot')
          syncedHoldings = true
        }
      } catch (e) {
        console.log('Holdings sync skipped:', e)
      }
    }

    // Now capture the snapshot
    const snapshotResponse = await fetch(`${supabaseUrl}/functions/v1/capture-snapshot`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    })

    if (!snapshotResponse.ok) {
      throw new Error(`Snapshot capture failed: ${await snapshotResponse.text()}`)
    }

    const snapshotData = await snapshotResponse.json()

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Scheduled snapshot completed',
        synced_holdings: syncedHoldings,
        snapshot: snapshotData.data,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Scheduled snapshot error:', errorMessage)

    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
