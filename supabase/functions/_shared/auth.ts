/**
 * Shared authentication helper for edge functions
 * Validates JWT tokens and extracts user information
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export interface AuthResult {
  isValid: boolean
  userId?: string
  error?: string
  isCronCall?: boolean
}

/**
 * Validates the authorization header and returns user info
 * Supports both JWT tokens and cron secret for scheduled jobs
 */
export async function validateAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('authorization')
  const cronSecret = Deno.env.get('CRON_SECRET')
  const providedCronSecret = req.headers.get('x-cron-secret')
  
  // Check for cron secret (for scheduled jobs)
  if (cronSecret && providedCronSecret === cronSecret) {
    return { isValid: true, isCronCall: true }
  }
  
  // Check for authorization header
  if (!authHeader) {
    return { isValid: false, error: 'Missing authorization header' }
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    return { isValid: false, error: 'Invalid authorization format' }
  }
  
  const token = authHeader.replace('Bearer ', '')
  
  if (!token) {
    return { isValid: false, error: 'Missing token' }
  }
  
  // Check if this is a service role key call (internal edge function calls)
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (supabaseServiceKey && token === supabaseServiceKey) {
    return { isValid: true, isCronCall: true } // Treat service role as internal call
  }
  
  // Validate JWT using Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  })
  
  try {
    // Use getUser to validate the token and get user info
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return { isValid: false, error: 'Invalid or expired token' }
    }
    
    return { isValid: true, userId: user.id }
  } catch (err) {
    return { isValid: false, error: 'Token validation failed' }
  }
}

/**
 * Helper to create unauthorized response
 */
export function unauthorizedResponse(message: string): Response {
  return new Response(
    JSON.stringify({ error: `Unauthorized: ${message}` }),
    { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
