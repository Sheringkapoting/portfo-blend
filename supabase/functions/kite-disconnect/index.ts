import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { validateAuth, unauthorizedResponse, corsHeaders } from '../_shared/auth.ts'

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

    // Get the user's current session to invalidate on Kite side
    let accessToken: string | null = null
    
    if (authResult.userId) {
      const { data: session } = await supabase
        .from('kite_sessions')
        .select('access_token')
        .eq('user_id', authResult.userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      accessToken = session?.access_token || null
    }

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

    // Delete the session from our database
    if (authResult.userId) {
      const { error: deleteError } = await supabase
        .from('kite_sessions')
        .delete()
        .eq('user_id', authResult.userId)
      
      if (deleteError) {
        console.error('Failed to delete session:', deleteError)
        throw new Error('Failed to delete session')
      }
    }

    // Log the disconnection
    await supabase.from('sync_logs').insert({
      source: 'Zerodha',
      status: 'disconnected',
      user_id: authResult.userId || null,
      holdings_count: 0,
    })

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
