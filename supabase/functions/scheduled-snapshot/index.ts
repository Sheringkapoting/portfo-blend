import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateAuth, unauthorizedResponse, corsHeaders } from '../_shared/auth.ts'

// This function can be called by:
// 1. External cron service (cron-job.org, easycron.com, etc.)
// 2. pg_cron (if enabled)
// 3. Manual trigger with valid authentication
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate authentication (supports JWT tokens and cron secret)
    const authResult = await validateAuth(req)
    if (!authResult.isValid) {
      return unauthorizedResponse(authResult.error || 'Authentication failed')
    }
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
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

    // Get list of all users with holdings for multi-user snapshot
    const { data: usersWithHoldings, error: usersError } = await supabase
      .from('holdings')
      .select('user_id')
      .not('user_id', 'is', null)
    
    if (usersError) {
      throw new Error(`Failed to get users with holdings: ${usersError.message}`)
    }
    
    // Get unique user IDs
    const uniqueUserIds = [...new Set(usersWithHoldings?.map(h => h.user_id).filter(Boolean) || [])]
    
    if (uniqueUserIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No users with holdings found',
          synced_holdings: syncedHoldings,
          user_count: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`Processing snapshots for ${uniqueUserIds.length} users`)
    
    // Capture snapshot for each user
    const results: Array<{ user_id: string; success: boolean; data?: unknown; error?: string }> = []
    
    for (const userId of uniqueUserIds) {
      try {
        const snapshotResponse = await fetch(`${supabaseUrl}/functions/v1/capture-snapshot`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ user_id: userId })
        })

        const snapshotData = await snapshotResponse.json()
        
        if (!snapshotResponse.ok) {
          console.error(`Snapshot failed for user ${userId}:`, snapshotData)
          results.push({ user_id: userId, success: false, error: snapshotData.error || 'Unknown error' })
        } else {
          results.push({ user_id: userId, success: true, data: snapshotData.data })
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        console.error(`Snapshot error for user ${userId}:`, errorMessage)
        results.push({ user_id: userId, success: false, error: errorMessage })
      }
    }
    
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return new Response(
      JSON.stringify({
        success: failCount === 0,
        message: `Scheduled snapshot completed: ${successCount} succeeded, ${failCount} failed`,
        synced_holdings: syncedHoldings,
        user_count: uniqueUserIds.length,
        results,
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
