import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'
import { authenticateUser } from '../_shared/auth.ts'

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
    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), { status: authError.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const apiKey = Deno.env.get('KITE_API_KEY')
    if (!apiKey) {
      console.error('KITE_API_KEY not configured')
      return new Response(
        JSON.stringify({ error: 'Kite API key not configured. Please add KITE_API_KEY to project secrets.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const stateData = {
      user_id: user.id,
      nonce: crypto.randomUUID(),
      timestamp: Date.now(),
    }
    const state = btoa(JSON.stringify(stateData))

    const loginUrl = `https://kite.zerodha.com/connect/login?v=3&api_key=${apiKey}&state=${encodeURIComponent(state)}`

    return new Response(
      JSON.stringify({ loginUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error generating login URL:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to generate login URL' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
