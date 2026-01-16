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
    const apiKey = Deno.env.get('KITE_API_KEY')

    // Get the most recent session (regardless of user_id since sessions can be null)
    const { data: session, error: sessionError } = await supabase
      .from('kite_sessions')
      .select('id, access_token, user_id')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    
    if (sessionError) {
      console.error('Error fetching session:', sessionError)
      throw new Error('Failed to fetch session')
    }
    
    if (!session) {
      console.log('No active session to disconnect')
      return new Response(
        JSON.stringify({ success: true, message: 'No active session to disconnect' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Disconnecting Kite session:', { 
      sessionId: session.id,
      hasAccessToken: !!session.access_token, 
      hasApiKey: !!apiKey,
      userId: session.user_id
    })

    // Try to invalidate the token on Kite's side (best effort)
    if (session.access_token && apiKey) {
      try {
        const deleteResponse = await fetch('https://api.kite.trade/session/token', {
          method: 'DELETE',
          headers: {
            'X-Kite-Version': '3',
            'Authorization': `token ${apiKey}:${session.access_token}`,
          },
        })
        console.log('Kite session invalidation response:', deleteResponse.status)
      } catch (kiteError) {
        // Log but don't fail - we'll still delete locally
        console.error('Failed to invalidate Kite token:', kiteError)
      }
    }

    // Delete this specific session
    const { error: deleteError } = await supabase
      .from('kite_sessions')
      .delete()
      .eq('id', session.id)
    
    if (deleteError) {
      console.error('Failed to delete session:', deleteError)
      throw new Error('Failed to delete session from database')
    }

    // Log the disconnection
    await supabase.from('sync_logs').insert({
      source: 'Zerodha',
      status: 'disconnected',
      user_id: session.user_id,
      holdings_count: 0,
    })

    console.log('Kite session disconnected successfully')

    return new Response(
      JSON.stringify({ success: true, message: 'Zerodha session disconnected' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Kite disconnect error:', errorMessage)
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
