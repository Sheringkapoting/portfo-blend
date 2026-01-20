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
    
    // SECURITY: Parse and validate state to extract user_id
    let userId: string | null = null
    let stateError: string | null = null
    
    if (stateParam) {
      try {
        const stateData = JSON.parse(atob(stateParam))
        userId = stateData.user_id || null
        
        // Validate state timestamp (reject if older than 10 minutes)
        const stateAge = Date.now() - (stateData.timestamp || 0)
        if (stateAge > 10 * 60 * 1000) {
          console.warn('OAuth state expired')
          stateError = 'OAuth session expired. Please try again.'
          userId = null
        }
      } catch (e) {
        console.error('Failed to parse OAuth state:', e)
        stateError = 'Invalid OAuth state. Please try again.'
      }
    } else {
      stateError = 'Missing OAuth state. Please login first.'
    }
    
    // SECURITY: Require valid user_id from state
    if (!userId) {
      const errorMessage = stateError || 'Authentication required. Please login first.'
      console.error('OAuth callback without valid user_id:', errorMessage)
      
      // For GET requests (initial page load), show error page
      if (req.method === 'GET' || !requestToken) {
        return new Response(`
<!DOCTYPE html>
<html>
<head>
  <title>Authentication Error</title>
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
    .container { text-align: center; max-width: 400px; padding: 20px; }
    .error { color: #ef4444; margin-bottom: 20px; }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background: #f97316;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
    }
    .button:hover { background: #ea580c; }
  </style>
</head>
<body>
  <div class="container">
    <p class="error">${errorMessage}</p>
    <p style="color: #888; margin-bottom: 20px;">Please go back to the app and try connecting again.</p>
    <a href="${appUrl}" class="button">Return to App</a>
  </div>
</body>
</html>
        `, {
          headers: { ...corsHeaders, 'Content-Type': 'text/html' }
        })
      }
      
      // For POST requests, return JSON error
      return new Response(JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    
    if (!requestToken) {
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
      const link = document.createElement('a');
      link.href = '${appUrl}';
      link.textContent = 'Return to App';
      link.style.cssText = 'display:inline-block;margin-top:20px;padding:12px 24px;background:#f97316;color:white;text-decoration:none;border-radius:8px;';
      container.appendChild(link);
    }
    
    function showMessage(message) {
      const container = document.querySelector('.container');
      const p = container.querySelector('p');
      if (p) p.textContent = message;
    }
    
    const params = new URLSearchParams(window.location.search);
    const requestToken = params.get('request_token');
    
    // Try to get state from URL first, then from sessionStorage as fallback
    let stateParam = params.get('state');
    if (!stateParam) {
      stateParam = sessionStorage.getItem('kite_oauth_state');
      console.log('[Callback] Retrieved state from sessionStorage:', stateParam ? 'found' : 'not found');
    }
    
    // Clear sessionStorage state after retrieval
    sessionStorage.removeItem('kite_oauth_state');
    
    if (!stateParam) {
      showError('Missing authentication state. Please return to the app and try connecting again.');
    } else if (requestToken) {
      showMessage('Verifying with Zerodha...');
      
      let postUrl = window.location.origin + window.location.pathname + '?request_token=' + encodeURIComponent(requestToken);
      postUrl += '&state=' + encodeURIComponent(stateParam);
      
      fetch(postUrl, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          showMessage('Connected! Redirecting...');
          window.location.href = '${appUrl}?kite_connected=true';
        } else {
          showError(data.error || 'Connection failed');
        }
      })
      .catch(err => {
        showError(err.message || 'Request failed');
      });
    } else {
      showError('No request token received from Zerodha. Please try again.');
    }
  </script>
</body>
</html>
      `, {
        headers: { ...corsHeaders, 'Content-Type': 'text/html' }
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
      console.error('Kite token exchange failed:', errorText)
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

    // Delete old sessions for this user
    await supabase.from('kite_sessions').delete().eq('user_id', userId)
    
    // SECURITY: Always set user_id - we validated it exists above
    const sessionData = {
      access_token: accessToken,
      expires_at: expiresAt.toISOString(),
      user_id: userId,
    }
    
    const { error: insertError } = await supabase.from('kite_sessions').insert(sessionData)

    if (insertError) {
      console.error('Failed to store session:', insertError)
      throw new Error('Failed to store session')
    }
    
    console.log('Kite session stored successfully for user:', userId)

    // Log the successful connection
    await supabase.from('sync_logs').insert({
      source: 'Zerodha',
      status: 'connected',
      user_id: userId,
      holdings_count: 0,
    })

    // Trigger immediate sync of holdings with user context
    try {
      // Get user's auth token to pass to sync function
      const syncResponse = await fetch(`${supabaseUrl}/functions/v1/zerodha-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      })
      if (syncResponse.ok) {
        console.log('Holdings sync triggered successfully after OAuth')
      } else {
        console.error('Holdings sync trigger failed:', await syncResponse.text())
      }
    } catch (syncError) {
      console.error('Failed to trigger holdings sync:', syncError)
    }

    // For POST requests (from the HTML page's fetch), return JSON success
    if (req.method === 'POST') {
      return new Response(JSON.stringify({ success: true }), {
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
    console.error('Kite callback error:', errorMessage)

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
