import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../../config/supabase'
import Modal from './Modal'
import PhoneInput from './PhoneInput'
import { useFarms } from '../../hooks/useFarms'
import { useInventory } from '../../hooks/useInventory'
import { useSuppliers } from '../../hooks/useSuppliers'
import { useDispatches } from '../../hooks/useDispatches'
import { usePayments } from '../../hooks/usePayments'
import { useExpenses } from '../../hooks/useExpenses'
import { useCashLedger } from '../../hooks/useCashLedger'
import { useStoreCash } from '../../contexts/StoreCashContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { lf } from '../../utils/localizedField'
import { todayStr } from '../../utils/dateHelpers'
import { formatCurrency } from '../../utils/formatCurrency'

const TYPES = [
  { key: 'dispatch', icon: '🚚', label: 'Dispatch / ارسال',   sub: 'Send items to a farm / client' },
  { key: 'bill',     icon: '📋', label: 'Meel Bill / بل دانه', sub: 'Write a Dana bill via a meel supplier' },
  { key: 'payment',  icon: '💵', label: 'Payment IN / پرداخت', sub: 'Money received from farm / client' },
  { key: 'expense',  icon: '🧾', label: 'Expense / مصرف',     sub: 'Money paid out for shop expenses' },
  { key: 'cash',     icon: '🤝', label: 'Cash Ledger / دفتر قرض', sub: 'Lend / borrow money to / from a person' },
  { key: 'stock',    icon: '📦', label: 'Stock In / موجودی',  sub: 'Restock medicine or feed (opens Inventory)' },
]

const EXPENSE_CATS = ['fuel', 'salary', 'rent', 'maintenance', 'utilities', 'other']

const emptyDisp = { farm_id: '', product_id: '', quantity: '1', sell_price: '', purchase_price: '', date: todayStr(), notes: '' }
const emptyBill = { farm_id: '', supplier_id: '', bill_number: '', quantity: '', price_per_bag: '', date: todayStr(), notes: '' }
const emptyPay  = { farm_id: '', amount: '', date: todayStr(), notes: '' }
const emptyExp  = { title: '', amount: '', category: 'other', date: todayStr(), notes: '' }
const emptyCash  = { person_name: '', phone: '', amount: '', cashType: 'lent', date: todayStr(), notes: '' }
const emptyStock = { product_id: '', quantity: '', purchase_price: '', batch_number: '', date: todayStr(), notes: '' }

// Maps a Roznamcha feed entry._type to the modal's internal type key.
const EDIT_TYPE_MAP = { dispatch: 'dispatch', payment: 'payment', expense: 'expense', cash_ledger: 'cash' }

// One unified "notebook" entry form: pick a type, fill a few fields,
// and the right underlying record is created (+ cash drawer updated).
// When `editEntry` is passed, the modal opens in edit mode for that record.
export default function QuickEntryModal({ open, onClose, onCreated, editEntry = null }) {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const { farms } = useFarms()
  const { products, addStockPurchase } = useInventory()
  const { suppliers } = useSuppliers()
  const { createDispatch, updateDispatch } = useDispatches()
  const { recordPayment, updatePayment } = usePayments()
  const { addExpense, updateExpense } = useExpenses()
  const { addTransaction: addCash, updateTransaction: updateCash } = useCashLedger()
  const { recordIn, recordOut, removeByReference } = useStoreCash()

  const isEdit = !!editEntry

  const [type, setType] = useState('dispatch')
  const [storeCash, setStoreCash] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dispForm, setDispForm] = useState(emptyDisp)
  const [billForm, setBillForm] = useState(emptyBill)
  const [payForm,  setPayForm]  = useState(emptyPay)
  const [expForm,  setExpForm]  = useState(emptyExp)
  const [cashForm, setCashForm] = useState(emptyCash)
  const [editDispatch, setEditDispatch] = useState(null) // full old dispatch (with items) for edits

  // Pre-fill the form when opening in edit mode.
  useEffect(() => {
    if (!open || !editEntry) return
    const mt = EDIT_TYPE_MAP[editEntry._type]
    if (!mt) return
    setType(mt)
    if (mt === 'payment') {
      setPayForm({ farm_id: editEntry.farm_id || '', amount: String(editEntry.amount ?? ''), date: editEntry.payment_date || todayStr(), notes: editEntry.notes || '' })
    } else if (mt === 'expense') {
      setExpForm({ title: editEntry.title || '', amount: String(editEntry.amount ?? ''), category: editEntry.category || 'other', date: editEntry.expense_date || todayStr(), notes: editEntry.notes || '' })
    } else if (mt === 'cash') {
      setCashForm({ person_name: editEntry.person_name || '', phone: editEntry.phone || '', amount: String(editEntry.amount ?? ''), cashType: editEntry.type || 'lent', date: editEntry.transaction_date || todayStr(), notes: editEntry.note || '' })
    } else if (mt === 'dispatch') {
      ;(async () => {
        const { data } = await supabase.from('dispatches').select('*, dispatch_items(*)').eq('id', editEntry.id).single()
        setEditDispatch(data || null)
        const item = data?.dispatch_items?.[0]
        setDispForm({
          farm_id: data?.farm_id || '',
          product_id: item?.product_id || '',
          quantity: String(item?.quantity ?? '1'),
          sell_price: String(item?.sell_price_at_time ?? ''),
          purchase_price: String(item?.purchase_price_at_time ?? ''),
          date: data?.dispatch_date || todayStr(),
          notes: data?.notes || '',
        })
      })()
    }
    // Default the store-cash checkbox to whether a linked movement already exists.
    if (mt === 'payment' || mt === 'expense' || mt === 'cash') {
      ;(async () => {
        const { data } = await supabase.from('cash_movements').select('id').eq('reference_id', editEntry.id).limit(1)
        setStoreCash((data?.length || 0) > 0)
      })()
    }
  }, [open, editEntry])

  function reset() {
    setDispForm({ ...emptyDisp, date: todayStr() })
    setBillForm({ ...emptyBill, date: todayStr() })
    setPayForm({ ...emptyPay, date: todayStr() })
    setExpForm({ ...emptyExp, date: todayStr() })
    setCashForm({ ...emptyCash, date: todayStr() })
    setEditDispatch(null)
    setStoreCash(true)
    setType('dispatch')
  }

  function goToInventory(tab) {
    reset()
    onClose()
    navigate(`/inventory?tab=${tab}`)
  }

  function handleProductPick(productId) {
    const p = products.find(x => x.id === productId)
    setDispForm(f => ({
      ...f, product_id: productId,
      sell_price: String(p?.sell_price ?? ''),
      purchase_price: String(p?.purchase_price ?? ''),
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    let ok = false

    try {
      if (type === 'dispatch') {
        if (!dispForm.farm_id || !dispForm.product_id) { toast.error('Pick an entity and a product'); return }
        const qty = parseFloat(dispForm.quantity) || 0
        const sellPrice = parseFloat(dispForm.sell_price) || 0
        const total = qty * sellPrice
        if (qty <= 0 || sellPrice <= 0) { toast.error('Quantity and price must be > 0'); return }
        if (isEdit) {
          const oldItem = editDispatch?.dispatch_items?.[0]
          ok = await updateDispatch(
            editEntry.id, editDispatch,
            { dispatch_date: dispForm.date, notes: dispForm.notes || null },
            [{
              product_id: dispForm.product_id,
              quantity: qty,
              sell_price_at_time: sellPrice,
              purchase_price_at_time: parseFloat(dispForm.purchase_price) || 0,
              supplier_dispatch_id: oldItem?.supplier_dispatch_id || null,
              batch_number: oldItem?.batch_number || null,
            }],
          )
        } else {
          ok = await createDispatch(
            { farm_id: dispForm.farm_id, dispatch_date: dispForm.date, total_amount: total, notes: dispForm.notes || null },
            [{
              product_id: dispForm.product_id,
              quantity: qty,
              sell_price: sellPrice,
              purchase_price: parseFloat(dispForm.purchase_price) || 0,
            }],
          )
        }
      } else if (type === 'bill') {
        // Broker Meel Bill — same as NewDispatch's "write new bill" path, just
        // condensed: pick farm/client + meel + bill # + bags + price. Creates
        // supplier_dispatches (the bill), dispatch_items (linked via
        // supplier_dispatch_id), and the parent dispatch; updates farm.total_debt.
        if (!billForm.farm_id) { toast.error('Pick a farm / client'); return }
        if (!billForm.supplier_id) { toast.error('Pick a Meel supplier'); return }
        const billNo = (billForm.bill_number || '').trim()
        if (!billNo) { toast.error('Bill # is required'); return }
        const bags = parseFloat(billForm.quantity) || 0
        const price = parseFloat(billForm.price_per_bag) || 0
        if (bags <= 0) { toast.error('Bags must be > 0'); return }
        if (price <= 0) { toast.error('Price per bag must be > 0'); return }

        // Unique bill # per supplier
        const { data: clash } = await supabase
          .from('supplier_dispatches')
          .select('id').eq('supplier_id', billForm.supplier_id).ilike('bill_number', billNo).limit(1)
        if (clash && clash.length > 0) {
          const sup = suppliers.find(s => s.id === billForm.supplier_id)
          toast.error(`Bill # ${billNo} already exists for ${sup?.company_name || 'this supplier'}`); return
        }

        // Resolve or create the Feed (Dana) product row to satisfy dispatch_items.product_id.
        let productId = null
        const { data: existing } = await supabase.from('products').select('id').eq('type', 'meel').limit(1).maybeSingle()
        if (existing) productId = existing.id
        else {
          const { data: created } = await supabase.from('products').insert([{
            name: 'Feed (Dana)', type: 'meel', unit: 'bag', quantity: 0, purchase_price: price, sell_price: price,
          }]).select('id').single()
          productId = created?.id
        }
        if (!productId) { toast.error('Could not resolve Feed (Dana) product'); return }

        const total = bags * price

        // Insert the bill (supplier_dispatches row) — no stock change.
        const { data: newBill, error: billErr } = await supabase.from('supplier_dispatches').insert([{
          supplier_id: billForm.supplier_id,
          product_id: productId,
          product_name: 'Feed (Dana)',
          bill_number: billNo,
          dispatch_date: billForm.date,
          quantity: bags,
          price_per_bag: price,
          sell_price_per_bag: price,
          total_amount: total,
          notes: billForm.notes || null,
        }]).select('id').single()
        if (billErr) { toast.error(billErr.message); return }

        // Use createDispatch so the farm side + Roznamcha entries are created
        // through the same pipeline as a regular dispatch.
        ok = await createDispatch(
          { farm_id: billForm.farm_id, dispatch_date: billForm.date, total_amount: total, notes: billForm.notes || null },
          [{
            product_id: productId,
            quantity: bags,
            sell_price: price,
            purchase_price: price,
            batch_number: billNo,
            supplier_dispatch_id: newBill.id,
          }],
        )
      } else if (type === 'payment') {
        if (!payForm.farm_id) { toast.error('Pick a farm / client'); return }
        const amt = parseFloat(payForm.amount) || 0
        if (amt <= 0) { toast.error('Amount must be > 0'); return }
        if (isEdit) {
          ok = await updatePayment(editEntry.id, editEntry.amount || 0, payForm.farm_id, { amount: amt, payment_date: payForm.date, notes: payForm.notes || null })
          if (ok) {
            await removeByReference(editEntry.id)
            if (storeCash) {
              const farm = farms.find(f => f.id === payForm.farm_id)
              await recordIn({ amount: amt, source: 'payment', reference_id: editEntry.id, note: lf(farm, 'name', lang) || farm?.name, date: payForm.date })
            }
          }
        } else {
          const result = await recordPayment({
            farm_id: payForm.farm_id, amount: amt,
            payment_date: payForm.date, notes: payForm.notes || null,
          })
          if (result) {
            if (storeCash) {
              const farm = farms.find(f => f.id === payForm.farm_id)
              await recordIn({ amount: amt, source: 'payment', reference_id: result.id, note: lf(farm, 'name', lang) || farm?.name, date: payForm.date })
            }
            ok = true
          }
        }
      } else if (type === 'expense') {
        if (!expForm.title?.trim()) { toast.error('Title is required'); return }
        const amt = parseFloat(expForm.amount) || 0
        if (amt <= 0) { toast.error('Amount must be > 0'); return }
        if (isEdit) {
          ok = await updateExpense(editEntry.id, {
            title: expForm.title.trim(), amount: amt, category: expForm.category,
            expense_date: expForm.date, notes: expForm.notes || null,
          })
          if (ok) {
            await removeByReference(editEntry.id)
            if (storeCash) await recordOut({ amount: amt, source: 'expense', reference_id: editEntry.id, note: expForm.title.trim(), date: expForm.date })
          }
        } else {
          const result = await addExpense({
            title: expForm.title.trim(), amount: amt, category: expForm.category,
            expense_date: expForm.date, notes: expForm.notes || null,
          })
          if (result) {
            if (storeCash) {
              await recordOut({ amount: amt, source: 'expense', reference_id: result.id, note: expForm.title.trim(), date: expForm.date })
            }
            ok = true
          }
        }
      } else if (type === 'cash') {
        if (!cashForm.person_name?.trim()) { toast.error('Person name is required'); return }
        const amt = parseFloat(cashForm.amount) || 0
        if (amt <= 0) { toast.error('Amount must be > 0'); return }
        if (isEdit) {
          ok = await updateCash(editEntry.id, {
            person_name: cashForm.person_name, phone: cashForm.phone,
            amount: amt, type: cashForm.cashType,
            note: cashForm.notes, transaction_date: cashForm.date,
          })
          if (ok) {
            await removeByReference(editEntry.id)
            if (storeCash) {
              const payload = { amount: amt, source: 'loan', reference_id: editEntry.id, note: cashForm.person_name.trim(), date: cashForm.date }
              if (cashForm.cashType === 'lent') await recordOut(payload)
              else await recordIn(payload)
            }
          }
        } else {
          const result = await addCash({
            person_name: cashForm.person_name, phone: cashForm.phone,
            amount: amt, type: cashForm.cashType,
            note: cashForm.notes, transaction_date: cashForm.date,
          })
          if (result) {
            if (storeCash) {
              const payload = { amount: amt, source: 'loan', reference_id: result.id, note: cashForm.person_name.trim(), date: cashForm.date }
              if (cashForm.cashType === 'lent') await recordOut(payload)
              else await recordIn(payload)
            }
            ok = true
          }
        }
      }
    } finally {
      setSaving(false)
    }

    if (ok) {
      reset()
      onCreated?.(isEdit)
      onClose()
    }
  }

  const activeFarms = farms.filter(f => f.is_active && f.kind !== 'client')
  const activeClients = farms.filter(f => f.is_active && f.kind === 'client')
  const selectedProduct = products.find(p => p.id === dispForm.product_id)
  const dispTotal = (parseFloat(dispForm.quantity) || 0) * (parseFloat(dispForm.sell_price) || 0)

  const showStoreCashBox = type !== 'dispatch' && type !== 'stock'
  const storeCashLabel = type === 'payment'
    ? t('storeCash.addToStoreCash')
    : type === 'expense'
    ? t('storeCash.fromStoreCash')
    : type === 'cash'
    ? (cashForm.cashType === 'lent' ? t('storeCash.fromStoreCash') : t('storeCash.addToStoreCash'))
    : ''
  const storeCashColor = type === 'expense' || (type === 'cash' && cashForm.cashType === 'lent')
    ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700'

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title={isEdit ? '✏️ Edit Roznamcha Entry' : '📓 New Roznamcha Entry'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type selector — hidden in edit mode (the type can't change) */}
        {!isEdit && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {TYPES.map(tt => (
              <button
                key={tt.key}
                type="button"
                onClick={() => setType(tt.key)}
                className={`px-3 py-3 rounded-xl border-2 text-center transition-colors ${type === tt.key ? 'border-[#0F5257] bg-[#0F5257] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
              >
                <div className="text-xl">{tt.icon}</div>
                <div className="text-xs font-semibold mt-1">{tt.label}</div>
                <div className={`text-[10px] mt-0.5 ${type === tt.key ? 'text-white/70' : 'text-slate-400'}`}>{tt.sub}</div>
              </button>
            ))}
          </div>
        )}

        {/* Dispatch fields */}
        {type === 'dispatch' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Send to *</label>
              <select required disabled={isEdit} value={dispForm.farm_id} onChange={e => setDispForm(f => ({ ...f, farm_id: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30 disabled:bg-slate-100 disabled:text-slate-500">
                <option value="">— pick farm or client —</option>
                {activeFarms.length > 0 && (
                  <optgroup label="🏠 Farms / فارم‌ها">
                    {activeFarms.map(f => <option key={f.id} value={f.id}>{lf(f, 'name', lang)}</option>)}
                  </optgroup>
                )}
                {activeClients.length > 0 && (
                  <optgroup label="🏪 Clients / مشتریان">
                    {activeClients.map(f => <option key={f.id} value={f.id}>{lf(f, 'name', lang)}</option>)}
                  </optgroup>
                )}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Product *</label>
              <select required value={dispForm.product_id} onChange={e => handleProductPick(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                <option value="">— pick a product —</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {p.type} (stock: {p.quantity} {p.unit || ''})</option>
                ))}
              </select>
              {selectedProduct && (
                <p className="text-xs text-slate-400 mt-1">In stock: {selectedProduct.quantity} {selectedProduct.unit}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Quantity *</label>
                <input required type="number" min="0.01" step="0.01" value={dispForm.quantity}
                  onChange={e => setDispForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Sell price (AFN) *</label>
                <input required type="number" min="0" step="0.01" value={dispForm.sell_price}
                  onChange={e => setDispForm(f => ({ ...f, sell_price: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
                <input type="date" value={dispForm.date} onChange={e => setDispForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
                <input value={dispForm.notes} onChange={e => setDispForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
            </div>
            {dispTotal > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm flex justify-between">
                <span className="text-slate-600">Total</span>
                <span className="font-bold text-[#0F5257]">{formatCurrency(dispTotal)}</span>
              </div>
            )}
            <p className="text-xs text-slate-400">Need multiple products in one dispatch? Use the full <strong>Dispatches → New Dispatch</strong> wizard.</p>
          </div>
        )}

        {/* Meel Bill fields — broker flow */}
        {type === 'bill' && (() => {
          const meelSuppliers = suppliers.filter(s => (s.type || 'meel') === 'meel')
          const billTotal = (parseFloat(billForm.quantity) || 0) * (parseFloat(billForm.price_per_bag) || 0)
          return (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Send to *</label>
                <select required value={billForm.farm_id} onChange={e => setBillForm(f => ({ ...f, farm_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                  <option value="">— pick farm or client —</option>
                  {activeFarms.length > 0 && (
                    <optgroup label="🏠 Farms / فارم‌ها">
                      {activeFarms.map(f => <option key={f.id} value={f.id}>{lf(f, 'name', lang)}</option>)}
                    </optgroup>
                  )}
                  {activeClients.length > 0 && (
                    <optgroup label="🏪 Clients / مشتریان">
                      {activeClients.map(f => <option key={f.id} value={f.id}>{lf(f, 'name', lang)}</option>)}
                    </optgroup>
                  )}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Meel supplier *</label>
                <select required value={billForm.supplier_id} onChange={e => setBillForm(f => ({ ...f, supplier_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                  <option value="">— pick a meel —</option>
                  {meelSuppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                </select>
                {meelSuppliers.length === 0 && (
                  <p className="text-xs text-amber-700 mt-1">No meel suppliers yet — add one under Suppliers first.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Bill # *</label>
                  <input required value={billForm.bill_number}
                    onChange={e => setBillForm(f => ({ ...f, bill_number: e.target.value }))}
                    placeholder="e.g. 123"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Bags *</label>
                  <input required type="number" min="0.01" step="0.01" value={billForm.quantity}
                    onChange={e => setBillForm(f => ({ ...f, quantity: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Price / bag (AFN) *</label>
                  <input required type="number" min="0.01" step="0.01" value={billForm.price_per_bag}
                    onChange={e => setBillForm(f => ({ ...f, price_per_bag: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
                  <input type="date" value={billForm.date} onChange={e => setBillForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
                <input value={billForm.notes} onChange={e => setBillForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
              {billTotal > 0 && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm flex justify-between">
                  <span className="text-slate-600">Total</span>
                  <span className="font-bold text-[#0F5257]">{formatCurrency(billTotal)}</span>
                </div>
              )}
              <p className="text-xs text-slate-400">No inventory is touched — Anas Hadi only writes the bill. Client picks up Dana from the meel directly; settlement happens via Saraf.</p>
            </div>
          )
        })()}

        {/* Payment IN fields */}
        {type === 'payment' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Payment from *</label>
              <select required disabled={isEdit} value={payForm.farm_id} onChange={e => setPayForm(f => ({ ...f, farm_id: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30 disabled:bg-slate-100 disabled:text-slate-500">
                <option value="">— pick farm or client —</option>
                {activeFarms.length > 0 && (
                  <optgroup label="🏠 Farms / فارم‌ها">
                    {activeFarms.map(f => <option key={f.id} value={f.id}>{lf(f, 'name', lang)}</option>)}
                  </optgroup>
                )}
                {activeClients.length > 0 && (
                  <optgroup label="🏪 Clients / مشتریان">
                    {activeClients.map(f => <option key={f.id} value={f.id}>{lf(f, 'name', lang)}</option>)}
                  </optgroup>
                )}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('payments.amountAFN')} *</label>
                <input required type="number" min="0.01" step="0.01" value={payForm.amount}
                  onChange={e => setPayForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
                <input type="date" value={payForm.date} onChange={e => setPayForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
              <input value={payForm.notes} onChange={e => setPayForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
            </div>
          </div>
        )}

        {/* Expense fields */}
        {type === 'expense' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Title *</label>
              <input required value={expForm.title} onChange={e => setExpForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. fuel, salary, utilities..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Category</label>
                <select value={expForm.category} onChange={e => setExpForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                  {EXPENSE_CATS.map(c => <option key={c} value={c}>{t(`expenses.categories.${c}`)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.amount')} (AFN) *</label>
                <input required type="number" min="0.01" step="0.01" value={expForm.amount}
                  onChange={e => setExpForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
                <input type="date" value={expForm.date} onChange={e => setExpForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
                <input value={expForm.notes} onChange={e => setExpForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
            </div>
          </div>
        )}

        {/* Cash Ledger fields */}
        {type === 'cash' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setCashForm(f => ({ ...f, cashType: 'lent' }))}
                className={`px-3 py-2 rounded-lg border-2 text-sm font-medium ${cashForm.cashType === 'lent' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600'}`}>
                ↗ I Gave (Lent)
              </button>
              <button type="button" onClick={() => setCashForm(f => ({ ...f, cashType: 'borrowed' }))}
                className={`px-3 py-2 rounded-lg border-2 text-sm font-medium ${cashForm.cashType === 'borrowed' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-600'}`}>
                ↘ I Received (Borrowed)
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Person name *</label>
                <input required value={cashForm.person_name} onChange={e => setCashForm(f => ({ ...f, person_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('cashLedger.phone')}</label>
                <PhoneInput value={cashForm.phone} onChange={v => setCashForm(f => ({ ...f, phone: v }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.amount')} (AFN) *</label>
                <input required type="number" min="0.01" step="0.01" value={cashForm.amount}
                  onChange={e => setCashForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
                <input type="date" value={cashForm.date} onChange={e => setCashForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
              <input value={cashForm.notes} onChange={e => setCashForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
            </div>
          </div>
        )}

        {/* Stock In — two shortcut buttons that jump to the Inventory page */}
        {type === 'stock' && (
          <div className="space-y-3">
            <p className="text-sm text-slate-500 text-center">Pick a category — you'll be taken to the Inventory page to add the stock there.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => goToInventory('medicine')}
                className="px-4 py-6 rounded-xl border-2 border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-center"
              >
                <div className="text-3xl mb-2">💊</div>
                <div className="text-base font-semibold">Medicine / دوا</div>
                <div className="text-xs text-blue-600 mt-0.5">Go to Inventory → Medicines</div>
              </button>
              <button
                type="button"
                onClick={() => goToInventory('meel')}
                className="px-4 py-6 rounded-xl border-2 border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors text-center"
              >
                <div className="text-3xl mb-2">🌾</div>
                <div className="text-base font-semibold">Dana (Feed) / دانه</div>
                <div className="text-xs text-amber-600 mt-0.5">Go to Inventory → Feed</div>
              </button>
            </div>
          </div>
        )}

        {/* Store cash toggle (not for dispatch which doesn't directly move cash unless pay-now) */}
        {showStoreCashBox && (
          <label className={`flex items-center gap-2 text-sm cursor-pointer border rounded-lg px-3 py-2 ${storeCashColor}`}>
            <input type="checkbox" checked={storeCash} onChange={e => setStoreCash(e.target.checked)} className="rounded" />
            💵 {storeCashLabel}
          </label>
        )}

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={() => { reset(); onClose() }} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
          {type !== 'stock' && (
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#0F5257] text-white rounded-lg hover:bg-[#14B8A6] disabled:opacity-60">
              {saving ? t('common.saving') : isEdit ? t('common.save') : '+ Add Entry'}
            </button>
          )}
        </div>
      </form>
    </Modal>
  )
}
