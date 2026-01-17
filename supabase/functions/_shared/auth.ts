import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
