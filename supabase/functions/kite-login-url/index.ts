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
    // Validate JWT authentication
    const authHeader = req.headers.get('authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })
    
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }), 
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    const apiKey = Deno.env.get('KITE_API_KEY')
    
    if (!apiKey) {
      console.error('KITE_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Kite API key not configured. Please add KITE_API_KEY to project secrets.' }), 
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Create state parameter with user_id and app_url for secure OAuth flow
    // This allows kite-callback to associate the session with the correct user and environment
    const requestOrigin = req.headers.get('origin') || req.headers.get('referer') || 'http://localhost:8080'
    const appUrl = requestOrigin.includes('localhost') ? 'http://localhost:8080' : 'https://portfo-blend.lovable.app'
    
    const stateData = {
      user_id: user.id,
      app_url: appUrl,
      nonce: crypto.randomUUID(),
      timestamp: Date.now()
    }
    const state = btoa(JSON.stringify(stateData))
    
    const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${apiKey}&state=${encodeURIComponent(state)}`
    
    return new Response(
      JSON.stringify({ loginUrl }), 
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error generating login URL:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to generate login URL' }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
