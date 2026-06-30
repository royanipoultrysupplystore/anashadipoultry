import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Truck, CreditCard, Plus, Trash2, Edit2, FileText } from 'lucide-react'
import { useSupplierDetail } from '../hooks/useSuppliers'
import { useBusinessInfo } from '../contexts/SettingsContext'
import { printDanaBill } from '../utils/printDanaBill'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import WhatsAppPromptDialog from '../components/common/WhatsAppPromptDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { formatDate, todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { useStoreCash } from '../contexts/StoreCashContext'
import { lf } from '../utils/localizedField'

const FEED_TYPES = ['Feed (Dana)']

const DANA_OPTIONS = [
  { value: '4_number',  labelKey: 'dana4Number',  color: 'bg-blue-100 text-blue-700' },
  { value: '6_number',  labelKey: 'dana6Number',  color: 'bg-cyan-100 text-cyan-700' },
  { value: '9_number',  labelKey: 'dana9Number',  color: 'bg-green-100 text-green-700' },
  { value: '12_number', labelKey: 'dana12Number', color: 'bg-purple-100 text-purple-700' },
  { value: 'other',     labelKey: 'danaOther',    color: 'bg-slate-100 text-slate-600' },
]

const DANA_SELECTED_COLORS = {
  '4_number':  'border-blue-500 bg-blue-50 text-blue-700',
  '6_number':  'border-cyan-500 bg-cyan-50 text-cyan-700',
  '9_number':  'border-green-500 bg-green-50 text-green-700',
  '12_number': 'border-purple-500 bg-purple-50 text-purple-700',
  'other':     'border-slate-400 bg-slate-50 text-slate-700',
}

const DANA_DOT_COLORS = {
  '4_number':  'border-blue-500 bg-blue-500',
  '6_number':  'border-cyan-500 bg-cyan-500',
  '9_number':  'border-green-500 bg-green-500',
  '12_number': 'border-purple-500 bg-purple-500',
  'other':     'border-slate-400 bg-slate-400',
}

const emptyDispatch = {
  product_name: '',
  bill_number: '',
  dana_type: '',
  dispatch_date: todayStr(),
  quantity: '',
  price_per_bag: '',
  sell_price_per_bag: '',
  weight_kg: '',
  commission_per_bag: '',
  notes: '',
}

const emptyPayment = {
  amount: '',
  payment_date: todayStr(),
  notes: '',
}

export default function SupplierDetail() {
  const { id } = useParams()
  const { t, lang, isRTL } = useLanguage()
  const { businessName } = useBusinessInfo()
  const {
    supplier, dispatches, payments, loading,
    totalOwed, totalPaid, remaining, totalBags, totalCommission,
    receiveDispatch, updateDispatch, deleteDispatch,
    recordPayment, updatePayment, deletePayment,
  } = useSupplierDetail(id)
  const { recordOut, removeByReference } = useStoreCash()

  const [dispatchModal, setDispatchModal] = useState(false)
  const [paymentModal, setPaymentModal] = useState(false)
  const [paymentFromStoreCash, setPaymentFromStoreCash] = useState(true)
  const [editDispatch, setEditDispatch] = useState(null)
  const [editPayment, setEditPayment] = useState(null)
  const [dispatchForm, setDispatchForm] = useState(emptyDispatch)
  const [paymentForm, setPaymentForm] = useState(emptyPayment)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [waPrompt, setWaPrompt] = useState(null)
  const [billSearch, setBillSearch] = useState('')
  const filteredDispatches = dispatches.filter(d => {
    if (!billSearch) return true
    const q = billSearch.toLowerCase()
    return (
      (d.bill_number || '').toLowerCase().includes(q) ||
      (d.product_name || '').toLowerCase().includes(q) ||
      (d.dana_type || '').toLowerCase().includes(q) ||
      (lf(d.farms, 'name', lang) || '').toLowerCase().includes(q)
    )
  })

  const BackIcon = isRTL ? ArrowRight : ArrowLeft

  function openNewDispatch() {
    setEditDispatch(null)
    setDispatchForm({ ...emptyDispatch, dispatch_date: todayStr() })
    setDispatchModal(true)
  }

  function printBill(d) {
    printDanaBill({
      business_name: businessName,
      client_name: lf(d.farms, 'name', lang) || '—',
      supplier_name: supplier?.company_name || '—',
      bill_number: d.bill_number,
      dana_type: d.dana_type,
      quantity: d.quantity,
      price_per_bag: d.price_per_bag,
      total_amount: d.total_amount,
      date: formatDate(d.dispatch_date),
    })
  }

  function openEditDispatch(d) {
    setEditDispatch(d)
    setDispatchForm({
      product_name: d.product_name || '',
      bill_number: d.bill_number || '',
      dana_type: d.dana_type || '',
      dispatch_date: d.dispatch_date,
      quantity: d.quantity,
      price_per_bag: d.price_per_bag,
      sell_price_per_bag: d.sell_price_per_bag || '',
      weight_kg: d.weight_kg || '',
      commission_per_bag: d.commission_per_bag,
      notes: d.notes || '',
    })
    setDispatchModal(true)
  }

  function openNewPayment() {
    setEditPayment(null)
    setPaymentForm({ ...emptyPayment, payment_date: todayStr() })
    setPaymentFromStoreCash(true)
    setPaymentModal(true)
  }

  function openEditPayment(p) {
    setEditPayment(p)
    setPaymentForm({ amount: p.amount, payment_date: p.payment_date, notes: p.notes || '' })
    setPaymentModal(true)
  }

  async function handleDispatch(e) {
    e.preventDefault()
    setSaving(true)
    const isNew = !editDispatch
    const ok = editDispatch
      ? await updateDispatch(editDispatch.id, dispatchForm)
      : await receiveDispatch(dispatchForm)
    setSaving(false)
    if (ok) {
      const qtyAdded = parseFloat(dispatchForm.quantity) || 0
      const pricePerBag = parseFloat(dispatchForm.price_per_bag) || 0
      const newOwed = qtyAdded * pricePerBag
      const itemDesc = `${dispatchForm.product_name || 'Meel'} × ${qtyAdded} bags`
      const dateUsed = dispatchForm.dispatch_date
      setDispatchModal(false); setDispatchForm(emptyDispatch); setEditDispatch(null)
      if (isNew && supplier) {
        setWaPrompt({
          templateKey: 'supplier_goods_received',
          variables: {
            name: supplier.company_name,
            items_list: itemDesc,
            amount: formatCurrency(newOwed),
            date: dateUsed,
            balance: formatCurrency(remaining + newOwed),
          },
          recipient: { name: supplier.company_name, phone: supplier.phone },
        })
      }
    }
  }

  async function handlePayment(e) {
    e.preventDefault()
    setSaving(true)
    const isNew = !editPayment
    const ok = editPayment
      ? await updatePayment(editPayment.id, paymentForm)
      : await recordPayment(paymentForm)
    setSaving(false)
    if (ok) {
      const wasPaid = parseFloat(paymentForm.amount) || 0
      const dateUsed = paymentForm.payment_date
      if (isNew && paymentFromStoreCash && wasPaid > 0) {
        await recordOut({ amount: wasPaid, source: 'supplier_payment', reference_id: ok.id, note: supplier?.company_name, date: dateUsed })
      }
      setPaymentModal(false); setPaymentForm(emptyPayment); setEditPayment(null)
      if (isNew && supplier) {
        setWaPrompt({
          templateKey: 'supplier_payment_made',
          variables: {
            name: supplier.company_name,
            amount: formatCurrency(wasPaid),
            date: dateUsed,
            balance: formatCurrency(Math.max(0, remaining - wasPaid)),
          },
          recipient: { name: supplier.company_name, phone: supplier.phone },
        })
      }
    }
  }

  const qty = parseFloat(dispatchForm.quantity) || 0
  const pricePerBag = parseFloat(dispatchForm.price_per_bag) || 0
  const sellPricePerBag = parseFloat(dispatchForm.sell_price_per_bag) || 0
  const commissionPerBag = parseFloat(dispatchForm.commission_per_bag) || 0
  const dispatchTotal = qty * pricePerBag
  const dispatchCommission = qty * commissionPerBag
  const expectedProfit = sellPricePerBag > 0 ? qty * (sellPricePerBag - pricePerBag) : 0

  if (loading) return <div className="text-center py-12 text-slate-400">{t('common.loading')}</div>
  if (!supplier) return null

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-4">
        <Link to="/suppliers?tab=meel" className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 transition-colors">
          <BackIcon size={18} />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-slate-800">{supplier.company_name}</h2>
          <p className="text-sm text-slate-500">
            {supplier.owner_name && <span>{supplier.owner_name}</span>}
            {supplier.owner_name && supplier.phone && <span> · </span>}
            {supplier.phone && <span dir="ltr">{supplier.phone}</span>}
          </p>
          {supplier.notes && <p className="text-xs text-slate-400 mt-0.5">{supplier.notes}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {[
          { label: t('suppliers.totalOwed'), value: formatCurrency(totalOwed), color: 'text-red-600' },
          { label: t('suppliers.totalPaid'), value: formatCurrency(totalPaid), color: 'text-green-600' },
          { label: t('suppliers.remaining'), value: formatCurrency(remaining), color: remaining > 0 ? 'text-orange-600' : 'text-slate-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
            <div className="text-xs text-slate-500 mb-1">{label}</div>
            <div className={`text-lg font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>
      {/* Broker-model stats: Anas Hadi is a middleman, not a stockist.
          Total Bags = bags ordered via this meel through bills; Total Commission
          is what we keep per bag. Stock-only stats (Dispatched / Remaining bags)
          are hidden. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">Total Bags Billed / مجموع بل‌ها</div>
          <div className="text-lg font-bold text-blue-600">{totalBags}</div>
        </div>
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-4">
          <div className="text-xs text-slate-500 mb-1">{t('suppliers.totalCommission')}</div>
          <div className="text-lg font-bold text-purple-600">{formatCurrency(totalCommission)}</div>
        </div>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600 leading-relaxed">
        <span className="font-semibold text-slate-700">Broker view</span> — Anas Hadi doesn't receive Dana from this meel.
        Each row below is a <span className="font-medium">bill</span> written to a client/farm; the client carries it to the meel.
        Payments to this meel come from the <Link to="/sarafs" className="text-[#0F5257] hover:text-[#14B8A6] font-medium underline">Saraf</Link>.
      </div>

      {/* Bills Written via this meel */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <Truck size={16} /> Bills Written / بل‌های نوشته‌شده
          </h3>
          <button
            onClick={openNewDispatch}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F5257] text-white rounded-lg text-sm font-medium hover:bg-[#14B8A6] transition-colors"
          >
            <Plus size={14} /> Write New Bill
          </button>
        </div>

        {dispatches.length > 0 && (
          <div className="px-5 py-3 border-b border-slate-100 bg-slate-50/60">
            <input
              type="text"
              value={billSearch}
              onChange={e => setBillSearch(e.target.value)}
              placeholder="Search by bill #, client, or dana type..."
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30"
            />
            {billSearch && (
              <p className="text-xs text-slate-500 mt-2">{filteredDispatches.length} of {dispatches.length} bills</p>
            )}
          </div>
        )}

        {dispatches.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">{t('suppliers.noDispatches')}</p>
        ) : filteredDispatches.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">No bills match "{billSearch}"</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {filteredDispatches.map(d => (
              <div key={d.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-400">{t('common.date')}</div>
                    <div className="font-medium">{formatDate(d.dispatch_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t('suppliers.billNumber')}</div>
                    <div className="font-bold text-slate-700">{d.bill_number || '—'}</div>
                    {d.product_name && <div className="text-xs text-slate-400 mt-0.5">{d.product_name}</div>}
                    {d.farms && <div className="text-xs text-amber-600 mt-0.5 truncate">👤 {lf(d.farms, 'name', lang)}</div>}
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t('suppliers.danaType')}</div>
                    {d.dana_type ? (() => {
                      const opt = DANA_OPTIONS.find(o => o.value === d.dana_type)
                      return opt ? (
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5 ${opt.color}`}>
                          {t(`suppliers.${opt.labelKey}`)}
                        </span>
                      ) : <div className="text-slate-400">—</div>
                    })() : <div className="text-slate-400">—</div>}
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t('suppliers.bags')}</div>
                    <div className="font-bold text-blue-600">{d.quantity}</div>
                    {d.weight_kg && <div className="text-xs text-slate-400">{d.weight_kg} kg</div>}
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t('common.total')}</div>
                    <div className="font-medium text-red-600">{formatCurrency(d.total_amount)}</div>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => printBill(d)} title={t('danaBill.pdf')} className="p-1.5 text-slate-500 hover:text-[#0F5257] hover:bg-slate-100 rounded-lg">
                    <FileText size={14} />
                  </button>
                  <button onClick={() => openEditDispatch(d)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setDeleteTarget({ type: 'dispatch', item: d })} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payments Made */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <CreditCard size={16} /> {t('suppliers.payments')}
          </h3>
          <button
            onClick={openNewPayment}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
          >
            <Plus size={14} /> {t('suppliers.recordPayment')}
          </button>
        </div>

        {payments.length === 0 ? (
          <p className="text-center py-8 text-slate-400 text-sm">{t('suppliers.noPayments')}</p>
        ) : (
          <div className="divide-y divide-slate-50">
            {payments.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center gap-3">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-sm">
                  <div>
                    <div className="text-xs text-slate-400">{t('common.date')}</div>
                    <div className="font-medium">{formatDate(p.payment_date)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400">{t('common.amount')}</div>
                    <div className="font-bold text-green-600">{formatCurrency(p.amount)}</div>
                  </div>
                  {p.notes && (
                    <div>
                      <div className="text-xs text-slate-400">{t('common.notes')}</div>
                      <div className="text-slate-600 text-xs">{p.notes}</div>
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEditPayment(p)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={() => setDeleteTarget({ type: 'payment', item: p })} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dispatch Modal (Add + Edit) */}
      <Modal
        open={dispatchModal}
        onClose={() => { setDispatchModal(false); setEditDispatch(null) }}
        title={editDispatch ? t('suppliers.editDispatch') : t('suppliers.writeBill')}
        size="lg"
      >
        <form onSubmit={handleDispatch} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.product')} *</label>
              <select
                required
                value={dispatchForm.product_name}
                onChange={e => setDispatchForm(f => ({ ...f, product_name: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30"
              >
                <option value="">{t('suppliers.selectProduct')}</option>
                {FEED_TYPES.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.billNumber')} *</label>
              <input
                required
                type="text"
                value={dispatchForm.bill_number}
                onChange={e => setDispatchForm(f => ({ ...f, bill_number: e.target.value }))}
                placeholder="e.g. BL-1042"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30"
              />
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-2">{t('suppliers.danaType')} *</label>
              <div className="flex flex-wrap gap-2">
                {DANA_OPTIONS.map(opt => {
                  const selected = dispatchForm.dana_type === opt.value
                  return (
                    <label key={opt.value} className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 cursor-pointer transition-all text-sm font-medium select-none
                      ${selected ? DANA_SELECTED_COLORS[opt.value] : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                      <input
                        type="radio"
                        name="dana_type"
                        value={opt.value}
                        required
                        checked={selected}
                        onChange={e => setDispatchForm(f => ({ ...f, dana_type: e.target.value }))}
                        className="sr-only"
                      />
                      <span className={`w-3 h-3 rounded-full border-2 flex items-center justify-center shrink-0
                        ${selected ? DANA_DOT_COLORS[opt.value].split(' ')[0] : 'border-slate-300'}`}>
                        {selected && <span className={`w-1.5 h-1.5 rounded-full ${DANA_DOT_COLORS[opt.value].split(' ')[1]}`} />}
                      </span>
                      {t(`suppliers.${opt.labelKey}`)}
                    </label>
                  )
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.dispatchDate')}</label>
              <input type="date" value={dispatchForm.dispatch_date}
                onChange={e => setDispatchForm(f => ({ ...f, dispatch_date: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.bags')} *</label>
              <input required type="number" min="1" step="1" value={dispatchForm.quantity}
                onChange={e => setDispatchForm(f => ({ ...f, quantity: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.pricePerBag')} *</label>
              <input required type="number" min="0" step="0.01" value={dispatchForm.price_per_bag}
                onChange={e => setDispatchForm(f => ({ ...f, price_per_bag: e.target.value }))}
                className="w-full px-3 py-2 border border-red-200 bg-red-50/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-300" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.sellPricePerBag')}</label>
              <input type="number" min="0" step="0.01" value={dispatchForm.sell_price_per_bag}
                onChange={e => setDispatchForm(f => ({ ...f, sell_price_per_bag: e.target.value }))}
                placeholder={t('common.optional')}
                className="w-full px-3 py-2 border border-green-200 bg-green-50/30 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-300" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.weightKg')} — {t('common.optional')}</label>
              <input type="number" min="0" step="0.1" value={dispatchForm.weight_kg}
                onChange={e => setDispatchForm(f => ({ ...f, weight_kg: e.target.value }))}
                placeholder={t('common.optional')}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('suppliers.commissionPerBag')}</label>
              <input type="number" min="0" step="0.01" value={dispatchForm.commission_per_bag}
                onChange={e => setDispatchForm(f => ({ ...f, commission_per_bag: e.target.value }))}
                placeholder="0"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
            </div>

            {qty > 0 && pricePerBag > 0 && (
              <div className="col-span-2 bg-slate-50 rounded-lg p-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-slate-500">{t('suppliers.totalAmount')}:</span>
                  <span className="font-bold text-red-600 ms-2">{formatCurrency(dispatchTotal)}</span>
                </div>
                {commissionPerBag > 0 && (
                  <div>
                    <span className="text-slate-500">{t('suppliers.totalCommission')}:</span>
                    <span className="font-bold text-purple-600 ms-2">{formatCurrency(dispatchCommission)}</span>
                  </div>
                )}
                {sellPricePerBag > 0 && (
                  <div className="col-span-2 pt-2 border-t border-slate-200">
                    <span className="text-slate-500">{t('common.profit')} ({t('suppliers.sellPricePerBag')} − {t('suppliers.pricePerBag')}) × {t('suppliers.bags')}:</span>
                    <span className={`font-bold ms-2 ${expectedProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {formatCurrency(expectedProfit)}
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
              <input value={dispatchForm.notes}
                onChange={e => setDispatchForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => { setDispatchModal(false); setEditDispatch(null) }}
              className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#0F5257] text-white rounded-lg hover:bg-[#14B8A6] disabled:opacity-60">
              {saving ? t('common.saving') : editDispatch ? t('common.saveChanges') : t('suppliers.writeBill')}
            </button>
          </div>
        </form>
      </Modal>

      {/* Payment Modal (Add + Edit) */}
      <Modal
        open={paymentModal}
        onClose={() => { setPaymentModal(false); setEditPayment(null) }}
        title={editPayment ? t('suppliers.editPayment') : t('suppliers.recordPayment')}
      >
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
          {!editPayment && (
            <label className="flex items-center gap-2 text-sm text-slate-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2 cursor-pointer">
              <input type="checkbox" checked={paymentFromStoreCash} onChange={e => setPaymentFromStoreCash(e.target.checked)} className="rounded" />
              💵 {t('storeCash.fromStoreCash')}
            </label>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => { setPaymentModal(false); setEditPayment(null) }}
              className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-green-700 text-white rounded-lg hover:bg-green-800 disabled:opacity-60">
              {saving ? t('common.saving') : editPayment ? t('common.saveChanges') : t('suppliers.recordPayment')}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (deleteTarget.type === 'dispatch') await deleteDispatch(deleteTarget.item)
          else { await deletePayment(deleteTarget.item.id); await removeByReference(deleteTarget.item.id) }
        }}
        title={t('common.delete')}
        message={deleteTarget?.type === 'dispatch'
          ? t('suppliers.dispatchDeleted') + '?'
          : t('suppliers.paymentDeleted') + '?'
        }
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
