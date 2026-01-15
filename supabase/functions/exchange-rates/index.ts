import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/auth.ts'

// Free exchange rate API (no API key required, updated daily)
const EXCHANGE_RATE_API = 'https://api.exchangerate-api.com/v4/latest/USD'

interface ExchangeRateResponse {
  base: string
  date: string
  rates: Record<string, number>
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const url = new URL(req.url)
    const forceRefresh = url.searchParams.get('refresh') === 'true'
    const fromCurrency = url.searchParams.get('from') || 'USD'
    const toCurrency = url.searchParams.get('to') || 'INR'

    // Check for cached rate (valid for 1 hour)
    if (!forceRefresh) {
      const { data: cachedRate } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('from_currency', fromCurrency)
        .eq('to_currency', toCurrency)
        .single()

      if (cachedRate) {
        const fetchedAt = new Date(cachedRate.fetched_at)
        const now = new Date()
        const hoursDiff = (now.getTime() - fetchedAt.getTime()) / (1000 * 60 * 60)

        // Return cached rate if less than 1 hour old
        if (hoursDiff < 1) {
          console.log(`Returning cached ${fromCurrency}/${toCurrency} rate: ${cachedRate.rate}`)
          return new Response(
            JSON.stringify({
              success: true,
              rate: cachedRate.rate,
              from_currency: fromCurrency,
              to_currency: toCurrency,
              fetched_at: cachedRate.fetched_at,
              source: 'cache',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Fetch fresh rate from API
    console.log(`Fetching fresh exchange rate for ${fromCurrency}/${toCurrency}`)
    
    const apiUrl = fromCurrency === 'USD' 
      ? EXCHANGE_RATE_API 
      : `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`
    
    const response = await fetch(apiUrl)
    
    if (!response.ok) {
      throw new Error(`Exchange rate API returned ${response.status}`)
    }

    const data: ExchangeRateResponse = await response.json()
    
    if (!data.rates || !data.rates[toCurrency]) {
      throw new Error(`Rate for ${toCurrency} not found in API response`)
    }

    const rate = data.rates[toCurrency]
    const now = new Date().toISOString()

    // Upsert the rate in database
    const { error: upsertError } = await supabase
      .from('exchange_rates')
      .upsert({
        from_currency: fromCurrency,
        to_currency: toCurrency,
        rate: rate,
        fetched_at: now,
        source: 'exchangerate-api.com',
      }, {
        onConflict: 'from_currency,to_currency',
      })

    if (upsertError) {
      console.error('Failed to cache exchange rate:', upsertError)
      // Continue anyway - we can return the fetched rate
    }

    console.log(`Fetched and cached ${fromCurrency}/${toCurrency} rate: ${rate}`)

    return new Response(
      JSON.stringify({
        success: true,
        rate: rate,
        from_currency: fromCurrency,
        to_currency: toCurrency,
        fetched_at: now,
        source: 'api',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Exchange rate error:', error)
    
    // Try to return a fallback cached rate
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      const supabase = createClient(supabaseUrl, supabaseKey)
      
      const { data: fallbackRate } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('from_currency', 'USD')
        .eq('to_currency', 'INR')
        .single()
      
      if (fallbackRate) {
        return new Response(
          JSON.stringify({
            success: true,
            rate: fallbackRate.rate,
            from_currency: 'USD',
            to_currency: 'INR',
            fetched_at: fallbackRate.fetched_at,
            source: 'cache_fallback',
            warning: 'Using cached rate due to API error',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } catch (fallbackError) {
      console.error('Fallback cache lookup failed:', fallbackError)
    }

    // Return hardcoded fallback as last resort
    return new Response(
      JSON.stringify({
        success: true,
        rate: 83.5, // Reasonable fallback
        from_currency: 'USD',
        to_currency: 'INR',
        fetched_at: new Date().toISOString(),
        source: 'fallback',
        warning: 'Using fallback rate due to API error',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
