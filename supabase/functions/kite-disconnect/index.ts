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

    // Get user from JWT if available
    const authHeader = req.headers.get('Authorization')
    let userId: string | null = null
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      userId = user?.id || null
    }

    // Get the user's current session to invalidate on Kite side
    let accessToken: string | null = null
    
    // Query for sessions - if userId is available, filter by it
    let query = supabase
      .from('kite_sessions')
      .select('id, access_token, user_id')
      .order('created_at', { ascending: false })
      .limit(1)
    
    if (userId) {
      query = query.eq('user_id', userId)
    }
    
    const { data: session, error: sessionError } = await query.single()
    
    if (sessionError && sessionError.code !== 'PGRST116') {
      console.error('Error fetching session:', sessionError)
    }
    
    if (session) {
      accessToken = session.access_token
      userId = session.user_id || userId // Use session's user_id if available
    }

    console.log('Disconnecting Kite session:', { 
      hasAccessToken: !!accessToken, 
      hasApiKey: !!apiKey,
      userId 
    })

    // Try to invalidate the token on Kite's side (best effort)
    if (accessToken && apiKey) {
      try {
        const deleteResponse = await fetch('https://api.kite.trade/session/token', {
          method: 'DELETE',
          headers: {
            'X-Kite-Version': '3',
            'Authorization': `token ${apiKey}:${accessToken}`,
          },
        })
        console.log('Kite session invalidation response:', deleteResponse.status)
      } catch (kiteError) {
        // Log but don't fail - we'll still delete locally
        console.error('Failed to invalidate Kite token:', kiteError)
      }
    }

    // Delete all sessions (or just for this user if userId is available)
    let deleteQuery = supabase.from('kite_sessions').delete()
    
    if (userId) {
      deleteQuery = deleteQuery.eq('user_id', userId)
    } else if (session?.id) {
      // Delete the specific session we found
      deleteQuery = deleteQuery.eq('id', session.id)
    } else {
      // No session found to delete
      return new Response(
        JSON.stringify({ success: true, message: 'No active session to disconnect' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const { error: deleteError } = await deleteQuery
    
    if (deleteError) {
      console.error('Failed to delete session:', deleteError)
      throw new Error('Failed to delete session from database')
    }

    // Log the disconnection
    await supabase.from('sync_logs').insert({
      source: 'Zerodha',
      status: 'disconnected',
      user_id: userId,
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
