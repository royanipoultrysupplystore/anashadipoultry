import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'

// Per-client payment-reminder timers (see migration 017). A client account can
// schedule "remind me in N minutes/hours/days"; when the time passes the
// dashboard popup (useDueReminders) surfaces it.

// Single client's active (pending) reminder — used inside the client account.
export function useFarmReminder(farmId) {
  const [reminder, setReminder] = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!farmId) { setReminder(null); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from('client_reminders')
      .select('*')
      .eq('farm_id', farmId)
      .eq('status', 'pending')
      .order('remind_at', { ascending: true })
      .limit(1)
    setReminder(data?.[0] || null)
    setLoading(false)
  }, [farmId])

  useEffect(() => { load() }, [load])

  async function createReminder({ remind_at, note }) {
    // One active reminder per client — clear any existing pending one first.
    await supabase.from('client_reminders').update({ status: 'done' }).eq('farm_id', farmId).eq('status', 'pending')
    const { error } = await supabase.from('client_reminders').insert([{ farm_id: farmId, remind_at, note: note?.trim() || null }])
    if (error) { toast.error(error.message); return false }
    toast.success('Reminder set')
    await load()
    return true
  }

  async function cancelReminder(id) {
    const { error } = await supabase.from('client_reminders').delete().eq('id', id || reminder?.id)
    if (error) { toast.error(error.message); return false }
    toast.success('Reminder cancelled')
    await load()
    return true
  }

  return { reminder, loading, createReminder, cancelReminder, refetch: load }
}

// All reminders that have come due (pending && remind_at <= now) with their
// client joined — powers the dashboard popup.
export function useDueReminders() {
  const [due, setDue] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('client_reminders')
      .select('*, farms(name, name_fa, name_ps, phone, kind)')
      .eq('status', 'pending')
      .lte('remind_at', new Date().toISOString())
      .order('remind_at', { ascending: true })
    setDue(data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    // Re-check periodically so a reminder that comes due mid-session still fires.
    const t = setInterval(load, 60 * 1000)
    return () => clearInterval(t)
  }, [load])

  async function completeReminder(id) {
    const { error } = await supabase.from('client_reminders').update({ status: 'done' }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    await load()
    return true
  }

  return { due, loading, completeReminder, refetch: load }
}
