import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

async function triggerSync(supabaseUrl: string, supabaseKey: string, userId: string) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/zerodha-sync`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`, // Use service key for background job
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_background: true, user_id: userId }), // Pass user_id
    })
    return response.ok
  } catch (e) {
    console.error(`[${userId}] Sync trigger failed:`, e)
    return false
  }
}

async function triggerSnapshot(supabaseUrl: string, supabaseKey: string, userId: string) {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/capture-snapshot`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`, // Use service key for background job
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id: userId }), // Pass user_id
    })
    const data = await response.json()
    return { success: response.ok, data, error: data.error }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error(`[${userId}] Snapshot trigger failed:`, err)
    return { success: false, error: errorMessage }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data: activeSessions, error: sessionError } = await supabase
      .from('kite_sessions')
      .select('user_id')
      .not('user_id', 'is', null)
      .gt('expires_at', new Date().toISOString())

    if (sessionError) {
      throw new Error(`Failed to get active sessions: ${sessionError.message}`)
    }

    const uniqueUserIds = [...new Set(activeSessions?.map(s => s.user_id).filter(Boolean) || [])]

    if (uniqueUserIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No active user sessions found for snapshot.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Processing snapshots for ${uniqueUserIds.length} users with active sessions.`)

    const results = []
    for (const userId of uniqueUserIds) {
      const synced = await triggerSync(supabaseUrl, supabaseKey, userId)
      const snapshotResult = await triggerSnapshot(supabaseUrl, supabaseKey, userId)
      results.push({
        user_id: userId,
        synced_before_snapshot: synced,
        snapshot_success: snapshotResult.success,
        error: snapshotResult.error,
      })
    }

    const successCount = results.filter(r => r.snapshot_success).length
    const failCount = results.length - successCount

    return new Response(
      JSON.stringify({
        success: failCount === 0,
        message: `Scheduled snapshot completed: ${successCount} succeeded, ${failCount} failed.`,
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