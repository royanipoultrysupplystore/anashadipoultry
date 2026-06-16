import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Plus, Trash2, Repeat, ArrowDownCircle, ArrowUpCircle } from 'lucide-react'
import { useSarafDetail } from '../hooks/useSarafs'
import { useFarms } from '../hooks/useFarms'
import { useSuppliers } from '../hooks/useSuppliers'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'

const emptyIn = { farm_id: '', amount: '', payment_date: todayStr(), notes: '' }
const emptyOut = { supplier_id: '', amount: '', payment_date: todayStr(), notes: '' }

export default function SarafDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, lang, isRTL } = useLanguage()
  const { farms } = useFarms()
  const { suppliers } = useSuppliers()
  const { saraf, inbound, outbound, loading, totalIn, totalOut, balance, recordIn, recordOut, deleteIn, deleteOut } = useSarafDetail(id)

  const [txModal, setTxModal] = useState(null) // null | 'in' | 'out'
  const [inForm, setInForm] = useState(emptyIn)
  const [outForm, setOutForm] = useState(emptyOut)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null) // { kind:'in'|'out', row }

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

  const balanceCard = balance > 0
    ? { color: 'bg-amber-50 border-amber-200 text-amber-700', label: 'Currently holding' }
    : balance < 0
    ? { color: 'bg-red-50 border-red-200 text-red-700', label: 'Over-paid' }
    : { color: 'bg-emerald-50 border-emerald-200 text-emerald-700', label: 'Settled' }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/sarafs')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
        <BackIcon size={16} /> Back to Sarafs
      </button>

      <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <Repeat size={20} className="text-[#0F5257]" /> {saraf.name}
            </h2>
            {saraf.phone && <p className="text-sm text-slate-500 mt-0.5">{saraf.phone}</p>}
            {saraf.location && <p className="text-sm text-slate-500">{saraf.location}</p>}
            {saraf.notes && <p className="text-sm text-slate-400 mt-1">{saraf.notes}</p>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs text-green-700 mb-1">In from clients</p>
          <p className="text-2xl font-bold text-green-700">{formatCurrency(totalIn)}</p>
          <p className="text-xs text-green-600 mt-0.5">{inbound.length} payment{inbound.length === 1 ? '' : 's'}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-700 mb-1">Out to meels</p>
          <p className="text-2xl font-bold text-red-700">{formatCurrency(totalOut)}</p>
          <p className="text-xs text-red-600 mt-0.5">{outbound.length} payment{outbound.length === 1 ? '' : 's'}</p>
        </div>
        <div className={`rounded-xl p-4 border ${balanceCard.color}`}>
          <p className="text-xs mb-1 opacity-80">{balanceCard.label}</p>
          <p className="text-2xl font-bold">{formatCurrency(Math.abs(balance))}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* IN from clients */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <ArrowDownCircle size={16} className="text-green-600" /> In from clients
            </h3>
            <button onClick={openIn} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors">
              <Plus size={14} /> Record IN
            </button>
          </div>
          {inbound.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">No incoming payments yet</p>
          ) : (
            <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {inbound.map(p => (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{lf(p.farms, 'name', lang) || '—'}</p>
                    <p className="text-xs text-slate-500">{formatDate(p.payment_date)}{p.notes ? ` · ${p.notes}` : ''}</p>
                  </div>
                  <p className="font-bold text-green-700">{formatCurrency(p.amount)}</p>
                  <button onClick={() => setDeleteTarget({ kind: 'in', row: p })} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* OUT to meels */}
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
              <ArrowUpCircle size={16} className="text-red-600" /> Out to meels
            </h3>
            <button onClick={openOut} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors">
              <Plus size={14} /> Record OUT
            </button>
          </div>
          {outbound.length === 0 ? (
            <p className="text-center py-8 text-slate-400 text-sm">No outgoing payments yet</p>
          ) : (
            <div className="divide-y divide-slate-50 max-h-96 overflow-y-auto">
              {outbound.map(p => (
                <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="font-medium text-slate-800">{p.suppliers?.company_name || '—'}</p>
                    <p className="text-xs text-slate-500">{formatDate(p.payment_date)}{p.notes ? ` · ${p.notes}` : ''}</p>
                  </div>
                  <p className="font-bold text-red-700">{formatCurrency(p.amount)}</p>
                  <button onClick={() => setDeleteTarget({ kind: 'out', row: p })} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* IN modal */}
      <Modal open={txModal === 'in'} onClose={() => setTxModal(null)} title="Record money IN from a client">
        <form onSubmit={submitIn} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Client / Farm *</label>
            <select required value={inForm.farm_id} onChange={e => setInForm(f => ({ ...f, farm_id: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
              <option value="">— pick farm or client —</option>
              {activeFarms.map(f => <option key={f.id} value={f.id}>{lf(f, 'name', lang)} ({f.kind === 'client' ? 'Client' : 'Farm'})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount (AFN) *</label>
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
              {saving ? t('common.saving') : 'Record IN'}
            </button>
          </div>
        </form>
      </Modal>

      {/* OUT modal */}
      <Modal open={txModal === 'out'} onClose={() => setTxModal(null)} title="Record money OUT to a meel supplier">
        <form onSubmit={submitOut} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Supplier *</label>
            <select required value={outForm.supplier_id} onChange={e => setOutForm(f => ({ ...f, supplier_id: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
              <option value="">— pick a supplier —</option>
              {activeSuppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Amount (AFN) *</label>
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
              {saving ? t('common.saving') : 'Record OUT'}
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
        title="Delete transaction?"
        message={deleteTarget?.kind === 'in'
          ? 'The payment will be removed and the client/farm debt will be restored.'
          : 'The payment to the supplier will be removed.'}
      />
    </div>
  )
}
