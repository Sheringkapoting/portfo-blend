import { SupabaseClient, createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Re-export corsHeaders for backward compatibility
export { corsHeaders } from './cors.ts'

export interface AuthResult {
  isValid: boolean
  userId?: string
  isCronCall: boolean
  error?: string
}

export async function validateAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization')
  
  if (!authHeader) {
    return { isValid: false, isCronCall: false, error: 'No authorization header' }
  }
  
  // Check for cron secret (for scheduled jobs)
  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    return { isValid: true, isCronCall: true }
  }
  
  // Check for service role key (for internal calls)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (serviceRoleKey && authHeader === `Bearer ${serviceRoleKey}`) {
    return { isValid: true, isCronCall: true }
  }
  
  // Validate JWT token
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  })
  
  const { data: { user }, error } = await supabase.auth.getUser()
  
  if (error || !user) {
    return { isValid: false, isCronCall: false, error: error?.message || 'Invalid token' }
  }
  
  return { isValid: true, userId: user.id, isCronCall: false }
}

export function unauthorizedResponse(message: string): Response {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }
  
  return new Response(
    JSON.stringify({ success: false, error: message }),
    { 
      status: 401, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  )
}

export async function authenticateUser(supabase: SupabaseClient) {
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error) {
    return { user: null, error: { message: 'Authentication failed: ' + error.message, status: 401 } }
  }
  if (!user) {
    return { user: null, error: { message: 'Authentication failed: No user found', status: 401 } }
  }

  return { user, error: null }
}
