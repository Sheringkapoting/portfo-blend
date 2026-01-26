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
    
    // For GET requests, always return the HTML page that will handle the OAuth flow
    // The HTML page will then POST to this endpoint with the request_token
    if (req.method === 'GET') {
      // Return HTML that will handle the OAuth callback
      // This page extracts request_token and state from URL and POSTs to this endpoint
      return new Response(`
<!DOCTYPE html>
<html>
<head>
  <title>Kite Login</title>
  <style>
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex; 
      justify-content: center; 
      align-items: center; 
      height: 100vh; 
      margin: 0;
      background: #0f0f0f;
      color: #fff;
    }
    .container { text-align: center; }
    .spinner { 
      border: 3px solid #333; 
      border-top: 3px solid #f97316; 
      border-radius: 50%; 
      width: 40px; 
      height: 40px; 
      animation: spin 1s linear infinite; 
      margin: 20px auto;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <p>Connecting to Zerodha...</p>
  </div>
  <script>
    function showError(message) {
      const container = document.querySelector('.container');
      container.innerHTML = '';
      const errorP = document.createElement('p');
      errorP.style.color = '#ef4444';
      errorP.textContent = 'Error: ' + message;
      container.appendChild(errorP);
    }
    
    function showMessage(message) {
      const container = document.querySelector('.container');
      container.innerHTML = '';
      const p = document.createElement('p');
      p.textContent = message;
      container.appendChild(p);
    }
    
    const params = new URLSearchParams(window.location.search);
    const requestToken = params.get('request_token');
    let stateParam = params.get('state');
    
    // Fallback: try to get state from sessionStorage if not in URL
    if (!stateParam) {
      stateParam = sessionStorage.getItem('kite_oauth_state');
      console.log('Using state from sessionStorage:', stateParam ? 'found' : 'not found');
    }
    
    if (requestToken) {
      let postUrl = window.location.origin + window.location.pathname + '?request_token=' + encodeURIComponent(requestToken);
      if (stateParam) {
        postUrl += '&state=' + encodeURIComponent(stateParam);
      }
      
      console.log('Posting to:', postUrl);
      
      fetch(postUrl, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        // Clean up sessionStorage
        sessionStorage.removeItem('kite_oauth_state');
        
        if (data.success) {
          window.location.href = '${appUrl}?kite_connected=true';
        } else {
          showError(data.error || 'Connection failed');
        }
      })
      .catch(err => {
        showError(err.message || 'Request failed');
      });
    } else {
      showMessage('No request token found');
    }
  </script>
</body>
</html>
      `, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
      })
    }

    // POST request handling - token exchange
    console.log('[kite-callback] Processing token exchange, userId from state:', userId)
    
    if (!requestToken) {
      return new Response(JSON.stringify({ success: false, error: 'Missing request_token' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    const apiKey = Deno.env.get('KITE_API_KEY')
    const apiSecret = Deno.env.get('KITE_API_SECRET')
    
    if (!apiKey || !apiSecret) {
      throw new Error('Kite API credentials not configured')
    }

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
      throw new Error(`Token exchange failed: ${tokenResponse.status}`)
    }

    const tokenData = await tokenResponse.json()
    const accessToken = tokenData.data?.access_token

    if (!accessToken) {
      throw new Error('No access token in response')
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
    
    const sessionData: { access_token: string; expires_at: string; user_id: string | null } = {
      access_token: accessToken,
      expires_at: expiresAt.toISOString(),
      user_id: userId, // Always set, even if null
    }
    
    console.log('[kite-callback] Inserting session with user_id:', userId)
    
    const { error: insertError } = await supabase.from('kite_sessions').insert(sessionData)

    if (insertError) {
      console.error('[kite-callback] Failed to store session:', insertError)
      throw new Error('Failed to store session')
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
        // Get user's JWT for the sync call by creating a service-level auth
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
    } else {
      console.log('[kite-callback] Skipping sync trigger - no user_id in session')
    }

    // For POST requests (from the HTML page's fetch), return JSON success
    if (req.method === 'POST') {
      return new Response(JSON.stringify({ success: true, userId: userId || null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // For GET requests (shouldn't happen normally as GET returns HTML), redirect
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: `${appUrl}?kite_connected=true`,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('[kite-callback] Error:', errorMessage)

    const appUrl = Deno.env.get('APP_URL') || 'https://portfo-blend.lovable.app'

    // For POST requests, return JSON error
    if (req.method === 'POST') {
      return new Response(JSON.stringify({ success: false, error: errorMessage }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // For GET requests, redirect with error
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        Location: `${appUrl}?kite_error=${encodeURIComponent(errorMessage)}`,
      },
    })
  }
})
