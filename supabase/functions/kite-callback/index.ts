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
    
    if (!requestToken) {
      // Return HTML page that extracts token from URL and sends it
      const appUrl = Deno.env.get('APP_URL') || 'https://portfo-blend.lovable.app'
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
    const params = new URLSearchParams(window.location.search);
    const requestToken = params.get('request_token');
    if (requestToken) {
      fetch(window.location.origin + window.location.pathname + '?request_token=' + requestToken, {
        method: 'POST'
      })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          window.location.href = '${appUrl}?kite_connected=true';
        } else {
          document.querySelector('.container').innerHTML = '<p style="color: #ef4444;">Error: ' + data.error + '</p>';
        }
      })
      .catch(err => {
        document.querySelector('.container').innerHTML = '<p style="color: #ef4444;">Error: ' + err.message + '</p>';
      });
    } else {
      document.querySelector('.container').innerHTML = '<p>No request token found</p>';
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

    // Delete old sessions and insert new one
    await supabase.from('kite_sessions').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    
    const { error: insertError } = await supabase.from('kite_sessions').insert({
      access_token: accessToken,
      expires_at: expiresAt.toISOString(),
    })

    if (insertError) {
      console.error('Failed to store session:', insertError)
      throw new Error('Failed to store session')
    }

    // Log the successful connection
    await supabase.from('sync_logs').insert({
      source: 'Zerodha',
      status: 'connected',
      holdings_count: 0,
    })

    return new Response(
      JSON.stringify({ success: true, message: 'Connected to Zerodha successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Kite callback error:', errorMessage)
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
