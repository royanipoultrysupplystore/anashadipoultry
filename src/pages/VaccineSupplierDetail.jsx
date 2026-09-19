import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CreditCard, Trash2 } from 'lucide-react'
import { useVaccineSupplierDetail, useSuppliers } from '../hooks/useSuppliers'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { useStoreCash } from '../contexts/StoreCashContext'
import { lf } from '../utils/localizedField'

const emptyPayment = { amount: '', payment_date: todayStr(), notes: '' }

// Vaccine lots are bought here and leave through Roznamcha dispatches, so this
// page is read-mostly: it shows what is owed, what is left, and where doses went.
export default function VaccineSupplierDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { t, lang, isRTL } = useLanguage()
  const { deleteSupplier } = useSuppliers()
  const { recordOut, removeByReference } = useStoreCash()
  const {
    supplier, lots, payments, dispatched, loading,
    openingBalance, totalInvested, totalPaid, remaining,
    totalDoses, dosesDispatched, dosesRemaining, totalProfit,
    recordPayment, deletePayment, deleteTransaction,
  } = useVaccineSupplierDetail(id)

  const [paymentModal, setPaymentModal] = useState(false)
  const [paymentForm, setPaymentForm] = useState(emptyPayment)
  const [fromStoreCash, setFromStoreCash] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteSupplierOpen, setDeleteSupplierOpen] = useState(false)

  const BackIcon = isRTL ? ArrowRight : ArrowLeft

  async function handlePayment(e) {
    e.preventDefault()
    setSaving(true)
    const created = await recordPayment(paymentForm)
    setSaving(false)
    if (created) {
      const amt = parseFloat(paymentForm.amount) || 0
      if (fromStoreCash && amt > 0) {
        await recordOut({
          amount: amt, source: 'supplier_payment', reference_id: created.id,
          note: supplier?.company_name, date: paymentForm.payment_date,
        })
      }
      setPaymentModal(false)
      setPaymentForm(emptyPayment)
    }
  }

  async function handleDeletePayment(p) {
    const ok = await deletePayment(p.id)
    if (ok) await removeByReference(p.id)
    setDeleteTarget(null)
  }

  if (loading) return <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
  if (!supplier) return null

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/suppliers?tab=vaccine')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <BackIcon size={16} /> {t('suppliers.vaccineSuppliers')}
      </button>

      <div className="bg-gradient-to-br from-[#0F5257] to-[#06191B] rounded-2xl p-5 text-white">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs text-white/50">💉 {t('suppliers.vaccineSuppliers')}</p>
            <h1 className="text-2xl font-bold">{supplier.company_name}</h1>
            {supplier.owner_name && <p className="text-sm text-white/70">{supplier.owner_name}</p>}
            {supplier.phone && <p className="text-sm text-white/70" dir="ltr">{supplier.phone}</p>}
          </div>
          <button onClick={() => setDeleteSupplierOpen(true)}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">{t('suppliers.totalPurchases')}</p>
          <p className="text-xl font-bold text-slate-800">{formatCurrency(totalInvested)}</p>
          {openingBalance > 0 && (
            <p className="text-[11px] text-slate-400 mt-1">+ {formatCurrency(openingBalance)} opening</p>
          )}
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">{t('suppliers.totalPaid')}</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(totalPaid)}</p>
        </div>
        <div className={`rounded-xl p-4 border ${remaining > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <p className="text-xs text-slate-500 mb-1">{t('suppliers.remaining')}</p>
          <p className={`text-xl font-bold ${remaining > 0 ? 'text-red-700' : 'text-green-700'}`}>
            {formatCurrency(Math.max(0, remaining))}
          </p>
        </div>
        <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Doses left / باقی</p>
          <p className="text-xl font-bold text-sky-700">{dosesRemaining}</p>
          <p className="text-[11px] text-slate-400 mt-1">{dosesDispatched} of {totalDoses} dispatched</p>
        </div>
      </div>

      <button onClick={() => setPaymentModal(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0F5257] text-white text-sm font-semibold">
        <CreditCard size={16} /> {t('suppliers.recordPayment')}
      </button>

      {/* Purchases — one row per vaccine lot bought from this supplier */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Vaccine purchases / خریداری واکسین</h2>
          {totalProfit > 0 && (
            <p className="text-xs text-slate-400">Expected profit: {formatCurrency(totalProfit)}</p>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="px-4 py-2 text-start">{t('common.date')}</th>
                <th className="px-4 py-2 text-start">Vaccine</th>
                <th className="px-4 py-2 text-start">Doses</th>
                <th className="px-4 py-2 text-start">Buy</th>
                <th className="px-4 py-2 text-start">Sale</th>
                <th className="px-4 py-2 text-start">{t('common.total')}</th>
                <th className="px-4 py-2 text-start">Left</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lots.map(l => (
                <tr key={l.id}>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(l.transaction_date)}</td>
                  <td className="px-4 py-3 font-medium text-slate-800">{l.vaccine_name}</td>
                  <td className="px-4 py-3">{l.quantity}</td>
                  <td className="px-4 py-3">{formatCurrency(l.price_per_unit)}</td>
                  <td className="px-4 py-3">{formatCurrency(l.sale_price_per_unit)}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(l.total_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs ${l.remaining > 0 ? 'bg-sky-100 text-sky-700' : 'bg-slate-100 text-slate-500'}`}>
                      {l.remaining}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <button onClick={() => setDeleteTarget({ kind: 'lot', row: l })}
                      className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {lots.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-slate-400">
                  No vaccine purchased yet — record one while dispatching in Roznamcha.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Where the doses went */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">Dispatched to farms / ارسال به فارم‌ها</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="px-4 py-2 text-start">{t('common.date')}</th>
                <th className="px-4 py-2 text-start">{t('nav.farms')}</th>
                <th className="px-4 py-2 text-start">Doses</th>
                <th className="px-4 py-2 text-start">{t('common.total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dispatched.map((d, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(d.dispatches?.dispatch_date)}</td>
                  <td className="px-4 py-3">{lf(d.dispatches?.farms, 'name', lang) || '—'}</td>
                  <td className="px-4 py-3">{d.quantity}</td>
                  <td className="px-4 py-3 font-semibold">{formatCurrency(d.total_amount)}</td>
                </tr>
              ))}
              {dispatched.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Nothing dispatched yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payments made to this supplier */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-800">{t('suppliers.payments')}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="px-4 py-2 text-start">{t('common.date')}</th>
                <th className="px-4 py-2 text-start">{t('common.amount')}</th>
                <th className="px-4 py-2 text-start">{t('common.notes')}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map(p => (
                <tr key={p.id}>
                  <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(p.payment_date)}</td>
                  <td className="px-4 py-3 font-semibold text-green-700">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{p.notes || '—'}</td>
                  <td className="px-4 py-3 text-end">
                    <button onClick={() => setDeleteTarget({ kind: 'payment', row: p })}
                      className="p-1.5 text-slate-300 hover:text-red-500"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">{t('suppliers.noPayments')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={paymentModal} onClose={() => { setPaymentModal(false); setPaymentForm(emptyPayment) }}
        title={t('suppliers.recordPayment')}>
        <form onSubmit={handlePayment} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.amount')} (AFN) *</label>
            <input required type="number" min="0.01" step="0.01" value={paymentForm.amount}
              onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
            <input type="date" value={paymentForm.payment_date}
              onChange={e => setPaymentForm(f => ({ ...f, payment_date: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <input value={paymentForm.notes}
              onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
          </div>
          <label className="flex items-center gap-2 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2">
            <input type="checkbox" checked={fromStoreCash} onChange={e => setFromStoreCash(e.target.checked)} />
            {t('storeCash.fromStoreCash')}
          </label>
          <button type="submit" disabled={saving}
            className="w-full px-4 py-2.5 rounded-xl bg-[#0F5257] text-white text-sm font-semibold disabled:opacity-50">
            {saving ? t('common.saving') : t('common.save')}
          </button>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget?.kind === 'payment') return handleDeletePayment(deleteTarget.row)
          deleteTransaction(deleteTarget.row.id)
          setDeleteTarget(null)
        }}
        title={t('common.delete')}
        message={deleteTarget?.kind === 'payment'
          ? 'Remove this payment? The supplier balance goes back up by this amount, and the matching store-cash entry is reversed.'
          : 'Deleting this purchase removes it from the supplier balance. Dispatches already made from it keep their own record. Continue?'}
      />

      <ConfirmDialog
        open={deleteSupplierOpen}
        onCancel={() => setDeleteSupplierOpen(false)}
        onConfirm={async () => {
          const ok = await deleteSupplier(id)
          if (ok) navigate('/suppliers?tab=vaccine')
        }}
        title={t('common.delete')}
        message={t('suppliers.deleteConfirm')}
      />
    </div>
  )
}
