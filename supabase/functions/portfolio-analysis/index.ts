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
    const { portfolioData } = await req.json()
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured')
    }

    const systemPrompt = `You are an expert portfolio analyst. Analyze the provided portfolio data and generate structured insights.

ANALYSIS REQUIREMENTS:
1. Sector Concentration: Identify if any sector is overweight (>30% allocation)
2. Risk Exposure: Assess overall portfolio risk based on volatility and sector mix
3. Diversification Score: Rate diversification from 1-10
4. Top Performers: Identify holdings with best returns
5. Underperformers: Identify holdings that need attention
6. Actionable Recommendations: Provide 2-3 specific suggestions

Output must be valid JSON with this structure:
{
  "sectorConcentration": { "status": "healthy|warning|critical", "message": "string", "topSector": "string", "percentage": number },
  "riskExposure": { "level": "low|moderate|high", "message": "string" },
  "diversificationScore": { "score": number, "message": "string" },
  "topPerformers": [{ "name": "string", "symbol": "string", "returnPercent": number }],
  "underperformers": [{ "name": "string", "symbol": "string", "returnPercent": number }],
  "recommendations": [{ "type": "rebalance|accumulate|trim|diversify", "title": "string", "description": "string" }],
  "overallHealth": { "status": "excellent|good|fair|needs_attention", "summary": "string" }
}`

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
          { role: 'user', content: `Analyze this portfolio:\n${JSON.stringify(portfolioData, null, 2)}` },
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
    const analysisContent = data.choices?.[0]?.message?.content

    // Parse the JSON response
    let analysis
    try {
      analysis = JSON.parse(analysisContent)
    } catch {
      // If JSON parsing fails, return a structured error
      console.error('Failed to parse analysis:', analysisContent)
      throw new Error('Failed to parse AI analysis')
    }

    return new Response(JSON.stringify({ success: true, analysis }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Portfolio analysis error:', error)
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
