import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { authenticateUser } from '../_shared/auth.ts'

async function disconnectKiteSession(supabase: SupabaseClient, userId: string) {
  const { data: session, error: sessionError } = await supabase
    .from('kite_sessions')
    .select('id, access_token')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (sessionError && sessionError.code !== 'PGRST116') { // Ignore 'not found' error
    console.error(`[${userId}] Error fetching session:`, sessionError)
    throw new Error('Failed to fetch session')
  }

  if (!session) {
    console.log(`[${userId}] No active session to disconnect`)
    return { success: true, message: 'No active session to disconnect' }
  }

  console.log(`[${userId}] Disconnecting Kite session:`, { sessionId: session.id })

  const apiKey = Deno.env.get('KITE_API_KEY')
  if (session.access_token && apiKey) {
    try {
      await fetch('https://api.kite.trade/session/token', {
        method: 'DELETE',
        headers: {
          'X-Kite-Version': '3',
          'Authorization': `token ${apiKey}:${session.access_token}`,
        },
      })
    } catch (kiteError) {
      console.error(`[${userId}] Failed to invalidate Kite token:`, kiteError)
    }
  }

  const { error: deleteError } = await supabase
    .from('kite_sessions')
    .delete()
    .eq('id', session.id)

  if (deleteError) {
    console.error(`[${userId}] Failed to delete session:`, deleteError)
    throw new Error('Failed to delete session from database')
  }

  await supabase.from('sync_logs').insert({
    source: 'Zerodha',
    status: 'disconnected',
    user_id: userId,
    holdings_count: 0,
  })

  console.log(`[${userId}] Kite session disconnected successfully`)
  return { success: true, message: 'Zerodha session disconnected' }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { user, error: authError } = await authenticateUser(supabase)
    if (authError) throw authError

    const result = await disconnectKiteSession(supabase, user.id)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const status = error instanceof Error && 'status' in error ? (error as { status: number }).status : 500
    console.error('Kite disconnect error:', errorMessage)
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: status || 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
