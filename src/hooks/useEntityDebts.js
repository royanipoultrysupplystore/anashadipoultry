import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'

// PostgREST caps a single response at 1000 rows, so page through the whole table.
// (Same guard the Dashboard's sumAllRows uses — a plain select silently truncates.)
async function fetchAllRows(table, columns) {
  const pageSize = 1000
  let all = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + pageSize - 1)
    if (error || !data || data.length === 0) break
    all = all.concat(data)
    if (data.length < pageSize) break
  }
  return all
}

// Live debt per entity, computed straight from the transactions — the SAME
// formula FarmDetail.jsx uses — so list cards can't drift from reality the way
// the cached farms.total_debt column does (overpayments get clamped away there).
//   debt = max(0, dispatched + supplyOut + chickenValue - paid)
// For clients, supplyOut and chickenValue don't apply.
export function useEntityDebts(kind) {
  const isClient = kind === 'client'
  const [debts, setDebts] = useState({}) // { [farmId]: number }
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [disp, pay, supply, batches, farmRows] = await Promise.all([
      fetchAllRows('dispatches', 'farm_id, total_amount'),
      fetchAllRows('payments', 'farm_id, amount'),
      isClient ? Promise.resolve([]) : fetchAllRows('supply_payments', 'farm_id, amount'),
      isClient ? Promise.resolve([]) : fetchAllRows('farm_batches', 'farm_id, initial_chicken_count, price_per_chicken'),
      fetchAllRows('farms', 'id, opening_balance'),
    ])

    const acc = {}
    const slot = (id) => (acc[id] ||= { dispatched: 0, paid: 0, supply: 0, chicken: 0, opening: 0 })
    // Opening balance: carry-over debt from before this system, an additive constant.
    for (const f of farmRows) if (f.id) slot(f.id).opening += parseFloat(f.opening_balance) || 0
    for (const d of disp) if (d.farm_id) slot(d.farm_id).dispatched += d.total_amount || 0
    for (const p of pay) if (p.farm_id) slot(p.farm_id).paid += p.amount || 0
    for (const s of supply) if (s.farm_id) slot(s.farm_id).supply += s.amount || 0
    for (const b of batches) if (b.farm_id) slot(b.farm_id).chicken += (b.initial_chicken_count || 0) * (b.price_per_chicken || 0)

    const out = {}
    for (const [id, v] of Object.entries(acc)) {
      out[id] = Math.max(0, v.opening + v.dispatched + v.supply + v.chicken - v.paid)
    }
    setDebts(out)
    setLoading(false)
  }, [isClient])

  useEffect(() => { load() }, [load])

  return { debts, loading, refetch: load }
}
