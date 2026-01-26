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
    const url = new URL(req.url)
    const requestToken = url.searchParams.get('request_token')
    const stateParam = url.searchParams.get('state')
    const appUrl = Deno.env.get('APP_URL') || 'https://portfo-blend.lovable.app'
    
    // Parse state to extract user_id for secure OAuth flow
    let userId: string | null = null
    if (stateParam) {
      try {
        const decoded = atob(stateParam)
        console.log('[kite-callback] Decoded state:', decoded)
        const stateData = JSON.parse(decoded)
        userId = stateData.user_id || null
        
        // Validate state timestamp (reject if older than 10 minutes)
        const stateAge = Date.now() - (stateData.timestamp || 0)
        if (stateAge > 10 * 60 * 1000) {
          console.warn('[kite-callback] OAuth state expired, age:', stateAge)
          // Don't reject - just log, we'll try to use it anyway for UX
        }
        console.log('[kite-callback] Extracted user_id from state:', userId)
      } catch (e) {
        console.error('[kite-callback] Failed to parse OAuth state:', e, 'stateParam:', stateParam)
      }
    } else {
      console.log('[kite-callback] No state parameter in URL')
    }
    
    // For GET requests with request_token, process the token exchange directly
    // This avoids the HTML rendering issue with Supabase Edge Functions
    if (req.method === 'GET' && requestToken) {
      console.log('[kite-callback] GET request with token, processing exchange directly')
      
      const apiKey = Deno.env.get('KITE_API_KEY')
      const apiSecret = Deno.env.get('KITE_API_SECRET')
      
      if (!apiKey || !apiSecret) {
        console.error('[kite-callback] Kite API credentials not configured')
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            Location: `${appUrl}?kite_error=${encodeURIComponent('Kite API credentials not configured')}`,
          },
        })
      }

      try {
        // Create checksum: SHA256(api_key + request_token + api_secret)
        const checksumInput = apiKey + requestToken + apiSecret
        const encoder = new TextEncoder()
        const data = encoder.encode(checksumInput)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const checksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

        // Exchange request_token for access_token
        const tokenResponse = await fetch('https://api.kite.trade/session/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-Kite-Version': '3',
          },
          body: new URLSearchParams({
            api_key: apiKey,
            request_token: requestToken,
            checksum: checksum,
          }),
        })

        if (!tokenResponse.ok) {
          const errorText = await tokenResponse.text()
          console.error('[kite-callback] Kite token exchange failed:', errorText)
          return new Response(null, {
            status: 302,
            headers: {
              ...corsHeaders,
              Location: `${appUrl}?kite_error=${encodeURIComponent('Token exchange failed')}`,
            },
          })
        }

        const tokenData = await tokenResponse.json()
        const accessToken = tokenData.data?.access_token

        if (!accessToken) {
          console.error('[kite-callback] No access token in response')
          return new Response(null, {
            status: 302,
            headers: {
              ...corsHeaders,
              Location: `${appUrl}?kite_error=${encodeURIComponent('No access token received')}`,
            },
          })
        }

        // Store the session in database
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const supabase = createClient(supabaseUrl, supabaseKey)

        // Token expires at end of day (3:30 AM next day IST typically)
        const expiresAt = new Date()
        expiresAt.setHours(expiresAt.getHours() + 8) // Conservative 8 hour expiry

        // Delete old sessions for this user and insert new one
        if (userId) {
          const { error: deleteError } = await supabase.from('kite_sessions').delete().eq('user_id', userId)
          if (deleteError) {
            console.error('[kite-callback] Delete user sessions error:', deleteError)
          }
        }
        
        // Also clean up orphan sessions older than 1 hour
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
        await supabase.from('kite_sessions')
          .delete()
          .is('user_id', null)
          .lt('created_at', oneHourAgo)
        
        const sessionData = {
          access_token: accessToken,
          expires_at: expiresAt.toISOString(),
          user_id: userId,
        }
        
        console.log('[kite-callback] Inserting session with user_id:', userId)
        
        const { error: insertError } = await supabase.from('kite_sessions').insert(sessionData)

        if (insertError) {
          console.error('[kite-callback] Failed to store session:', insertError)
          return new Response(null, {
            status: 302,
            headers: {
              ...corsHeaders,
              Location: `${appUrl}?kite_error=${encodeURIComponent('Failed to store session')}`,
            },
          })
        }
        
        console.log('[kite-callback] Kite session stored successfully', { userId: userId || 'orphan' })

        // Log the successful connection
        await supabase.from('sync_logs').insert({
          source: 'Zerodha',
          status: 'connected',
          user_id: userId || null,
          holdings_count: 0,
        })

        // Trigger immediate sync of holdings (only if we have a user_id)
        if (userId) {
          try {
            const syncResponse = await fetch(`${supabaseUrl}/functions/v1/zerodha-sync`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${supabaseKey}`,
                'Content-Type': 'application/json',
              },
            })
            if (syncResponse.ok) {
              const syncResult = await syncResponse.json()
              console.log('[kite-callback] Holdings sync triggered successfully:', syncResult)
            } else {
              const syncError = await syncResponse.text()
              console.error('[kite-callback] Holdings sync trigger failed:', syncError)
            }
          } catch (syncError) {
            console.error('[kite-callback] Failed to trigger holdings sync:', syncError)
          }
        }

        // Redirect to app with success
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            Location: `${appUrl}?kite_connected=true`,
          },
        })
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error('[kite-callback] Error during token exchange:', errorMessage)
        return new Response(null, {
          status: 302,
          headers: {
            ...corsHeaders,
            Location: `${appUrl}?kite_error=${encodeURIComponent(errorMessage)}`,
          },
        })
      }
    }

    // For GET requests without request_token, redirect to app with error
    if (req.method === 'GET') {
      return new Response(null, {
        status: 302,
        headers: {
          ...corsHeaders,
          Location: `${appUrl}?kite_error=${encodeURIComponent('No request token provided')}`,
        },
      })
    }

    // POST requests are no longer used - all OAuth callbacks are handled via GET redirect
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[kite-callback] Error:', errorMessage)

    const appUrl = Deno.env.get('APP_URL') || 'https://portfo-blend.lovable.app'

    // Redirect with error
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: `${appUrl}?kite_error=${encodeURIComponent(errorMessage)}`,
      },
    })
  }
})
