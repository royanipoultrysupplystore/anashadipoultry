import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'

// A Saraf (money exchanger) holds money between client and meel.
// IN  = payments.amount for payments where saraf_id = this saraf
//        (money clients sent to the Saraf on account of bills)
// OUT = supplier_payments.amount for rows where saraf_id = this saraf
//        (money the Saraf released to a meel on account of bills)
// Balance = IN - OUT. Zero at equilibrium; positive means the Saraf is still
// holding money that hasn't been paid out yet.
export function useSarafs() {
  const [sarafs, setSarafs] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [sarafsRes, inRes, outRes] = await Promise.all([
      supabase.from('sarafs').select('*').order('created_at', { ascending: false }),
      supabase.from('payments').select('saraf_id, amount').not('saraf_id', 'is', null),
      supabase.from('supplier_payments').select('saraf_id, amount, amount_usd').not('saraf_id', 'is', null),
    ])
    if (sarafsRes.error) { toast.error(sarafsRes.error.message); setLoading(false); return }
    const inBy = {}, outBy = {}
    for (const p of inRes.data || []) inBy[p.saraf_id] = (inBy[p.saraf_id] || 0) + (parseFloat(p.amount) || 0)
    for (const p of outRes.data || []) outBy[p.saraf_id] = (outBy[p.saraf_id] || 0) + (parseFloat(p.amount) || 0) // AFN side only for now
    setSarafs((sarafsRes.data || []).map(s => {
      const inAmt = inBy[s.id] || 0
      const outAmt = outBy[s.id] || 0
      // Opening: holding adds, over-paid (money the Saraf fronted) subtracts.
      const openNet = (parseFloat(s.opening_holding) || 0) - (parseFloat(s.opening_overpaid) || 0)
      return { ...s, total_in: inAmt, total_out: outAmt, balance: openNet + inAmt - outAmt }
    }))
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function addSaraf(data) {
    const { error } = await supabase.from('sarafs').insert([{
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      location: data.location?.trim() || null,
      notes: data.notes?.trim() || null,
      opening_holding: Math.max(0, parseFloat(data.opening_holding) || 0),
      opening_overpaid: Math.max(0, parseFloat(data.opening_overpaid) || 0),
      is_active: true,
    }])
    if (error) { toast.error(error.message); return false }
    toast.success('Saraf added')
    await load()
    return true
  }

  async function updateSaraf(id, data) {
    const { error } = await supabase.from('sarafs').update({
      name: data.name?.trim(),
      phone: data.phone?.trim() || null,
      location: data.location?.trim() || null,
      notes: data.notes?.trim() || null,
      opening_holding: Math.max(0, parseFloat(data.opening_holding) || 0),
      opening_overpaid: Math.max(0, parseFloat(data.opening_overpaid) || 0),
      is_active: data.is_active,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Saraf updated')
    await load()
    return true
  }

  async function deleteSaraf(id) {
    const { error } = await supabase.from('sarafs').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success('Saraf deleted')
    await load()
    return true
  }

  return { sarafs, loading, addSaraf, updateSaraf, deleteSaraf, refetch: load }
}

// Single Saraf with full transaction lists (in from clients, out to suppliers).
export function useSarafDetail(sarafId) {
  const [saraf, setSaraf] = useState(null)
  const [inbound, setInbound] = useState([])   // [{ payment row + farms join }]
  const [outbound, setOutbound] = useState([]) // [{ supplier_payment row + suppliers join }]
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!sarafId) return
    setLoading(true)
    const [sRes, inRes, outRes] = await Promise.all([
      supabase.from('sarafs').select('*').eq('id', sarafId).single(),
      supabase.from('payments').select('*, farms(name, name_fa, name_ps), supplier_dispatches(bill_number, suppliers(company_name))').eq('saraf_id', sarafId).order('payment_date', { ascending: false }),
      supabase.from('supplier_payments').select('*, suppliers(company_name), supplier_dispatches(bill_number), farms(name, name_fa, name_ps, kind)').eq('saraf_id', sarafId).order('payment_date', { ascending: false }),
    ])
    if (sRes.error) { toast.error(sRes.error.message); setLoading(false); return }
    setSaraf(sRes.data)
    setInbound(inRes.data || [])
    setOutbound(outRes.data || [])
    setLoading(false)
  }, [sarafId])

  useEffect(() => { load() }, [load])

  // Record money received from a client → Saraf, optionally tied to a specific
  // bill via supplier_dispatch_id. Reduces the client/farm debt the same way a
  // normal payment does.
  async function recordIn(data) {
    const amount = parseFloat(data.amount) || 0
    if (amount <= 0) { toast.error('Amount must be > 0'); return false }
    if (!data.farm_id) { toast.error('Pick a farm / client'); return false }
    if (!data.hawala_number || !String(data.hawala_number).trim()) { toast.error('Transaction / hawala number is required'); return false }
    const { error } = await supabase.from('payments').insert([{
      farm_id: data.farm_id,
      amount,
      payment_date: data.payment_date,
      notes: data.notes?.trim() || null,
      saraf_id: sarafId,
      supplier_dispatch_id: data.supplier_dispatch_id || null,
      hawala_number: String(data.hawala_number).trim(),
    }])
    if (error) { toast.error(error.message); return false }
    const { data: f } = await supabase.from('farms').select('total_debt').eq('id', data.farm_id).single()
    if (f) await supabase.from('farms').update({ total_debt: Math.max(0, (f.total_debt || 0) - amount) }).eq('id', data.farm_id)
    toast.success('Payment recorded')
    await load()
    return true
  }

  // Record money the Saraf released to a meel supplier, optionally tied to a
  // specific bill.
  async function recordOut(data) {
    const amount = parseFloat(data.amount) || 0
    if (amount <= 0) { toast.error('Amount must be > 0'); return false }
    if (!data.supplier_id) { toast.error('Pick a supplier'); return false }
    const { error } = await supabase.from('supplier_payments').insert([{
      supplier_id: data.supplier_id,
      amount,
      amount_usd: 0,
      payment_date: data.payment_date,
      notes: data.notes?.trim() || null,
      saraf_id: sarafId,
      supplier_dispatch_id: data.supplier_dispatch_id || null,
      farm_id: data.farm_id || null,
      hawala_number: data.hawala_number?.trim() || null,
    }])
    if (error) { toast.error(error.message); return false }
    toast.success('Payment recorded')
    await load()
    return true
  }

  async function deleteIn(payment) {
    const { error } = await supabase.from('payments').delete().eq('id', payment.id)
    if (error) { toast.error(error.message); return false }
    if (payment.farm_id) {
      const { data: f } = await supabase.from('farms').select('total_debt').eq('id', payment.farm_id).single()
      if (f) await supabase.from('farms').update({ total_debt: (f.total_debt || 0) + (parseFloat(payment.amount) || 0) }).eq('id', payment.farm_id)
    }
    await load()
    return true
  }

  async function deleteOut(payment) {
    const { error } = await supabase.from('supplier_payments').delete().eq('id', payment.id)
    if (error) { toast.error(error.message); return false }
    await load()
    return true
  }

  const openingHolding = parseFloat(saraf?.opening_holding) || 0
  const openingOverpaid = parseFloat(saraf?.opening_overpaid) || 0
  const totalIn = inbound.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  const totalOut = outbound.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0)
  // Currently holding = opening holding − opening over-paid + IN − OUT.
  const balance = openingHolding - openingOverpaid + totalIn - totalOut

  return {
    saraf, inbound, outbound, loading,
    totalIn, totalOut, balance, openingHolding, openingOverpaid,
    recordIn, recordOut, deleteIn, deleteOut, refetch: load,
  }
}
