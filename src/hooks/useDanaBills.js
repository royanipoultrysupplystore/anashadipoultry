import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

// Dana bills written FROM a client account. A bill is a supplier_dispatches row
// that carries a farm_id (the client). Same total both sides: it adds to the
// client's debt AND the supplier's remaining. No margin, no inventory touch —
// the shop is a broker writing a bill the client carries to the meel.
export function useDanaBills(farmId, { enabled = true } = {}) {
  const { t } = useLanguage()
  const [bills, setBills] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!farmId || !enabled) { setBills([]); setLoading(false); return }
    setLoading(true)
    const { data, error } = await supabase
      .from('supplier_dispatches')
      .select('*, suppliers(company_name, owner_name, phone)')
      .eq('farm_id', farmId)
      .order('dispatch_date', { ascending: false })
      .order('created_at', { ascending: false })
    if (error) toast.error(error.message)
    else setBills(data || [])
    setLoading(false)
  }, [farmId, enabled])

  useEffect(() => { fetch() }, [fetch])

  // Bill numbers are unique per supplier (matches the supplier-side flow).
  async function billNumberTaken(supplierId, billNumber, excludeId = null) {
    const bn = (billNumber || '').trim()
    if (!bn || !supplierId) return false
    let q = supabase.from('supplier_dispatches').select('id').eq('supplier_id', supplierId).ilike('bill_number', bn).limit(1)
    if (excludeId) q = q.neq('id', excludeId)
    const { data } = await q
    return (data?.length || 0) > 0
  }

  async function createDanaBill(data) {
    const quantity = parseFloat(data.quantity) || 0
    const price = parseFloat(data.price_per_bag) || 0
    const total = quantity * price
    if (!data.supplier_id) { toast.error(t('danaBill.supplierRequired')); return false }
    if (await billNumberTaken(data.supplier_id, data.bill_number)) {
      toast.error(`Bill # ${(data.bill_number || '').trim()} already exists for this supplier`); return false
    }
    const { data: inserted, error } = await supabase.from('supplier_dispatches').insert([{
      supplier_id: data.supplier_id,
      farm_id: farmId,
      product_name: 'Feed (Dana)',
      bill_number: (data.bill_number || '').trim() || null,
      dana_type: data.dana_type || null,
      dispatch_date: data.dispatch_date,
      quantity,
      price_per_bag: price,
      sell_price_per_bag: price, // same total both sides — no margin
      total_amount: total,
      notes: data.notes || null,
    }]).select('*, suppliers(company_name, owner_name, phone)').single()
    if (error) { toast.error(error.message); return false }
    toast.success(t('danaBill.created'))
    await fetch()
    return inserted
  }

  async function updateDanaBill(id, data) {
    const quantity = parseFloat(data.quantity) || 0
    const price = parseFloat(data.price_per_bag) || 0
    if (await billNumberTaken(data.supplier_id, data.bill_number, id)) {
      toast.error(`Bill # ${(data.bill_number || '').trim()} already exists for this supplier`); return false
    }
    const { error } = await supabase.from('supplier_dispatches').update({
      supplier_id: data.supplier_id,
      bill_number: (data.bill_number || '').trim() || null,
      dana_type: data.dana_type || null,
      dispatch_date: data.dispatch_date,
      quantity,
      price_per_bag: price,
      sell_price_per_bag: price,
      total_amount: quantity * price,
      notes: data.notes || null,
    }).eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('danaBill.updated'))
    await fetch()
    return true
  }

  async function deleteDanaBill(id) {
    const { error } = await supabase.from('supplier_dispatches').delete().eq('id', id)
    if (error) { toast.error(error.message); return false }
    toast.success(t('danaBill.deleted'))
    await fetch()
    return true
  }

  const totalBilled = bills.reduce((s, b) => s + (parseFloat(b.total_amount) || 0), 0)

  return { bills, loading, totalBilled, createDanaBill, updateDanaBill, deleteDanaBill, refetch: fetch }
}
