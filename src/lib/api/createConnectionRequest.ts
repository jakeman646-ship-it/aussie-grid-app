import { supabase } from '@/lib/supabase'

export interface CreateConnectionRequestParams {
  householdId: string
  siteId: string
  email: string          // This is the value from the form
  notes?: string
}

export async function createConnectionRequest(params: CreateConnectionRequestParams) {
  const { data, error } = await supabase
    .from('pilot_connection_requests')
    .insert({
      household_id: params.householdId,
      site_id: params.siteId,
      account_email: params.email,   // ← Fixed: was "email", now "account_email"
      notes: params.notes || null,
      status: 'pending_review',
    })
    .select()
    .single()

  if (error) {
    console.error('Supabase error creating connection request:', error)
    throw new Error(error.message || 'Failed to submit connection request')
  }

  return data
}