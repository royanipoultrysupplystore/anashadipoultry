import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Phone, Edit2, Trash2, ArrowUpRight, ArrowDownLeft } from 'lucide-react'
import { useCashLedger } from '../hooks/useCashLedger'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PhoneInput from '../components/common/PhoneInput'
import WhatsAppPromptDialog from '../components/common/WhatsAppPromptDialog'
import { formatCurrency, formatNumber } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { useStoreCash } from '../contexts/StoreCashContext'
import toast from 'react-hot-toast'

// Pashto sub-labels for the two ledger directions + the two settle actions.
const PS_LENT = 'قرض ورکول'      // giving a loan       (they owe us → green)
const PS_BORROWED = 'قرض اخیستل'  // taking a loan       (we owe them → red)
const PS_RECEIVE = 'ترلاسه کول'   // receiving repayment (green side)
const PS_PAY = 'ادایګي'          // making repayment    (red side)

export default function CashLedgerPersonDetail() {
  const { slug } = useParams()
  const { t } = useLanguage()
  const { persons, loading, addTransaction, updateTransaction, deleteTransaction } = useCashLedger()
  const { recordIn, recordOut, removeByReference } = useStoreCash()

  const [modal, setModal] = useState(false)
  const [editTx, setEditTx] = useState(null)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)
  const [useStoreCashFlag, setUseStoreCashFlag] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [waPrompt, setWaPrompt] = useState(null)

  const person = persons.find(p => p.name.toLowerCase() === decodeURIComponent(slug || '').toLowerCase())

  // 'lent' = money leaves the drawer; 'borrowed' = money enters the drawer.
  async function recordLedgerCash(type, amount, referenceId, personName, date) {
    if (!(amount > 0)) return
    const payload = { amount, source: 'loan', reference_id: referenceId, note: personName, date }
    if (type === 'lent') await recordOut(payload)
    else await recordIn(payload)
  }

  function cashWaPrompt({ name, phone, type, amount, date, net }) {
    return {
      templateKey: type === 'lent' ? 'cash_given' : 'cash_received',
      variables: { name, amount: formatNumber(amount), date, balance: formatNumber(Math.abs(net)) },
      recipient: { name, phone },
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="w-8 h-8 border-2 border-[#14B8A6] border-t-transparent rounded-full animate-spin me-3" />
      {t('common.loading')}
    </div>
  )

  if (!person) return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link to="/cash-ledger" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> {t('cashLedger.backToList')}
      </Link>
      <div className="bg-white rounded-2xl border border-slate-100 py-16 text-center text-slate-400">
        {t('cashLedger.profileNotFound')}
      </div>
    </div>
  )

  const net = person.lent - person.borrowed
  const owesUs = net > 0
  const weOwe = net < 0
  const txs = person.transactions

  function openAdd(type) {
    setEditTx(null)
    setForm({ phone: person.phone || '', amount: '', type, note: '', transaction_date: todayStr() })
    setUseStoreCashFlag(true)
    setModal(true)
  }

  function openSettle() {
    // owesUs → we receive a repayment (type 'borrowed'); weOwe → we make a repayment (type 'lent').
    const type = owesUs ? 'borrowed' : 'lent'
    setEditTx(null)
    setForm({
      phone: person.phone || '',
      amount: '',
      type,
      note: owesUs ? t('cashLedger.receivedRepayment') : t('cashLedger.madeRepayment'),
      transaction_date: todayStr(),
    })
    setUseStoreCashFlag(true)
    setModal(true)
  }

  function openEdit(tx) {
    setEditTx(tx)
    setForm({
      phone: tx.phone || '',
      amount: String(tx.amount),
      type: tx.type,
      note: tx.note || '',
      transaction_date: tx.transaction_date,
    })
    setUseStoreCashFlag(false) // editing an existing row doesn't re-touch store cash
    setModal(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!(parseFloat(form.amount) > 0)) { toast.error(t('cashLedger.amountRequired')); return }
    setSaving(true)
    const payload = { ...form, person_name: person.name }
    const ok = editTx ? await updateTransaction(editTx.id, payload) : await addTransaction(payload)
    setSaving(false)
    if (!ok) return
    if (!editTx) {
      const amt = parseFloat(form.amount) || 0
      if (useStoreCashFlag) await recordLedgerCash(form.type, amt, ok.id, person.name, form.transaction_date)
      const newLent = person.lent + (form.type === 'lent' ? amt : 0)
      const newBorrowed = person.borrowed + (form.type === 'borrowed' ? amt : 0)
      setWaPrompt(cashWaPrompt({
        name: person.name, phone: form.phone, type: form.type,
        amount: amt, date: form.transaction_date, net: newLent - newBorrowed,
      }))
    }
    setModal(false); setEditTx(null); setForm(null)
  }

  const balanceTone = owesUs
    ? 'bg-green-50 border-green-200'
    : weOwe ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Link to="/cash-ledger" className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft size={16} /> {t('cashLedger.backToList')}
      </Link>

      {/* Person header */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-[#0F5257]/10 text-[#0F5257] flex items-center justify-center font-bold text-lg shrink-0">
          {person.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold text-slate-800 truncate">{person.name}</p>
          {person.phone && (
            <div className="flex items-center gap-1 text-sm text-slate-400 mt-0.5">
              <Phone size={12} /> <span dir="ltr">{person.phone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Balance summary */}
      <div className={`rounded-2xl border p-5 ${balanceTone}`}>
        <p className={`text-sm font-medium ${owesUs ? 'text-green-700' : weOwe ? 'text-red-700' : 'text-slate-500'}`}>
          {owesUs ? t('cashLedger.owesUs') : weOwe ? t('cashLedger.weOwe') : t('cashLedger.settled')}
        </p>
        <p className={`text-3xl font-bold mt-1 ${owesUs ? 'text-green-700' : weOwe ? 'text-red-700' : 'text-slate-400'}`}>
          {formatCurrency(Math.abs(net))}
        </p>
        <div className="grid grid-cols-2 gap-3 mt-4">
          <div className="bg-white/70 rounded-xl px-3 py-2 text-center">
            <p className="text-xs text-green-600">{t('cashLedger.totalLent')}</p>
            <p className="text-sm font-bold text-green-700">{formatCurrency(person.lent)}</p>
          </div>
          <div className="bg-white/70 rounded-xl px-3 py-2 text-center">
            <p className="text-xs text-red-600">{t('cashLedger.totalBorrowed')}</p>
            <p className="text-sm font-bold text-red-700">{formatCurrency(person.borrowed)}</p>
          </div>
        </div>
      </div>

      {/* Primary actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button onClick={() => openAdd('lent')}
          className="flex items-center justify-center gap-2.5 px-4 py-3.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 transition-colors">
          <ArrowDownLeft size={18} />
          <span className="text-start leading-tight">
            <span className="block text-sm">{t('cashLedger.lent')}</span>
            <span dir="rtl" className="block text-xs font-normal opacity-90">{PS_LENT}</span>
          </span>
        </button>
        <button onClick={() => openAdd('borrowed')}
          className="flex items-center justify-center gap-2.5 px-4 py-3.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors">
          <ArrowUpRight size={18} />
          <span className="text-start leading-tight">
            <span className="block text-sm">{t('cashLedger.borrowed')}</span>
            <span dir="rtl" className="block text-xs font-normal opacity-90">{PS_BORROWED}</span>
          </span>
        </button>
      </div>

      {/* Settle convenience */}
      {net !== 0 && (
        <button onClick={openSettle}
          className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium text-white transition-colors ${
            owesUs ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
          }`}>
          {owesUs ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
          {owesUs ? t('cashLedger.receivePayment') : t('cashLedger.makePayment')}
          <span dir="rtl" className="opacity-90">· {owesUs ? PS_RECEIVE : PS_PAY}</span>
        </button>
      )}

      {/* History */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="font-semibold text-slate-700 text-sm">{t('cashLedger.history')}</p>
          <p className="text-xs text-slate-400">{txs.length} {txs.length === 1 ? t('cashLedger.entry') : t('cashLedger.entries')}</p>
        </div>
        <div className="divide-y divide-slate-50">
          {txs.map(tx => (
            <div key={tx.id} className="px-4 py-3 flex items-start gap-3">
              <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${tx.type === 'lent' ? 'bg-green-100' : 'bg-red-100'}`}>
                {tx.type === 'lent'
                  ? <ArrowDownLeft size={14} className="text-green-600" />
                  : <ArrowUpRight size={14} className="text-red-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${tx.type === 'lent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {tx.type === 'lent' ? t('cashLedger.lent') : t('cashLedger.borrowed')}
                    <span dir="rtl" className="ms-1 font-normal opacity-80">{tx.type === 'lent' ? PS_LENT : PS_BORROWED}</span>
                  </span>
                  <span className="text-xs text-slate-400">{formatDate(tx.transaction_date)}</span>
                </div>
                {tx.note && <p className="text-sm text-slate-600 mt-1 wrap-break-word">{tx.note}</p>}
              </div>
              <div className="text-end shrink-0">
                <p className={`text-base font-bold ${tx.type === 'lent' ? 'text-green-600' : 'text-red-600'}`}>
                  {tx.type === 'lent' ? '+' : '-'}{formatCurrency(tx.amount)}
                </p>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <button onClick={() => openEdit(tx)} className="p-1.5 text-slate-400 hover:text-[#0F5257] hover:bg-slate-100 rounded-lg">
                  <Edit2 size={13} />
                </button>
                <button onClick={() => setDeleteTarget(tx)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg">
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        open={modal}
        onClose={() => { setModal(false); setEditTx(null); setForm(null) }}
        title={editTx ? t('cashLedger.editTransaction') : t('cashLedger.addTransaction')}
      >
        {form && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-2">{t('cashLedger.transactionType')} *</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium select-none
                  ${form.type === 'lent' ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                  <input type="radio" name="type" value="lent" className="sr-only"
                    checked={form.type === 'lent'} onChange={() => setForm(f => ({ ...f, type: 'lent' }))} />
                  <ArrowDownLeft size={16} className={form.type === 'lent' ? 'text-green-600' : 'text-slate-400'} />
                  <div>
                    <div>{t('cashLedger.lent')}</div>
                    <div dir="rtl" className="text-xs font-normal opacity-70">{PS_LENT}</div>
                  </div>
                </label>
                <label className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border-2 cursor-pointer transition-all text-sm font-medium select-none
                  ${form.type === 'borrowed' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                  <input type="radio" name="type" value="borrowed" className="sr-only"
                    checked={form.type === 'borrowed'} onChange={() => setForm(f => ({ ...f, type: 'borrowed' }))} />
                  <ArrowUpRight size={16} className={form.type === 'borrowed' ? 'text-red-600' : 'text-slate-400'} />
                  <div>
                    <div>{t('cashLedger.borrowed')}</div>
                    <div dir="rtl" className="text-xs font-normal opacity-70">{PS_BORROWED}</div>
                  </div>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.amount')} (AFN) *</label>
                <input required type="number" min="1" step="0.01" value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
                <input type="date" value={form.transaction_date}
                  onChange={e => setForm(f => ({ ...f, transaction_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('cashLedger.phone')}</label>
                <PhoneInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder={t('cashLedger.notePlaceholder')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
            </div>

            {!editTx && (
              <label className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 cursor-pointer border ${form.type === 'lent' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                <input type="checkbox" checked={useStoreCashFlag} onChange={e => setUseStoreCashFlag(e.target.checked)} className="rounded" />
                💵 {form.type === 'lent' ? t('storeCash.fromStoreCash') : t('storeCash.addToStoreCash')}
              </label>
            )}

            <div className="flex gap-3 justify-end pt-1">
              <button type="button" onClick={() => { setModal(false); setEditTx(null); setForm(null) }}
                className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
                {t('common.cancel')}
              </button>
              <button type="submit" disabled={saving}
                className={`px-5 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-60 transition-colors
                  ${form.type === 'lent' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}>
                {saving ? t('common.saving') : editTx ? t('common.saveChanges') : t('cashLedger.record')}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { await deleteTransaction(deleteTarget.id); await removeByReference(deleteTarget.id); setDeleteTarget(null) }}
        title={t('cashLedger.deleteTitle')}
        message={t('cashLedger.deleteConfirm')}
      />

      <WhatsAppPromptDialog
        open={!!waPrompt}
        onClose={() => setWaPrompt(null)}
        templateKey={waPrompt?.templateKey}
        variables={waPrompt?.variables}
        recipient={waPrompt?.recipient}
      />
    </div>
  )
}
