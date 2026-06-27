import { supabase } from '@/lib/supabase'

export interface CreateConnectionRequestParams {
  householdId: string
  inverterSerial: string
  siteId: string
  apiKey: string
  inverterModel?: string
  notes?: string
}

export async function createConnectionRequest(params: CreateConnectionRequestParams) {
  const { data, error } = await supabase
    .from('pilot_connection_requests')
    .insert({
      household_id: params.householdId,
      inverter_serial: params.inverterSerial,
      site_id: params.siteId,
      api_key: params.apiKey,
      inverter_model: params.inverterModel || null,
      notes: params.notes || null,
      status: 'pending_review',
      requested_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    console.error('Supabase error creating connection request:', error)
    throw new Error(error.message || 'Failed to submit connection request')
  }

  return data
}
