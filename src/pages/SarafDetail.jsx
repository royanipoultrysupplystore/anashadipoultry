import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Plus, Trash2, Repeat, ArrowDownCircle, ArrowUpCircle, Wallet } from 'lucide-react'
import { useSarafDetail } from '../hooks/useSarafs'
import { useFarms } from '../hooks/useFarms'
import { useSuppliers } from '../hooks/useSuppliers'
import { supabase } from '../config/supabase'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'
import { SARAF_BI, bi } from '../utils/biLabels'

const emptyIn = { farm_id: '', supplier_dispatch_id: '', amount: '', payment_date: todayStr(), notes: '' }
const emptyOut = { supplier_id: '', supplier_dispatch_id: '', farm_id: '', amount: '', payment_date: todayStr(), notes: '' }

export default function SarafDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, lang, isRTL } = useLanguage()
  const { farms } = useFarms()
  const { suppliers } = useSuppliers()
  const { saraf, inbound, outbound, loading, totalIn, totalOut, balance, openingHolding, openingOverpaid, recordIn, recordOut, deleteIn, deleteOut } = useSarafDetail(id)

  const [txModal, setTxModal] = useState(null) // null | 'in' | 'out'
  const [inForm, setInForm] = useState(emptyIn)
  const [outForm, setOutForm] = useState(emptyOut)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null) // { kind:'in'|'out', row }

  // Bills written for the selected client (IN form). Loaded on demand when the
  // modal opens or its client dropdown changes — keeps initial page fast.
  const [clientBills, setClientBills] = useState([])

  useEffect(() => {
    if (txModal !== 'in' || !inForm.farm_id) { setClientBills([]); return }
    ;(async () => {
      // Bills written FOR this client = supplier_dispatches rows linked via a
      // dispatch_items row whose parent dispatches.farm_id matches.
      const { data: items } = await supabase
        .from('dispatch_items')
        .select('supplier_dispatch_id, dispatches!inner(farm_id), supplier_dispatches(id, bill_number, dispatch_date, quantity, price_per_bag, total_amount, suppliers(company_name))')
        .eq('dispatches.farm_id', inForm.farm_id)
        .not('supplier_dispatch_id', 'is', null)
      const seen = new Set()
      const bills = []
      for (const it of items || []) {
        const b = it.supplier_dispatches
        if (b && !seen.has(b.id)) {
          seen.add(b.id)
          bills.push(b)
        }
      }
      bills.sort((a, b) => (b.dispatch_date || '').localeCompare(a.dispatch_date || ''))
      setClientBills(bills)
    })()
  }, [txModal, inForm.farm_id])


  const BackIcon = isRTL ? ArrowRight : ArrowLeft

  function openIn() { setInForm({ ...emptyIn, payment_date: todayStr() }); setTxModal('in') }
  function openOut() { setOutForm({ ...emptyOut, payment_date: todayStr() }); setTxModal('out') }

  async function submitIn(ev) {
    ev.preventDefault()
    setSaving(true)
    const ok = await recordIn(inForm)
    setSaving(false)
    if (ok) setTxModal(null)
  }

  async function submitOut(ev) {
    ev.preventDefault()
    setSaving(true)
    const ok = await recordOut(outForm)
    setSaving(false)
    if (ok) setTxModal(null)
  }

  if (loading || !saraf) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        <div className="w-8 h-8 border-2 border-[#14B8A6] border-t-transparent rounded-full animate-spin me-3" />
        {t('common.loading')}
      </div>
    )
  }

  const activeFarms = farms.filter(f => f.is_active)
  const activeSuppliers = suppliers.filter(s => s.type === 'meel' || !s.type) // meel + legacy
  const pmt = (n) => `${n} ${bi(SARAF_BI, 'payments')}`

  // Generic balance-per-party view. Saraf is a tracking hub: clients deposit
  // lump sums (not tied to any one bill), Saraf disburses to whoever needs paying.
  const clientBalances = (() => {
    const m = {}
    for (const p of inbound) {
      const fid = p.farm_id
      if (!fid) continue
      if (!m[fid]) m[fid] = { id: fid, name: lf(p.farms, 'name', lang) || '—', kind: p.farms?.kind, in_total: 0, out_total: 0, count_in: 0, count_out: 0 }
      m[fid].in_total += parseFloat(p.amount) || 0
      m[fid].count_in += 1
    }
    for (const p of outbound) {
      const fid = p.farm_id
      if (!fid) continue
      if (!m[fid]) m[fid] = { id: fid, name: lf(p.farms, 'name', lang) || '—', kind: p.farms?.kind, in_total: 0, out_total: 0, count_in: 0, count_out: 0 }
      m[fid].out_total += parseFloat(p.amount) || 0
      m[fid].count_out += 1
    }
    return Object.values(m)
      .map(c => ({ ...c, net: c.in_total - c.out_total }))
      .sort((a, b) => b.net - a.net)
  })()
  const supplierBalances = (() => {
    const m = {}
    for (const p of outbound) {
      const sid = p.supplier_id
      if (!sid) continue
      if (!m[sid]) m[sid] = { id: sid, name: p.suppliers?.company_name || '—', total: 0, count: 0 }
      m[sid].total += parseFloat(p.amount) || 0
      m[sid].count += 1
    }
    return Object.values(m).sort((a, b) => b.total - a.total)
  })()

  const holdCard = balance > 0
    ? { color: 'bg-amber-50 border-amber-200 text-amber-700', ring: 'text-amber-500', label: bi(SARAF_BI, 'currentlyHolding') }
    : balance < 0
    ? { color: 'bg-red-50 border-red-200 text-red-700', ring: 'text-red-500', label: bi(SARAF_BI, 'overPaid') }
    : { color: 'bg-emerald-50 border-emerald-200 text-emerald-700', ring: 'text-emerald-500', label: bi(SARAF_BI, 'settled') }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/sarafs')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <BackIcon size={16} /> {bi(SARAF_BI, 'backToSarafs')}
      </button>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-[#0F5257]/10 flex items-center justify-center">
            <Repeat size={20} className="text-[#0F5257]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-800 truncate">{saraf.name}</h2>
            {saraf.phone && <p className="text-sm text-slate-500 mt-0.5">{saraf.phone}</p>}
            {saraf.location && <p className="text-sm text-slate-500">{saraf.location}</p>}
            {saraf.notes && <p className="text-sm text-slate-400 mt-1">{saraf.notes}</p>}
          </div>
        </div>
      </div>

      {/* Summary — holding is the headline (full width on mobile), IN / OUT below */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <div className={`col-span-2 lg:col-span-1 order-1 lg:order-3 rounded-xl p-4 border flex items-center gap-3 ${holdCard.color}`}>
          <Wallet size={28} className={`shrink-0 ${holdCard.ring}`} />
          <div className="min-w-0">
            <p className="text-xs mb-0.5 opacity-80">{holdCard.label}</p>
            <p className="text-2xl font-bold leading-tight">{formatCurrency(Math.abs(balance))}</p>
            {(openingHolding > 0 || openingOverpaid > 0) && (
              <p className="text-[11px] mt-0.5 opacity-70">
                {bi(SARAF_BI, 'inclOpening')}{openingHolding > 0 ? ` +${formatCurrency(openingHolding)}` : ''}{openingOverpaid > 0 ? ` −${formatCurrency(openingOverpaid)}` : ''}
              </p>
            )}
          </div>
        </div>
        <div className="order-2 lg:order-1 bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs text-green-700 mb-1 flex items-center gap-1"><ArrowDownCircle size={13} /> {bi(SARAF_BI, 'inFromClients')}</p>
          <p className="text-xl sm:text-2xl font-bold text-green-700">{formatCurrency(totalIn)}</p>
          <p className="text-xs text-green-600 mt-0.5">{pmt(inbound.length)}</p>
        </div>
        <div className="order-3 lg:order-2 bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-700 mb-1 flex items-center gap-1"><ArrowUpCircle size={13} /> {bi(SARAF_BI, 'outToMeels')}</p>
          <p className="text-xl sm:text-2xl font-bold text-red-700">{formatCurrency(totalOut)}</p>
          <p className="text-xs text-red-600 mt-0.5">{pmt(outbound.length)}</p>
        </div>
      </div>

      {/* Balances by party — answer "what is sitting with Saraf for X?" and
          "how much has Saraf paid دانا سپلایر in total?" at a glance. */}
      {(clientBalances.length > 0 || supplierBalances.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm">{bi(SARAF_BI, 'clientNetTitle')}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{bi(SARAF_BI, 'clientNetSub')}</p>
            </div>
            {clientBalances.length === 0 ? (
              <p className="text-center py-5 text-slate-400 text-sm">{bi(SARAF_BI, 'noClientActivity')}</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {clientBalances.map(c => {
                  const netColor = c.net > 0 ? 'text-amber-700' : c.net < 0 ? 'text-red-700' : 'text-emerald-700'
                  const netLabel = c.net > 0 ? bi(SARAF_BI, 'sarafHolds') : c.net < 0 ? bi(SARAF_BI, 'owesSaraf') : bi(SARAF_BI, 'settled')
                  return (
                    <div key={c.id} className="px-4 sm:px-5 py-2.5 flex items-center justify-between text-sm gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-800 truncate">{c.name} {c.kind === 'client' && <span className="text-xs text-slate-400">· {bi(SARAF_BI, 'client')}</span>}</p>
                        <p className="text-xs text-slate-500">
                          {c.count_in > 0 && <span className="text-green-600">+{formatCurrency(c.in_total)} {bi(SARAF_BI, 'inShort')}</span>}
                          {c.count_in > 0 && c.count_out > 0 && <span className="text-slate-400"> · </span>}
                          {c.count_out > 0 && <span className="text-red-600">−{formatCurrency(c.out_total)} {bi(SARAF_BI, 'outShort')}</span>}
                        </p>
                      </div>
                      <div className="text-end shrink-0">
                        <p className={`font-bold ${netColor}`}>{formatCurrency(Math.abs(c.net))}</p>
                        <p className="text-[10px] text-slate-400">{netLabel}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700 text-sm">{bi(SARAF_BI, 'suppliersPaidTitle')}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{bi(SARAF_BI, 'suppliersPaidSub')}</p>
            </div>
            {supplierBalances.length === 0 ? (
              <p className="text-center py-5 text-slate-400 text-sm">{bi(SARAF_BI, 'noSupplierPayouts')}</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {supplierBalances.map(s => (
                  <div key={s.id} className="px-4 sm:px-5 py-2.5 flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-800 truncate">{s.name}</p>
                      <p className="text-xs text-slate-500">{pmt(s.count)}</p>
                    </div>
                    <p className="font-bold text-red-700">{formatCurrency(s.total)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* IN from clients */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2 text-sm sm:text-base">
              <ArrowDownCircle size={16} className="text-green-600 shrink-0" /> {bi(SARAF_BI, 'inFromClients')}
            </h3>
            <button onClick={openIn} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors shrink-0">
              <Plus size={14} /> {bi(SARAF_BI, 'recordIn')}
            </button>
          </div>
          {inbound.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">{bi(SARAF_BI, 'noIncoming')}</p>
          ) : (
            <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {inbound.map(p => (
                <div key={p.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{lf(p.farms, 'name', lang) || '—'}</p>
                    {p.supplier_dispatches && (
                      <p className="text-xs text-slate-600 mt-0.5">
                        → <span className="font-mono bg-blue-100 text-blue-700 px-1 rounded">{bi(SARAF_BI, 'bill')} #{p.supplier_dispatches.bill_number || '—'}</span>
                        {p.supplier_dispatches.suppliers?.company_name && <span className="text-slate-500"> ({p.supplier_dispatches.suppliers.company_name})</span>}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">{formatDate(p.payment_date)}{p.notes ? ` · ${p.notes}` : ''}</p>
                  </div>
                  <p className="font-bold text-green-700 shrink-0">{formatCurrency(p.amount)}</p>
                  <button onClick={() => setDeleteTarget({ kind: 'in', row: p })} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* OUT to meels */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between gap-2 px-4 sm:px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2 text-sm sm:text-base">
              <ArrowUpCircle size={16} className="text-red-600 shrink-0" /> {bi(SARAF_BI, 'outToMeels')}
            </h3>
            <button onClick={openOut} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors shrink-0">
              <Plus size={14} /> {bi(SARAF_BI, 'recordOut')}
            </button>
          </div>
          {outbound.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">{bi(SARAF_BI, 'noOutgoing')}</p>
          ) : (
            <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {outbound.map(p => (
                <div key={p.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{p.suppliers?.company_name || '—'}</p>
                    {(p.farms || p.supplier_dispatches) && (
                      <p className="text-xs text-slate-600 mt-0.5 flex items-center gap-1 flex-wrap">
                        {p.farms && (
                          <>
                            <span className="text-slate-400">{bi(SARAF_BI, 'onBehalfOf')}</span>
                            <span className="font-medium text-emerald-700">{lf(p.farms, 'name', lang)}</span>
                          </>
                        )}
                        {p.supplier_dispatches && (
                          <span className="font-mono bg-blue-100 text-blue-700 px-1 rounded">{bi(SARAF_BI, 'bill')} #{p.supplier_dispatches.bill_number || '—'}</span>
                        )}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">{formatDate(p.payment_date)}{p.notes ? ` · ${p.notes}` : ''}</p>
                  </div>
                  <p className="font-bold text-red-700 shrink-0">{formatCurrency(p.amount)}</p>
                  <button onClick={() => setDeleteTarget({ kind: 'out', row: p })} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg shrink-0">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* IN modal */}
      <Modal open={txModal === 'in'} onClose={() => setTxModal(null)} title={bi(SARAF_BI, 'recordInTitle')}>
        <form onSubmit={submitIn} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{bi(SARAF_BI, 'fromClient')} *</label>
            <select required value={inForm.farm_id}
              onChange={e => setInForm(f => ({ ...f, farm_id: e.target.value, supplier_dispatch_id: '', amount: '' }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
              <option value="">{bi(SARAF_BI, 'pickFarmClient')}</option>
              {activeFarms.map(f => <option key={f.id} value={f.id}>{lf(f, 'name', lang)} ({f.kind === 'client' ? bi(SARAF_BI, 'client') : bi(SARAF_BI, 'farm')})</option>)}
            </select>
          </div>
          {inForm.farm_id && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{bi(SARAF_BI, 'forBill')} <span className="text-slate-400 font-normal">({t('common.optional')})</span></label>
              <select value={inForm.supplier_dispatch_id}
                onChange={e => {
                  const bill = clientBills.find(b => b.id === e.target.value)
                  setInForm(f => ({
                    ...f,
                    supplier_dispatch_id: e.target.value,
                    amount: bill ? String(bill.total_amount || (bill.quantity || 0) * (bill.price_per_bag || 0)) : f.amount,
                  }))
                }}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                <option value="">{bi(SARAF_BI, 'pickBill')}</option>
                {clientBills.map(b => (
                  <option key={b.id} value={b.id}>
                    {bi(SARAF_BI, 'bill')} #{b.bill_number || '—'} · {b.suppliers?.company_name || 'meel'} · {b.quantity} · {formatCurrency(b.total_amount)}
                  </option>
                ))}
              </select>
              {clientBills.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">{bi(SARAF_BI, 'noBillsForClient')}</p>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{bi(SARAF_BI, 'amountAfn')} *</label>
              <input required type="number" min="0.01" step="0.01" value={inForm.amount}
                onChange={e => setInForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
              <input type="date" value={inForm.payment_date} onChange={e => setInForm(f => ({ ...f, payment_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <input value={inForm.notes} onChange={e => setInForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setTxModal(null)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-60">
              {saving ? t('common.saving') : bi(SARAF_BI, 'recordIn')}
            </button>
          </div>
        </form>
      </Modal>

      {/* OUT modal */}
      <Modal open={txModal === 'out'} onClose={() => setTxModal(null)} title={bi(SARAF_BI, 'recordOutTitle')}>
        <form onSubmit={submitOut} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{bi(SARAF_BI, 'toMeel')} *</label>
            <select required value={outForm.supplier_id}
              onChange={e => setOutForm(f => ({ ...f, supplier_id: e.target.value, supplier_dispatch_id: '', amount: '' }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
              <option value="">{bi(SARAF_BI, 'pickSupplier')}</option>
              {activeSuppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{bi(SARAF_BI, 'amountAfn')} *</label>
              <input required type="number" min="0.01" step="0.01" value={outForm.amount}
                onChange={e => setOutForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
              <input type="date" value={outForm.payment_date} onChange={e => setOutForm(f => ({ ...f, payment_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <input value={outForm.notes} onChange={e => setOutForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setTxModal(null)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60">
              {saving ? t('common.saving') : bi(SARAF_BI, 'recordOut')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget?.kind === 'in') await deleteIn(deleteTarget.row)
          else if (deleteTarget?.kind === 'out') await deleteOut(deleteTarget.row)
          setDeleteTarget(null)
        }}
        title={bi(SARAF_BI, 'deleteTxTitle')}
        message={deleteTarget?.kind === 'in' ? bi(SARAF_BI, 'deleteInMsg') : bi(SARAF_BI, 'deleteOutMsg')}
      />
    </div>
  )
}
