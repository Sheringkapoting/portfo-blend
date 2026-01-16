const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { query, holdings } = await req.json()
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured')
    }

    const systemPrompt = `You are a smart search assistant for an investment portfolio. Given a natural language query and portfolio holdings data, determine which holdings match the user's intent.

AVAILABLE QUERY TYPES:
- Performance queries: "losing positions", "profitable stocks", "best performers", "worst performers"
- Allocation queries: "highest allocation", "largest positions", "smallest holdings"
- Sector queries: "tech stocks", "banking sector", "pharma companies"
- Type queries: "all ETFs", "mutual funds", "SGB holdings"
- Source queries: "Zerodha holdings", "INDMoney stocks"
- Value queries: "stocks above 1 lakh", "positions under 10000"
- Percentage queries: "stocks up more than 20%", "losing more than 10%"

Return a JSON object with:
{
  "matchedSymbols": ["SYMBOL1", "SYMBOL2"],
  "filterDescription": "Human readable description of what was filtered",
  "sortBy": "pnlPercent" | "currentValue" | "investedValue" | "name" | null,
  "sortOrder": "asc" | "desc"
}

Only return symbols that exist in the provided holdings data.`

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Query: "${query}"\n\nHoldings:\n${JSON.stringify(holdings, null, 2)}` },
        ],
        response_format: { type: 'json_object' },
      }),
    })

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add funds to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const errorText = await response.text()
      console.error('AI gateway error:', response.status, errorText)
      throw new Error('AI gateway error')
    }

    const data = await response.json()
    const searchResult = data.choices?.[0]?.message?.content

    let result
    try {
      result = JSON.parse(searchResult)
    } catch {
      console.error('Failed to parse search result:', searchResult)
      throw new Error('Failed to parse search result')
    }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Smart search error:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
