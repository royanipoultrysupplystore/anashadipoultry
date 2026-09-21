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
import { useSupplyPayments } from '../../hooks/useSupplyPayments'
import { useMeelBills } from '../../hooks/useMeelBills'
import { useSarafs } from '../../hooks/useSarafs'
import { useStoreCash } from '../../contexts/StoreCashContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { lf } from '../../utils/localizedField'
import { todayStr } from '../../utils/dateHelpers'
import { formatCurrency } from '../../utils/formatCurrency'
import { SUPPLY_ITEM_BI } from '../../utils/biLabels'

const TYPES = [
  { key: 'dispatch', icon: '🚚', label: 'Dispatch / ارسال',   sub: 'Send items to a farm / client' },
  { key: 'bill',     icon: '📋', label: 'Meel Bill / بل دانه', sub: 'Write a Dana bill via a meel supplier' },
  { key: 'payment',  icon: '💵', label: 'Payment IN / پرداخت', sub: 'Money received from farm / client' },
  { key: 'expense',  icon: '🧾', label: 'Expense / مصرف',     sub: 'Money paid out for shop expenses' },
  { key: 'supply',   icon: '🛍️', label: 'Supply / تدارکات',   sub: 'Supplies given to a farm (adds to debt)' },
  { key: 'cash',     icon: '🤝', label: 'Cash Ledger / دفتر قرض', sub: 'Lend / borrow money to / from a person' },
  { key: 'saraf',    icon: '🔁', label: 'Saraf / صراف',      sub: 'Record money IN / OUT via a Saraf' },
  { key: 'stock',    icon: '📦', label: 'Stock In / موجودی',  sub: 'Restock medicine or feed (opens Inventory)' },
]

const EXPENSE_CATS = ['fuel', 'salary', 'rent', 'maintenance', 'utilities', 'other']

// Mirrors SUPPLY_ITEMS in SupplyPayments.jsx — 'Other' lets a free-text item be typed.
const SUPPLY_ITEMS = ['Sugar', 'Coal', 'Wood Flour', 'Other']

const DANA_OPTIONS = [
  { value: '4_number',  labelKey: 'dana4Number' },
  { value: '6_number',  labelKey: 'dana6Number' },
  { value: '9_number',  labelKey: 'dana9Number' },
  { value: '12_number', labelKey: 'dana12Number' },
  { value: 'other',     labelKey: 'danaOther' },
]

// choza_* fields only apply when the picked product is a choza (chick) product:
// they tie the dispatched chicks to one supplier lot instead of the shared pool.
// A new dispatch is either 'meel' (pick a supplier bill) or 'choza' (pick a
// supplier lot); both derive the product from that choice, so the shared pooled
// product rows stay out of the dispatch flow entirely.
const emptyDisp = {
  farm_id: '', disp_mode: 'meel', product_id: '', quantity: '1', sell_price: '', purchase_price: '',
  date: todayStr(), notes: '',
  choza_supplier_id: '', choza_source: 'existing', choza_lot_id: '', choza_type: '', choza_type_custom: '',
  choza_subtype: '', choza_buy_count: '',
  meel_supplier_id: '', meel_source: 'existing', meel_bill_id: '',
  meel_product_name: '', meel_dana_type: '9_number', meel_bill_number: '', meel_buy_bags: '',
  vac_supplier_id: '', vac_source: 'existing', vac_lot_id: '', vac_name: '', vac_name_custom: '', vac_buy_count: '',
  med_supplier_id: '', med_source: 'existing', med_lot_id: '', med_name: '', med_name_custom: '', med_unit: '', med_buy_count: '',
}
// Sentinel for "the type I want isn't listed" in the choza type dropdown.
const NEW_CHOZA_TYPE = '__new__'

// The vaccines actually dispatched. Not exhaustive — "＋ New vaccine…" records
// anything missing, and it then shows up here from the product rows.
const VACCINE_NAMES = [
  'Bio ND + IB Live',
  'Bio IBD Live – Strain B87',
  'Bio IBD W2512 Live',
  'Bio IB H120 Live',
  'Bio ND LaSota Live',
  'Bio ND Clone 30 Live',
  'Bio NDV Live – Strain HB1',
  'Bio Multi IB Live',
  'Bio ND + IB + AI Killed',
  'Bio ND + AI Killed',
  'Bio ND + IB + AI + IBD + AD Killed',
]

// Medicine keeps its own product rows; a new name is created on first use.
async function getOrCreateMedicineProduct(name, price, unit) {
  const { data: existing } = await supabase
    .from('products').select('id, quantity').eq('name', name).eq('type', 'medicine').limit(1)
  if (existing && existing.length > 0) return existing[0]
  const { data: created } = await supabase.from('products').insert([{
    name, type: 'medicine', unit: unit || 'unit', quantity: 0,
    purchase_price: price, sell_price: price, low_stock_threshold: 10,
  }]).select().single()
  return created
}

// One product row per vaccine, created on first use so Inventory keeps working.
async function getOrCreateVaccineProduct(vaccineName, pricePerUnit) {
  const { data: existing } = await supabase
    .from('products').select('id, quantity').eq('name', vaccineName).eq('type', 'vaccine').limit(1)
  if (existing && existing.length > 0) return existing[0]
  const { data: created } = await supabase.from('products').insert([{
    name: vaccineName, type: 'vaccine', unit: 'dose', quantity: 0,
    purchase_price: pricePerUnit, sell_price: pricePerUnit, low_stock_threshold: 10,
  }]).select().single()
  return created
}
const emptyNewSupplier = { open: false, company_name: '', phone: '', saving: false }
// Inline farm/client creation from the "Send to" picker. opening_balance carries
// over what they already owed before this system — optional, 0 when there is none.
const emptyNewEntity = { open: false, name: '', phone: '', kind: 'farm', opening_balance: '', saving: false }

// Mirrors findOrCreateProduct in useSuppliers: a meel bill's product row.
async function getOrCreateMeelProduct(productName, pricePerBag) {
  const { data: existing } = await supabase
    .from('products').select('id, quantity').eq('name', productName).eq('type', 'meel').limit(1)
  if (existing && existing.length > 0) return existing[0]
  const { data: created } = await supabase.from('products').insert([{
    name: productName, type: 'meel', unit: 'bag', quantity: 0,
    purchase_price: pricePerBag, sell_price: pricePerBag, low_stock_threshold: 10,
  }]).select().single()
  return created
}

// A choza type maps to one "Choza - <type>" product row (same convention as the
// choza supplier page), created on first use so Inventory keeps working.
async function getOrCreateChozaProduct(chozaType, pricePerChoza) {
  const productName = `Choza - ${chozaType}`
  const { data: existing } = await supabase
    .from('products').select('id, quantity').eq('name', productName).eq('type', 'choza').limit(1)
  if (existing && existing.length > 0) return existing[0]
  const { data: created } = await supabase.from('products').insert([{
    name: productName, type: 'choza', unit: 'chick', quantity: 0,
    purchase_price: pricePerChoza, sell_price: pricePerChoza, low_stock_threshold: 100,
  }]).select().single()
  return created
}
const emptyBill = { farm_id: '', supplier_id: '', bill_number: '', dana_type: '9_number', quantity: '', price_per_bag: '', date: todayStr(), notes: '' }
const emptyPay  = { farm_id: '', amount: '', date: todayStr(), notes: '' }
const emptyExp  = { title: '', amount: '', category: 'other', date: todayStr(), notes: '' }
const emptySupply = { farm_id: '', supply_item: 'Sugar', other_item: '', amount: '', date: todayStr(), notes: '' }
const emptyCash  = { person_name: '', phone: '', amount: '', cashType: 'lent', date: todayStr(), notes: '' }
const emptySaraf = { saraf_id: '', direction: 'in', farm_id: '', supplier_id: '', amount: '', hawala_number: '', date: todayStr(), notes: '' }
const emptyStock = { product_id: '', quantity: '', purchase_price: '', batch_number: '', date: todayStr(), notes: '' }

// Maps a Roznamcha feed entry._type to the modal's internal type key.
const EDIT_TYPE_MAP = { dispatch: 'dispatch', payment: 'payment', expense: 'expense', cash_ledger: 'cash', supply: 'supply' }

// One unified "notebook" entry form: pick a type, fill a few fields,
// and the right underlying record is created (+ cash drawer updated).
// When `editEntry` is passed, the modal opens in edit mode for that record.
export default function QuickEntryModal({ open, onClose, onCreated, editEntry = null }) {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const { farms, addFarm } = useFarms()
  const { products, addStockPurchase } = useInventory()
  const { suppliers, addSupplier } = useSuppliers()
  const { meelBills } = useMeelBills()
  const { createDispatch, updateDispatch } = useDispatches()
  const { recordPayment, updatePayment } = usePayments()
  const { addExpense, updateExpense } = useExpenses()
  const { addTransaction: addCash, updateTransaction: updateCash } = useCashLedger()
  const { addSupplyPayment, updateSupplyPayment } = useSupplyPayments()
  const { sarafs } = useSarafs()
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
  const [supplyForm, setSupplyForm] = useState(emptySupply)
  const [sarafForm, setSarafForm] = useState(emptySaraf)
  const [editDispatch, setEditDispatch] = useState(null) // full old dispatch (with items) for edits
  // Lots are tagged with the supplier they belong to, so a stale list is never
  // shown while a newly picked supplier's lots are still loading.
  const [chozaLotState, setChozaLotState] = useState({ supplierId: null, rows: [] })
  const [vacLotState, setVacLotState] = useState({ supplierId: null, rows: [] })
  const [medLotState, setMedLotState] = useState({ supplierId: null, rows: [] })
  const [lotsLoading, setLotsLoading] = useState(false)
  const [newSupplier, setNewSupplier] = useState(emptyNewSupplier)
  const [newEntity, setNewEntity] = useState(emptyNewEntity)

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
    } else if (mt === 'supply') {
      // Anything not in the fixed list was typed via "Other".
      const isCustom = !SUPPLY_ITEMS.slice(0, -1).includes(editEntry.supply_item)
      setSupplyForm({
        farm_id: editEntry.farm_id || '',
        supply_item: isCustom ? 'Other' : editEntry.supply_item,
        other_item: isCustom ? (editEntry.supply_item || '') : '',
        amount: String(editEntry.amount ?? ''),
        date: editEntry.payment_date || todayStr(),
        notes: editEntry.notes || '',
      })
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
    if (mt === 'payment' || mt === 'expense' || mt === 'cash' || mt === 'supply') {
      ;(async () => {
        const { data } = await supabase.from('cash_movements').select('id').eq('reference_id', editEntry.id).limit(1)
        setStoreCash((data?.length || 0) > 0)
      })()
    }
  }, [open, editEntry])

  // Load the picked choza supplier's lots, and how many chicks are left in each
  // (bought minus already dispatched against that lot).
  useEffect(() => {
    const supplierId = dispForm.choza_supplier_id
    if (!open || !supplierId) return
    let cancelled = false
    ;(async () => {
      setLotsLoading(true)
      const { data: lots } = await supabase
        .from('choza_transactions')
        .select('id, choza_type, afghani_subtype, price_per_choza, sale_price_per_choza, total_choza, transaction_date')
        .eq('supplier_id', supplierId)
        .order('transaction_date', { ascending: false })
      const ids = (lots || []).map(l => l.id)
      let used = []
      if (ids.length) {
        const { data } = await supabase
          .from('dispatch_items')
          .select('choza_transaction_id, quantity')
          .in('choza_transaction_id', ids)
        used = data || []
      }
      if (cancelled) return
      setChozaLotState({
        supplierId,
        rows: (lots || []).map(l => ({
          ...l,
          remaining: (l.total_choza || 0) - used
            .filter(u => u.choza_transaction_id === l.id)
            .reduce((s, u) => s + (u.quantity || 0), 0),
        })),
      })
      setLotsLoading(false)
    })()
    return () => { cancelled = true }
  }, [open, dispForm.choza_supplier_id])

  // Same as the choza lots above, for vaccine lots.
  useEffect(() => {
    const supplierId = dispForm.vac_supplier_id
    if (!open || !supplierId) return
    let cancelled = false
    ;(async () => {
      const { data: lots } = await supabase
        .from('vaccine_transactions')
        .select('id, vaccine_name, price_per_unit, sale_price_per_unit, quantity, transaction_date')
        .eq('supplier_id', supplierId)
        .order('transaction_date', { ascending: false })
      const ids = (lots || []).map(l => l.id)
      let used = []
      if (ids.length) {
        const { data } = await supabase
          .from('dispatch_items').select('vaccine_transaction_id, quantity').in('vaccine_transaction_id', ids)
        used = data || []
      }
      if (cancelled) return
      setVacLotState({
        supplierId,
        rows: (lots || []).map(l => ({
          ...l,
          remaining: (l.quantity || 0) - used
            .filter(u => u.vaccine_transaction_id === l.id)
            .reduce((s, u) => s + (u.quantity || 0), 0),
        })),
      })
    })()
    return () => { cancelled = true }
  }, [open, dispForm.vac_supplier_id])

  // Medicine lots: a stock_purchases row, minus whatever has been dispatched off it.
  useEffect(() => {
    const supplierId = dispForm.med_supplier_id
    if (!open || !supplierId) return
    let cancelled = false
    ;(async () => {
      const { data: lots } = await supabase
        .from('stock_purchases')
        .select('id, product_id, quantity, purchase_price, purchase_date, batch_number, products(name, unit, sell_price, type)')
        .eq('supplier_id', supplierId)
        .order('purchase_date', { ascending: false })
      const ids = (lots || []).map(l => l.id)
      let used = []
      if (ids.length) {
        const { data } = await supabase
          .from('dispatch_items').select('stock_purchase_id, quantity').in('stock_purchase_id', ids)
        used = data || []
      }
      if (cancelled) return
      setMedLotState({
        supplierId,
        rows: (lots || [])
          .filter(l => l.products?.type === 'medicine')
          .map(l => ({
            ...l,
            remaining: (l.quantity || 0) - used
              .filter(u => u.stock_purchase_id === l.id)
              .reduce((sum, u) => sum + (u.quantity || 0), 0),
          })),
      })
    })()
    return () => { cancelled = true }
  }, [open, dispForm.med_supplier_id])

  function handleMedLotPick(lotId) {
    const lot = medLotState.rows.find(l => l.id === lotId)
    setDispForm(f => ({
      ...f,
      med_lot_id: lotId,
      purchase_price: lot ? String(lot.purchase_price ?? '') : f.purchase_price,
      sell_price: lot?.products?.sell_price ? String(lot.products.sell_price) : f.sell_price,
    }))
  }

  function handleVacLotPick(lotId) {
    const lot = vacLotState.rows.find(l => l.id === lotId)
    setDispForm(f => ({
      ...f,
      vac_lot_id: lotId,
      purchase_price: lot ? String(lot.price_per_unit ?? '') : f.purchase_price,
      sell_price: lot?.sale_price_per_unit ? String(lot.sale_price_per_unit) : f.sell_price,
    }))
  }

  // Picking a meel bill carries its product, buy price and sell price into the form.
  function handleBillPick(billId) {
    const b = meelBills.find(x => x.id === billId)
    setDispForm(f => ({
      ...f,
      meel_bill_id: billId,
      purchase_price: b ? String(b.price_per_bag ?? '') : f.purchase_price,
      sell_price: b ? String(b.sell_price ?? '') : f.sell_price,
    }))
  }

  // Picking a lot carries its buy price (and suggested sell price) into the form.
  function handleLotPick(lotId) {
    const lot = chozaLots.find(l => l.id === lotId)
    setDispForm(f => ({
      ...f,
      choza_lot_id: lotId,
      purchase_price: lot ? String(lot.price_per_choza ?? '') : f.purchase_price,
      sell_price: lot?.sale_price_per_choza ? String(lot.sale_price_per_choza) : f.sell_price,
    }))
  }

  async function handleCreateEntity() {
    const name = newEntity.name.trim()
    if (!name) { toast.error('Name is required'); return }
    setNewEntity(s => ({ ...s, saving: true }))
    const created = await addFarm({
      name,
      phone: newEntity.phone || null,
      kind: newEntity.kind,
      is_active: true,
      opening_balance: Math.max(0, parseFloat(newEntity.opening_balance) || 0),
    })
    if (created) {
      setNewEntity(emptyNewEntity)
      setDispForm(f => ({ ...f, farm_id: created.id }))
    } else {
      setNewEntity(s => ({ ...s, saving: false }))
    }
  }

  // kind is the suppliers.type the new row gets ('choza' | 'meel'); the created
  // supplier is selected in whichever picker asked for it.
  async function handleCreateSupplier(kind) {
    const name = newSupplier.company_name.trim()
    if (!name) { toast.error('Supplier name is required'); return }
    setNewSupplier(s => ({ ...s, saving: true }))
    const created = await addSupplier({ company_name: name, phone: newSupplier.phone || null, type: kind })
    if (created) {
      setNewSupplier(emptyNewSupplier)
      // A brand new supplier has nothing on file yet, so jump to the "new" path.
      setDispForm(f => {
        if (kind === 'meel') return { ...f, meel_supplier_id: created.id, meel_bill_id: '', meel_source: 'new' }
        if (kind === 'vaccine') return { ...f, vac_supplier_id: created.id, vac_lot_id: '', vac_source: 'new' }
        if (kind === 'medicine') return { ...f, med_supplier_id: created.id, med_lot_id: '', med_source: 'new' }
        return { ...f, choza_supplier_id: created.id, choza_lot_id: '', choza_source: 'new' }
      })
    } else {
      setNewSupplier(s => ({ ...s, saving: false }))
    }
  }

  function reset() {
    setDispForm({ ...emptyDisp, date: todayStr() })
    setBillForm({ ...emptyBill, date: todayStr() })
    setPayForm({ ...emptyPay, date: todayStr() })
    setExpForm({ ...emptyExp, date: todayStr() })
    setCashForm({ ...emptyCash, date: todayStr() })
    setSupplyForm({ ...emptySupply, date: todayStr() })
    setSarafForm({ ...emptySaraf, date: todayStr() })
    setEditDispatch(null)
    setChozaLotState({ supplierId: null, rows: [] })
    setVacLotState({ supplierId: null, rows: [] })
    setMedLotState({ supplierId: null, rows: [] })
    setNewSupplier(emptyNewSupplier)
    setNewEntity(emptyNewEntity)
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
        if (!dispForm.farm_id) { toast.error('Pick a farm or client'); return }
        // In choza/meel mode the product is derived from the supplier lot or bill.
        if (!isChoza && !isMeel && !isVaccine && !isMedicine && !dispForm.product_id) { toast.error('Pick a product'); return }
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
              choza_transaction_id: oldItem?.choza_transaction_id || null,
              batch_number: oldItem?.batch_number || null,
            }],
          )
        } else {
          // A choza dispatch is tied to one supplier lot. "New purchase" writes the
          // supplier-side choza_transaction (and stocks the pooled product) first,
          // then dispatches straight out of that fresh lot.
          let chozaLotId = null
          let vaccineLotId = null
          let supplierDispatchId = null
          let productId = dispForm.product_id
          let stockPurchaseId = null
          if (isMedicine) {
            if (!dispForm.med_supplier_id) { toast.error('Pick a medicine supplier'); return }
            const buyPrice = parseFloat(dispForm.purchase_price) || 0
            if (dispForm.med_source === 'new') {
              const name = (dispForm.med_name === NEW_CHOZA_TYPE ? dispForm.med_name_custom : dispForm.med_name).trim()
              if (!name) { toast.error('Medicine is required'); return }
              const bought = parseFloat(dispForm.med_buy_count) || 0
              if (bought <= 0) { toast.error('Quantity purchased must be > 0'); return }
              if (buyPrice <= 0) { toast.error('Buy price must be > 0'); return }
              if (qty > bought) { toast.error('Cannot dispatch more than was purchased'); return }
              const product = await getOrCreateMedicineProduct(name, buyPrice, dispForm.med_unit)
              if (!product) { toast.error('Could not create the medicine product'); return }
              productId = product.id
              const supplierName = suppliers.find(x => x.id === dispForm.med_supplier_id)?.company_name || null
              const { data: lot, error: lotErr } = await supabase.from('stock_purchases').insert([{
                product_id: productId,
                supplier_id: dispForm.med_supplier_id,
                supplier: supplierName,
                quantity: bought,
                purchase_price: buyPrice,
                total_cost: bought * buyPrice,
                purchase_date: dispForm.date,
                notes: dispForm.notes || null,
              }]).select().single()
              if (lotErr) { toast.error(lotErr.message); return }
              stockPurchaseId = lot.id
              const { data: prod } = await supabase.from('products').select('quantity').eq('id', productId).single()
              await supabase.from('products')
                .update({ quantity: (prod?.quantity || 0) + bought, purchase_price: buyPrice })
                .eq('id', productId)
            } else {
              if (!dispForm.med_lot_id || !selectedMedLot) { toast.error('Pick a medicine purchase'); return }
              if (qty > selectedMedLot.remaining) {
                toast.error(`Only ${selectedMedLot.remaining} left on that purchase`)
                return
              }
              productId = selectedMedLot.product_id
              stockPurchaseId = selectedMedLot.id
            }
          }
          if (isVaccine) {
            if (!dispForm.vac_supplier_id) { toast.error('Pick a vaccine supplier'); return }
            const buyPrice = parseFloat(dispForm.purchase_price) || 0
            if (dispForm.vac_source === 'new') {
              const name = (dispForm.vac_name === NEW_CHOZA_TYPE ? dispForm.vac_name_custom : dispForm.vac_name).trim()
              if (!name) { toast.error('Vaccine is required'); return }
              const bought = parseInt(dispForm.vac_buy_count, 10) || 0
              if (bought <= 0) { toast.error('Doses purchased must be > 0'); return }
              if (buyPrice <= 0) { toast.error('Buy price must be > 0'); return }
              if (qty > bought) { toast.error('Cannot dispatch more doses than were purchased'); return }
              const product = await getOrCreateVaccineProduct(name, buyPrice)
              if (!product) { toast.error('Could not create the vaccine product'); return }
              productId = product.id
              const { data: lot, error: lotErr } = await supabase.from('vaccine_transactions').insert([{
                supplier_id: dispForm.vac_supplier_id,
                transaction_date: dispForm.date,
                vaccine_name: name,
                quantity: bought,
                price_per_unit: buyPrice,
                total_amount: bought * buyPrice,
                sale_price_per_unit: sellPrice,
                total_profit: (sellPrice - buyPrice) * bought,
                notes: dispForm.notes || null,
              }]).select().single()
              if (lotErr) { toast.error(lotErr.message); return }
              vaccineLotId = lot.id
              const { data: prod } = await supabase.from('products').select('quantity').eq('id', productId).single()
              await supabase.from('products')
                .update({ quantity: (prod?.quantity || 0) + bought, purchase_price: buyPrice })
                .eq('id', productId)
            } else {
              if (!dispForm.vac_lot_id || !selectedVacLot) { toast.error('Pick a vaccine lot'); return }
              if (qty > selectedVacLot.remaining) {
                toast.error(`Only ${selectedVacLot.remaining} doses left in that lot`)
                return
              }
              const product = await getOrCreateVaccineProduct(selectedVacLot.vaccine_name, selectedVacLot.price_per_unit)
              if (!product) { toast.error('Could not resolve the vaccine product'); return }
              productId = product.id
              vaccineLotId = dispForm.vac_lot_id
            }
          }
          if (isMeel) {
            // Meel already carries per-bill attribution via supplier_dispatch_id;
            // the bill decides the product, buy price and remaining bags.
            if (!dispForm.meel_supplier_id) { toast.error('Pick a meel supplier'); return }
            if (dispForm.meel_source === 'new') {
              const productName = dispForm.meel_product_name.trim()
              if (!productName) { toast.error('Dana / product name is required'); return }
              const bags = parseFloat(dispForm.meel_buy_bags) || 0
              const buyPrice = parseFloat(dispForm.purchase_price) || 0
              if (bags <= 0) { toast.error('Bags received must be > 0'); return }
              if (buyPrice <= 0) { toast.error('Buy price must be > 0'); return }
              if (qty > bags) { toast.error('Cannot dispatch more bags than were received'); return }
              const product = await getOrCreateMeelProduct(productName, buyPrice)
              if (!product) { toast.error('Could not create the meel product'); return }
              productId = product.id
              const { data: bill, error: billErr } = await supabase.from('supplier_dispatches').insert([{
                supplier_id: dispForm.meel_supplier_id,
                product_id: productId,
                product_name: productName,
                dispatch_date: dispForm.date,
                quantity: bags,
                price_per_bag: buyPrice,
                sell_price_per_bag: sellPrice,
                total_amount: bags * buyPrice,
                bill_number: dispForm.meel_bill_number || null,
                dana_type: dispForm.meel_dana_type || null,
                notes: dispForm.notes || null,
              }]).select().single()
              if (billErr) { toast.error(billErr.message); return }
              supplierDispatchId = bill.id
              // Stock the received bags; createDispatch removes the dispatched part.
              const { data: prod } = await supabase.from('products').select('quantity').eq('id', productId).single()
              await supabase.from('products')
                .update({ quantity: (prod?.quantity || 0) + bags, purchase_price: buyPrice })
                .eq('id', productId)
            } else {
              if (!dispForm.meel_bill_id || !selectedBill) { toast.error('Pick a meel bill'); return }
              if (qty > selectedBill.available) {
                toast.error(`Only ${selectedBill.available} bags left on that bill`)
                return
              }
              productId = selectedBill.product_id
              supplierDispatchId = selectedBill.id
            }
          }
          if (isChoza) {
            if (!dispForm.choza_supplier_id) { toast.error('Pick a choza supplier'); return }
            const buyPrice = parseFloat(dispForm.purchase_price) || 0
            if (dispForm.choza_source === 'new') {
              const chozaType = (dispForm.choza_type === NEW_CHOZA_TYPE
                ? dispForm.choza_type_custom
                : dispForm.choza_type).trim()
              if (!chozaType) { toast.error('Choza type is required'); return }
              const bought = parseInt(dispForm.choza_buy_count, 10) || 0
              if (bought <= 0) { toast.error('Purchased count must be > 0'); return }
              if (buyPrice <= 0) { toast.error('Buy price must be > 0'); return }
              if (qty > bought) { toast.error('Cannot dispatch more chicks than were purchased'); return }
              const product = await getOrCreateChozaProduct(chozaType, buyPrice)
              if (!product) { toast.error('Could not create the choza product'); return }
              productId = product.id
              const { data: lot, error: lotErr } = await supabase.from('choza_transactions').insert([{
                supplier_id: dispForm.choza_supplier_id,
                transaction_date: dispForm.date,
                choza_type: chozaType,
                afghani_subtype: dispForm.choza_subtype || null,
                price_per_choza: buyPrice,
                total_choza: bought,
                total_amount: bought * buyPrice,
                sale_price_per_choza: sellPrice,
                total_profit: (sellPrice - buyPrice) * bought,
                notes: dispForm.notes || null,
              }]).select().single()
              if (lotErr) { toast.error(lotErr.message); return }
              chozaLotId = lot.id
              // Stock the whole purchase into the pooled product (Inventory/Dashboard
              // read it); createDispatch then removes the dispatched part.
              const { data: prod } = await supabase.from('products').select('quantity').eq('id', productId).single()
              await supabase.from('products')
                .update({ quantity: (prod?.quantity || 0) + bought, purchase_price: buyPrice })
                .eq('id', productId)
            } else {
              if (!dispForm.choza_lot_id || !selectedLot) { toast.error('Pick a choza lot'); return }
              if (qty > selectedLot.remaining) {
                toast.error(`Only ${selectedLot.remaining} chicks left in that lot`)
                return
              }
              const product = await getOrCreateChozaProduct(selectedLot.choza_type, selectedLot.price_per_choza)
              if (!product) { toast.error('Could not resolve the choza product'); return }
              productId = product.id
              chozaLotId = dispForm.choza_lot_id
            }
          }
          ok = await createDispatch(
            { farm_id: dispForm.farm_id, dispatch_date: dispForm.date, total_amount: total, notes: dispForm.notes || null },
            [{
              product_id: productId,
              quantity: qty,
              sell_price: sellPrice,
              purchase_price: parseFloat(dispForm.purchase_price) || 0,
              choza_transaction_id: chozaLotId,
              vaccine_transaction_id: vaccineLotId,
              stock_purchase_id: stockPurchaseId,
              supplier_dispatch_id: supplierDispatchId,
            }],
          )
        }
      } else if (type === 'bill') {
        // Broker Dana Bill (clients only). One supplier_dispatches row carrying
        // farm_id (the client): adds to the client's debt AND the supplier's
        // remaining (same total, no margin). No dispatch, no inventory touch.
        if (!billForm.farm_id) { toast.error('Pick a client'); return }
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

        const { error: billErr } = await supabase.from('supplier_dispatches').insert([{
          supplier_id: billForm.supplier_id,
          farm_id: billForm.farm_id,
          product_name: 'Feed (Dana)',
          bill_number: billNo,
          dana_type: billForm.dana_type || null,
          dispatch_date: billForm.date,
          quantity: bags,
          price_per_bag: price,
          sell_price_per_bag: price,
          total_amount: bags * price,
          notes: billForm.notes || null,
        }])
        if (billErr) { toast.error(billErr.message); return }
        ok = true
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
      } else if (type === 'supply') {
        if (!supplyForm.farm_id) { toast.error('Farm / client is required'); return }
        const supplyItem = supplyForm.supply_item === 'Other' ? supplyForm.other_item.trim() : supplyForm.supply_item
        if (!supplyItem) { toast.error('Supply item is required'); return }
        const amt = parseFloat(supplyForm.amount) || 0
        if (amt <= 0) { toast.error('Amount must be > 0'); return }
        // The hook owns the farm-debt side effect (supplies are given on credit).
        const payload = {
          farm_id: supplyForm.farm_id, supply_item: supplyItem, amount: amt,
          payment_date: supplyForm.date, notes: supplyForm.notes || null,
        }
        if (isEdit) {
          ok = await updateSupplyPayment(editEntry.id, editEntry, payload)
          if (ok) {
            await removeByReference(editEntry.id)
            if (storeCash) await recordOut({ amount: amt, source: 'supply_payment', reference_id: editEntry.id, note: supplyItem, date: supplyForm.date })
          }
        } else {
          const result = await addSupplyPayment(payload)
          if (result) {
            if (storeCash) {
              await recordOut({ amount: amt, source: 'supply_payment', reference_id: result.id, note: supplyItem, date: supplyForm.date })
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
      } else if (type === 'saraf') {
        // Record money moving through a Saraf, straight into the same rows the
        // Saraf page uses: IN = payments.saraf_id (+ reduces client debt),
        // OUT = supplier_payments.saraf_id. Both land in the Roznamcha too.
        if (!sarafForm.saraf_id) { toast.error('Pick a Saraf'); return }
        const amt = parseFloat(sarafForm.amount) || 0
        if (amt <= 0) { toast.error('Amount must be > 0'); return }
        if (sarafForm.direction === 'in') {
          if (!sarafForm.farm_id) { toast.error('Pick a client / farm'); return }
          if (!sarafForm.hawala_number.trim()) { toast.error('Transaction / hawala number is required'); return }
          const { error } = await supabase.from('payments').insert([{
            farm_id: sarafForm.farm_id,
            amount: amt,
            payment_date: sarafForm.date,
            notes: sarafForm.notes || null,
            saraf_id: sarafForm.saraf_id,
            hawala_number: sarafForm.hawala_number.trim(),
          }])
          if (error) { toast.error(error.message); return }
          const { data: farm } = await supabase.from('farms').select('total_debt').eq('id', sarafForm.farm_id).single()
          if (farm) await supabase.from('farms').update({ total_debt: Math.max(0, (farm.total_debt || 0) - amt) }).eq('id', sarafForm.farm_id)
          ok = true
        } else {
          if (!sarafForm.supplier_id) { toast.error('Pick a meel supplier'); return }
          const { error } = await supabase.from('supplier_payments').insert([{
            supplier_id: sarafForm.supplier_id,
            amount: amt,
            amount_usd: 0,
            payment_date: sarafForm.date,
            notes: sarafForm.notes || null,
            saraf_id: sarafForm.saraf_id,
            hawala_number: sarafForm.hawala_number.trim() || null,
          }])
          if (error) { toast.error(error.message); return }
          ok = true
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
  // Choza mode is chosen explicitly, not inferred from the picked product.
  const isChoza = dispForm.disp_mode === 'choza' && !isEdit
  const isMeel = dispForm.disp_mode === 'meel' && !isEdit
  const isVaccine = dispForm.disp_mode === 'vaccine' && !isEdit
  const isMedicine = dispForm.disp_mode === 'medicine' && !isEdit
  const medicineSuppliers = suppliers.filter(s => s.type === 'medicine')
  const medLots = medLotState.supplierId === dispForm.med_supplier_id ? medLotState.rows : []
  const selectedMedLot = medLots.find(l => l.id === dispForm.med_lot_id)
  const knownMedicines = products.filter(p => p.type === 'medicine').map(p => p.name)
  const vaccineSuppliers = suppliers.filter(s => s.type === 'vaccine')
  const vacLots = vacLotState.supplierId === dispForm.vac_supplier_id ? vacLotState.rows : []
  const selectedVacLot = vacLots.find(l => l.id === dispForm.vac_lot_id)
  // Known names = the canonical list plus anything already recorded as a product.
  const knownVaccines = [...new Set([
    ...VACCINE_NAMES,
    ...products.filter(p => p.type === 'vaccine').map(p => p.name),
  ])]
  const dispatchableProducts = isEdit ? products : products.filter(p => p.type !== 'choza')
  // Every meel supplier, not just those with bags left — a new bill can be written here.
  const meelSuppliers = suppliers.filter(s => s.type === 'meel')
    .map(s => ({ id: s.id, name: s.company_name }))
  const supplierMeelBills = meelBills.filter(b => b.supplier_id === dispForm.meel_supplier_id)
  const selectedBill = meelBills.find(b => b.id === dispForm.meel_bill_id)
  // Existing choza types, read off the "Choza - <type>" product rows.
  const knownChozaTypes = [...new Set(
    products.filter(p => p.type === 'choza').map(p => p.name.replace(/^\s*Choza\s*-\s*/i, '').trim()).filter(Boolean),
  )].sort()
  const chozaSuppliers = suppliers.filter(s => s.type === 'choza')
  const chozaLots = chozaLotState.supplierId === dispForm.choza_supplier_id ? chozaLotState.rows : []
  const selectedLot = chozaLots.find(l => l.id === dispForm.choza_lot_id)
  const buyingNewChoza = isChoza && dispForm.choza_source === 'new'
  const dispTotal = (parseFloat(dispForm.quantity) || 0) * (parseFloat(dispForm.sell_price) || 0)

  // Store-cash toggle is meaningless for dispatch / stock / bill — those flows
  // don't move money in or out of the shop's drawer (a Meel Bill settles via
  // the Saraf, not directly to Anas Hadi).
  const showStoreCashBox = type !== 'dispatch' && type !== 'stock' && type !== 'bill' && type !== 'saraf'
  const storeCashLabel = type === 'payment'
    ? t('storeCash.addToStoreCash')
    : type === 'expense' || type === 'supply'
    ? t('storeCash.fromStoreCash')
    : type === 'cash'
    ? (cashForm.cashType === 'lent' ? t('storeCash.fromStoreCash') : t('storeCash.addToStoreCash'))
    : ''
  const storeCashColor = type === 'expense' || type === 'supply' || (type === 'cash' && cashForm.cashType === 'lent')
    ? 'bg-red-50 border-red-200 text-red-700'
    : 'bg-emerald-50 border-emerald-200 text-emerald-700'

  return (
    <Modal open={open} onClose={() => { reset(); onClose() }} title={isEdit ? '✏️ Edit Roznamcha Entry' : '📓 New Roznamcha Entry'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type selector — hidden in edit mode (the type can't change) */}
        {!isEdit && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
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
            {/* Choza starts from the supplier, everything else from the product */}
            {!isEdit && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {[
                  { key: 'meel', icon: '🌾', label: 'Meel / دانه', sub: 'pick a bill' },
                  { key: 'choza', icon: '🐥', label: 'Choza / چوزه', sub: 'pick a supplier' },
                  { key: 'vaccine', icon: '💉', label: 'Vaccine / واکسین', sub: 'pick a supplier' },
                  { key: 'medicine', icon: '💊', label: 'Medicine / دوا', sub: 'pick a supplier' },
                ].map(m => (
                  <button key={m.key} type="button"
                    onClick={() => setDispForm(f => ({ ...f, disp_mode: m.key, product_id: '', sell_price: '', purchase_price: '' }))}
                    className={`px-3 py-2 rounded-xl border-2 text-sm font-medium ${dispForm.disp_mode === m.key ? 'border-[#0F5257] bg-[#0F5257] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                    <span className="me-1">{m.icon}</span>{m.label}
                    <span className={`block text-[10px] ${dispForm.disp_mode === m.key ? 'text-white/70' : 'text-slate-400'}`}>{m.sub}</span>
                  </button>
                ))}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Send to *</label>
              <div className="flex gap-2">
                <select required disabled={isEdit} value={dispForm.farm_id} onChange={e => setDispForm(f => ({ ...f, farm_id: e.target.value }))}
                  className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30 disabled:bg-slate-100 disabled:text-slate-500">
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
                {!isEdit && (
                  <button type="button" onClick={() => setNewEntity(s => ({ ...s, open: !s.open }))}
                    className="px-3 py-2 rounded-lg border-2 border-[#0F5257] text-[#0F5257] text-sm font-semibold whitespace-nowrap">
                    {newEntity.open ? 'Cancel' : '＋ New'}
                  </button>
                )}
              </div>

              {newEntity.open && !isEdit && (
                <div className="mt-2 space-y-2 bg-white border border-slate-200 rounded-lg p-2">
                  <div className="grid grid-cols-2 gap-2">
                    {[{ key: 'farm', label: '🏠 Farm' }, { key: 'client', label: '🏪 Client' }].map(k => (
                      <button key={k.key} type="button" onClick={() => setNewEntity(s => ({ ...s, kind: k.key }))}
                        className={`px-3 py-2 rounded-lg border-2 text-sm font-medium ${newEntity.kind === k.key ? 'border-[#0F5257] bg-[#0F5257] text-white' : 'border-slate-200 text-slate-600'}`}>
                        {k.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input value={newEntity.name} placeholder="Name *"
                      onChange={e => setNewEntity(s => ({ ...s, name: e.target.value }))}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                    <input value={newEntity.phone} placeholder="Phone"
                      onChange={e => setNewEntity(s => ({ ...s, phone: e.target.value }))}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">{t('farms.openingBalance')} (AFN)</label>
                    <input type="number" min="0" step="0.01" value={newEntity.opening_balance} placeholder="0"
                      onChange={e => setNewEntity(s => ({ ...s, opening_balance: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                    <p className="text-xs text-slate-500 mt-1">{t('farms.openingBalanceHelp')}</p>
                  </div>
                  <button type="button" disabled={newEntity.saving} onClick={handleCreateEntity}
                    className="w-full px-3 py-2 rounded-lg bg-[#0F5257] text-white text-sm font-semibold disabled:opacity-50">
                    {newEntity.saving ? 'Saving…' : `Create ${newEntity.kind === 'client' ? 'client' : 'farm'}`}
                  </button>
                </div>
              )}
            </div>
            {/* New dispatches always go through Meel or Choza; the raw product
                picker survives only for editing an existing dispatch. */}
            {isEdit && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Product *</label>
                <select required value={dispForm.product_id} onChange={e => handleProductPick(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                  <option value="">— pick a product —</option>
                  {dispatchableProducts.map(p => (
                    <option key={p.id} value={p.id}>{p.name} — {p.type} (stock: {p.quantity} {p.unit || ''})</option>
                  ))}
                </select>
                {selectedProduct && (
                  <p className="text-xs text-slate-400 mt-1">In stock: {selectedProduct.quantity} {selectedProduct.unit}</p>
                )}
              </div>
            )}

            {/* Meel: dispatch bags out of a specific supplier bill */}
            {isMeel && (
              <div className="space-y-3 border border-lime-200 bg-lime-50/60 rounded-xl p-3">
                <p className="text-xs font-semibold text-lime-800">🌾 Meel supplier / تأمین‌کننده دانه</p>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Supplier *</label>
                  <div className="flex gap-2">
                    <select value={dispForm.meel_supplier_id}
                      onChange={e => setDispForm(f => ({ ...f, meel_supplier_id: e.target.value, meel_bill_id: '' }))}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                      <option value="">— pick a meel supplier —</option>
                      {meelSuppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button type="button" onClick={() => setNewSupplier(s => ({ ...s, open: !s.open }))}
                      className="px-3 py-2 rounded-lg border-2 border-[#0F5257] text-[#0F5257] text-sm font-semibold whitespace-nowrap">
                      {newSupplier.open ? 'Cancel' : '＋ New'}
                    </button>
                  </div>
                </div>

                {newSupplier.open && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white border border-slate-200 rounded-lg p-2">
                    <input value={newSupplier.company_name} placeholder="Supplier name *"
                      onChange={e => setNewSupplier(s => ({ ...s, company_name: e.target.value }))}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                    <input value={newSupplier.phone} placeholder="Phone"
                      onChange={e => setNewSupplier(s => ({ ...s, phone: e.target.value }))}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                    <button type="button" disabled={newSupplier.saving} onClick={() => handleCreateSupplier('meel')}
                      className="px-3 py-2 rounded-lg bg-[#0F5257] text-white text-sm font-semibold disabled:opacity-50">
                      {newSupplier.saving ? 'Saving…' : 'Create supplier'}
                    </button>
                  </div>
                )}

                {dispForm.meel_supplier_id && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ key: 'existing', label: 'From existing bill' }, { key: 'new', label: 'New bill' }].map(o => (
                        <button key={o.key} type="button"
                          onClick={() => setDispForm(f => ({ ...f, meel_source: o.key, meel_bill_id: '' }))}
                          className={`px-3 py-2 rounded-lg border-2 text-sm font-medium ${dispForm.meel_source === o.key ? 'border-[#0F5257] bg-[#0F5257] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
                          {o.label}
                        </button>
                      ))}
                    </div>

                    {dispForm.meel_source === 'existing' ? (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Bill *</label>
                        <select value={dispForm.meel_bill_id} onChange={e => handleBillPick(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                          <option value="">— pick a bill —</option>
                          {supplierMeelBills.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.product_name}{b.bill_number ? ` · #${b.bill_number}` : ''} · {b.available} bags left · buy {b.price_per_bag}
                            </option>
                          ))}
                        </select>
                        {supplierMeelBills.length === 0 && (
                          <p className="text-xs text-lime-800 mt-1">No bill from this supplier has bags left — use “New bill”.</p>
                        )}
                        {selectedBill && (
                          <p className="text-xs text-slate-500 mt-1">
                            Dispatching from this bill leaves {Math.max(0, selectedBill.available - (parseFloat(dispForm.quantity) || 0))} bags on it.
                          </p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Dana / product name *</label>
                          <input list="meel-products" value={dispForm.meel_product_name} placeholder="e.g. afghan safi"
                            onChange={e => setDispForm(f => ({ ...f, meel_product_name: e.target.value }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                          <datalist id="meel-products">
                            {products.filter(p => p.type === 'meel').map(p => <option key={p.id} value={p.name} />)}
                          </datalist>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Dana Type / نوع دانه</label>
                            <select value={dispForm.meel_dana_type}
                              onChange={e => setDispForm(f => ({ ...f, meel_dana_type: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                              {DANA_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(`suppliers.${o.labelKey}`)}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Bill number</label>
                            <input value={dispForm.meel_bill_number}
                              onChange={e => setDispForm(f => ({ ...f, meel_bill_number: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Bags received *</label>
                            <input type="number" min="1" step="0.01" value={dispForm.meel_buy_bags}
                              onChange={e => setDispForm(f => ({ ...f, meel_buy_bags: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Buy price per bag (AFN) *</label>
                            <input type="number" min="0" step="0.01" value={dispForm.purchase_price}
                              onChange={e => setDispForm(f => ({ ...f, purchase_price: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                          </div>
                        </div>
                        <p className="text-xs text-slate-500">This bill is added to the supplier’s account (what you owe them).</p>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Medicine: units come out of one supplier purchase */}
            {isMedicine && (
              <div className="space-y-3 border border-blue-200 bg-blue-50/60 rounded-xl p-3">
                <p className="text-xs font-semibold text-blue-800">💊 Medicine supplier / تأمین‌کننده دوا</p>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Supplier *</label>
                  <div className="flex gap-2">
                    <select value={dispForm.med_supplier_id}
                      onChange={e => setDispForm(f => ({ ...f, med_supplier_id: e.target.value, med_lot_id: '' }))}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                      <option value="">— pick a medicine supplier —</option>
                      {medicineSuppliers.map(x => <option key={x.id} value={x.id}>{x.company_name}</option>)}
                    </select>
                    <button type="button" onClick={() => setNewSupplier(x => ({ ...x, open: !x.open }))}
                      className="px-3 py-2 rounded-lg border-2 border-[#0F5257] text-[#0F5257] text-sm font-semibold whitespace-nowrap">
                      {newSupplier.open ? 'Cancel' : '＋ New'}
                    </button>
                  </div>
                  {medicineSuppliers.length === 0 && (
                    <p className="text-xs text-blue-800 mt-1">
                      No medicine supplier yet — tap <span className="font-semibold">＋ New</span> to add one, then pick the medicine.
                    </p>
                  )}
                </div>

                {newSupplier.open && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white border border-slate-200 rounded-lg p-2">
                    <input value={newSupplier.company_name} placeholder="Supplier name *"
                      onChange={e => setNewSupplier(x => ({ ...x, company_name: e.target.value }))}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                    <input value={newSupplier.phone} placeholder="Phone"
                      onChange={e => setNewSupplier(x => ({ ...x, phone: e.target.value }))}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                    <button type="button" disabled={newSupplier.saving} onClick={() => handleCreateSupplier('medicine')}
                      className="px-3 py-2 rounded-lg bg-[#0F5257] text-white text-sm font-semibold disabled:opacity-50">
                      {newSupplier.saving ? 'Saving…' : 'Create supplier'}
                    </button>
                  </div>
                )}

                {dispForm.med_supplier_id && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ key: 'existing', label: 'From existing stock' }, { key: 'new', label: 'New purchase' }].map(o => (
                        <button key={o.key} type="button"
                          onClick={() => setDispForm(f => ({ ...f, med_source: o.key, med_lot_id: '' }))}
                          className={`px-3 py-2 rounded-lg border-2 text-sm font-medium ${dispForm.med_source === o.key ? 'border-[#0F5257] bg-[#0F5257] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
                          {o.label}
                        </button>
                      ))}
                    </div>

                    {dispForm.med_source === 'existing' ? (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Purchase *</label>
                        <select value={dispForm.med_lot_id} onChange={e => handleMedLotPick(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                          <option value="">— pick a purchase —</option>
                          {medLots.map(l => (
                            <option key={l.id} value={l.id}>
                              {l.products?.name}{l.batch_number ? ` · ${l.batch_number}` : ''} · {l.remaining} left · buy {l.purchase_price}
                            </option>
                          ))}
                        </select>
                        {medLots.length === 0 && (
                          <p className="text-xs text-blue-800 mt-1">Nothing left from this supplier — use “New purchase”.</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Medicine *</label>
                          <select value={dispForm.med_name}
                            onChange={e => setDispForm(f => ({ ...f, med_name: e.target.value, med_name_custom: '' }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                            <option value="">— pick a medicine —</option>
                            {knownMedicines.map(n => <option key={n} value={n}>{n}</option>)}
                            <option value={NEW_CHOZA_TYPE}>＋ New medicine…</option>
                          </select>
                        </div>
                        {dispForm.med_name === NEW_CHOZA_TYPE && (
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">New medicine name *</label>
                              <input value={dispForm.med_name_custom}
                                onChange={e => setDispForm(f => ({ ...f, med_name_custom: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-slate-600 mb-1">Unit</label>
                              <input value={dispForm.med_unit} placeholder="bottle, box, sachet…"
                                onChange={e => setDispForm(f => ({ ...f, med_unit: e.target.value }))}
                                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Quantity purchased *</label>
                            <input type="number" min="0.01" step="0.01" value={dispForm.med_buy_count}
                              onChange={e => setDispForm(f => ({ ...f, med_buy_count: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Buy price per unit (AFN) *</label>
                            <input type="number" min="0" step="0.01" value={dispForm.purchase_price}
                              onChange={e => setDispForm(f => ({ ...f, purchase_price: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                          </div>
                        </div>
                        <p className="text-xs text-slate-500">This purchase is added to the supplier’s account (what you owe them).</p>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Vaccine: same shape as choza — doses come out of one supplier lot */}
            {isVaccine && (
              <div className="space-y-3 border border-sky-200 bg-sky-50/60 rounded-xl p-3">
                <p className="text-xs font-semibold text-sky-800">💉 Vaccine supplier / تأمین‌کننده واکسین</p>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Supplier *</label>
                  <div className="flex gap-2">
                    <select value={dispForm.vac_supplier_id}
                      onChange={e => setDispForm(f => ({ ...f, vac_supplier_id: e.target.value, vac_lot_id: '' }))}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                      <option value="">— pick a vaccine supplier —</option>
                      {vaccineSuppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                    </select>
                    <button type="button" onClick={() => setNewSupplier(s => ({ ...s, open: !s.open }))}
                      className="px-3 py-2 rounded-lg border-2 border-[#0F5257] text-[#0F5257] text-sm font-semibold whitespace-nowrap">
                      {newSupplier.open ? 'Cancel' : '＋ New'}
                    </button>
                  </div>
                  {vaccineSuppliers.length === 0 && (
                    <p className="text-xs text-sky-800 mt-1">
                      No vaccine supplier yet — tap <span className="font-semibold">＋ New</span> to add one, then pick the vaccine.
                    </p>
                  )}
                </div>

                {newSupplier.open && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white border border-slate-200 rounded-lg p-2">
                    <input value={newSupplier.company_name} placeholder="Supplier name *"
                      onChange={e => setNewSupplier(s => ({ ...s, company_name: e.target.value }))}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                    <input value={newSupplier.phone} placeholder="Phone"
                      onChange={e => setNewSupplier(s => ({ ...s, phone: e.target.value }))}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                    <button type="button" disabled={newSupplier.saving} onClick={() => handleCreateSupplier('vaccine')}
                      className="px-3 py-2 rounded-lg bg-[#0F5257] text-white text-sm font-semibold disabled:opacity-50">
                      {newSupplier.saving ? 'Saving…' : 'Create supplier'}
                    </button>
                  </div>
                )}

                {dispForm.vac_supplier_id && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ key: 'existing', label: 'From existing stock' }, { key: 'new', label: 'New purchase' }].map(o => (
                        <button key={o.key} type="button"
                          onClick={() => setDispForm(f => ({ ...f, vac_source: o.key, vac_lot_id: '' }))}
                          className={`px-3 py-2 rounded-lg border-2 text-sm font-medium ${dispForm.vac_source === o.key ? 'border-[#0F5257] bg-[#0F5257] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
                          {o.label}
                        </button>
                      ))}
                    </div>

                    {dispForm.vac_source === 'existing' ? (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Vaccine lot *</label>
                        <select value={dispForm.vac_lot_id} onChange={e => handleVacLotPick(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                          <option value="">— pick a lot —</option>
                          {vacLots.map(l => (
                            <option key={l.id} value={l.id}>
                              {l.vaccine_name} · {l.remaining} left · buy {l.price_per_unit}
                            </option>
                          ))}
                        </select>
                        {vacLots.length === 0 && (
                          <p className="text-xs text-sky-800 mt-1">No vaccine recorded for this supplier yet — use “New purchase”.</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Vaccine *</label>
                          <select value={dispForm.vac_name}
                            onChange={e => setDispForm(f => ({ ...f, vac_name: e.target.value, vac_name_custom: '' }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                            <option value="">— pick a vaccine —</option>
                            {knownVaccines.map(n => <option key={n} value={n}>{n}</option>)}
                            <option value={NEW_CHOZA_TYPE}>＋ New vaccine…</option>
                          </select>
                        </div>
                        {dispForm.vac_name === NEW_CHOZA_TYPE && (
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">New vaccine name *</label>
                            <input value={dispForm.vac_name_custom}
                              onChange={e => setDispForm(f => ({ ...f, vac_name_custom: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Doses purchased *</label>
                            <input type="number" min="1" step="1" value={dispForm.vac_buy_count}
                              onChange={e => setDispForm(f => ({ ...f, vac_buy_count: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Buy price per dose (AFN) *</label>
                            <input type="number" min="0" step="0.01" value={dispForm.purchase_price}
                              onChange={e => setDispForm(f => ({ ...f, purchase_price: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                          </div>
                        </div>
                        <p className="text-xs text-slate-500">This purchase is added to the supplier’s account (what you owe them).</p>
                      </>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Choza: attribute the chicks to one supplier lot rather than the shared pool */}
            {isChoza && (
              <div className="space-y-3 border border-amber-200 bg-amber-50/60 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-800">🐥 Choza supplier / تأمین‌کننده چوزه</p>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Supplier *</label>
                  <div className="flex gap-2">
                    <select value={dispForm.choza_supplier_id}
                      onChange={e => setDispForm(f => ({ ...f, choza_supplier_id: e.target.value, choza_lot_id: '' }))}
                      className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                      <option value="">— pick a choza supplier —</option>
                      {chozaSuppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                    </select>
                    <button type="button" onClick={() => setNewSupplier(s => ({ ...s, open: !s.open }))}
                      className="px-3 py-2 rounded-lg border-2 border-[#0F5257] text-[#0F5257] text-sm font-semibold whitespace-nowrap">
                      {newSupplier.open ? 'Cancel' : '＋ New'}
                    </button>
                  </div>
                  {chozaSuppliers.length === 0 && (
                    <p className="text-xs text-amber-800 mt-1">
                      No choza supplier yet — tap <span className="font-semibold">＋ New</span> to add one, then pick the choza type.
                    </p>
                  )}
                </div>

                {newSupplier.open && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white border border-slate-200 rounded-lg p-2">
                    <input value={newSupplier.company_name} placeholder="Supplier name *"
                      onChange={e => setNewSupplier(s => ({ ...s, company_name: e.target.value }))}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                    <input value={newSupplier.phone} placeholder="Phone"
                      onChange={e => setNewSupplier(s => ({ ...s, phone: e.target.value }))}
                      className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                    <button type="button" disabled={newSupplier.saving} onClick={() => handleCreateSupplier('choza')}
                      className="px-3 py-2 rounded-lg bg-[#0F5257] text-white text-sm font-semibold disabled:opacity-50">
                      {newSupplier.saving ? 'Saving…' : 'Create supplier'}
                    </button>
                  </div>
                )}

                {dispForm.choza_supplier_id && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ key: 'existing', label: 'From existing stock' }, { key: 'new', label: 'New purchase' }].map(o => (
                        <button key={o.key} type="button"
                          onClick={() => setDispForm(f => ({ ...f, choza_source: o.key, choza_lot_id: '' }))}
                          className={`px-3 py-2 rounded-lg border-2 text-sm font-medium ${dispForm.choza_source === o.key ? 'border-[#0F5257] bg-[#0F5257] text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
                          {o.label}
                        </button>
                      ))}
                    </div>

                    {dispForm.choza_source === 'existing' ? (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">Choza lot *</label>
                        <select value={dispForm.choza_lot_id} onChange={e => handleLotPick(e.target.value)}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                          <option value="">{lotsLoading ? 'loading lots…' : '— pick a lot —'}</option>
                          {chozaLots.map(l => (
                            <option key={l.id} value={l.id}>
                              {l.choza_type}{l.afghani_subtype ? ` (${l.afghani_subtype})` : ''} · {l.remaining} left · buy {l.price_per_choza}
                            </option>
                          ))}
                        </select>
                        {!lotsLoading && chozaLots.length === 0 && (
                          <p className="text-xs text-amber-700 mt-1">No choza recorded for this supplier yet — use “New purchase”.</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-slate-600 mb-1">Choza type *</label>
                          <select value={dispForm.choza_type}
                            onChange={e => setDispForm(f => ({ ...f, choza_type: e.target.value, choza_type_custom: '' }))}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                            <option value="">— pick a choza type —</option>
                            {knownChozaTypes.map(n => <option key={n} value={n}>{n}</option>)}
                            <option value={NEW_CHOZA_TYPE}>＋ New type…</option>
                          </select>
                        </div>
                        {dispForm.choza_type === NEW_CHOZA_TYPE && (
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">New choza type *</label>
                            <input value={dispForm.choza_type_custom} placeholder="e.g. Irani, Afghani"
                              onChange={e => setDispForm(f => ({ ...f, choza_type_custom: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Chicks purchased *</label>
                            <input type="number" min="1" step="1" value={dispForm.choza_buy_count}
                              onChange={e => setDispForm(f => ({ ...f, choza_buy_count: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-600 mb-1">Subtype</label>
                            <input value={dispForm.choza_subtype} placeholder="e.g. Afghani grade"
                              onChange={e => setDispForm(f => ({ ...f, choza_subtype: e.target.value }))}
                              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                          </div>
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">Buy price per choza (AFN) *</label>
                      <input type="number" min="0" step="0.01" value={dispForm.purchase_price}
                        onChange={e => setDispForm(f => ({ ...f, purchase_price: e.target.value }))}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                      <p className="text-xs text-slate-500 mt-1">
                        {buyingNewChoza
                          ? 'This purchase is added to the supplier’s account (what you owe them).'
                          : 'Taken from the picked lot — change it only if this dispatch was priced differently.'}
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{isChoza ? 'Chicks to dispatch *' : isMeel ? 'Bags to dispatch *' : isVaccine ? 'Doses to dispatch *' : isMedicine ? 'Quantity to dispatch *' : 'Quantity *'}</label>
                <input required type="number" min="0.01" step="0.01" value={dispForm.quantity}
                  onChange={e => setDispForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{isChoza ? 'Sell price per choza (AFN) *' : isMeel ? 'Sell price per bag (AFN) *' : isVaccine ? 'Sell price per dose (AFN) *' : isMedicine ? 'Sell price per unit (AFN) *' : 'Sell price (AFN) *'}</label>
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
                <label className="block text-xs font-medium text-slate-600 mb-1">Client / مشتری *</label>
                <select required value={billForm.farm_id} onChange={e => setBillForm(f => ({ ...f, farm_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                  <option value="">— pick a client —</option>
                  {activeClients.map(f => <option key={f.id} value={f.id}>{lf(f, 'name', lang)}</option>)}
                </select>
                {activeClients.length === 0 && (
                  <p className="text-xs text-amber-700 mt-1">No clients yet — add one under Clients first.</p>
                )}
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
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Dana Type / نوع دانه</label>
                <select value={billForm.dana_type} onChange={e => setBillForm(f => ({ ...f, dana_type: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30 bg-white">
                  {DANA_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(`suppliers.${o.labelKey}`)}</option>)}
                </select>
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

        {/* Supply fields */}
        {type === 'supply' && (
          <div className="space-y-3">
            <p className="text-xs text-slate-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              {t('supply.debtNote')}
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Supply to *</label>
              <select required value={supplyForm.farm_id} onChange={e => setSupplyForm(f => ({ ...f, farm_id: e.target.value }))}
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('supply.supplyItem')}</label>
                <select value={supplyForm.supply_item} onChange={e => setSupplyForm(f => ({ ...f, supply_item: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                  {SUPPLY_ITEMS.map(it => <option key={it} value={it}>{SUPPLY_ITEM_BI[it] || it}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('supply.amountAFN')}</label>
                <input required type="number" min="0.01" step="0.01" value={supplyForm.amount}
                  onChange={e => setSupplyForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
            </div>
            {supplyForm.supply_item === 'Other' && (
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('supply.specifyItem')} *</label>
                <input required value={supplyForm.other_item} onChange={e => setSupplyForm(f => ({ ...f, other_item: e.target.value }))}
                  placeholder={t('supply.specifyPlaceholder')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
                <input type="date" value={supplyForm.date} onChange={e => setSupplyForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
                <input value={supplyForm.notes} onChange={e => setSupplyForm(f => ({ ...f, notes: e.target.value }))}
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

        {/* Saraf IN / OUT — records straight into the Saraf ledger + Roznamcha */}
        {type === 'saraf' && (() => {
          const meelSuppliers = suppliers.filter(s => (s.type || 'meel') === 'meel')
          const isIn = sarafForm.direction === 'in'
          return (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setSarafForm(f => ({ ...f, direction: 'in' }))}
                  className={`px-3 py-2 rounded-lg border-2 text-sm font-medium ${isIn ? 'border-green-500 bg-green-50 text-green-700' : 'border-slate-200 text-slate-600'}`}>
                  ↘ Record IN / د ترلاسې ثبت
                </button>
                <button type="button" onClick={() => setSarafForm(f => ({ ...f, direction: 'out' }))}
                  className={`px-3 py-2 rounded-lg border-2 text-sm font-medium ${!isIn ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600'}`}>
                  ↗ Record OUT / د ورکړې ثبت
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Saraf / صراف *</label>
                <select required value={sarafForm.saraf_id} onChange={e => setSarafForm(f => ({ ...f, saraf_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                  <option value="">— pick a Saraf / صراف وټاکئ —</option>
                  {sarafs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                {sarafs.length === 0 && (
                  <p className="text-xs text-amber-700 mt-1">No sarafs yet — add one under Saraf first.</p>
                )}
              </div>
              {isIn ? (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">From client / farm *</label>
                  <select required value={sarafForm.farm_id} onChange={e => setSarafForm(f => ({ ...f, farm_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                    <option value="">— pick farm or client —</option>
                    {activeClients.length > 0 && (
                      <optgroup label="🏪 Clients / مشتریان">
                        {activeClients.map(f => <option key={f.id} value={f.id}>{lf(f, 'name', lang)}</option>)}
                      </optgroup>
                    )}
                    {activeFarms.length > 0 && (
                      <optgroup label="🏠 Farms / فارم‌ها">
                        {activeFarms.map(f => <option key={f.id} value={f.id}>{lf(f, 'name', lang)}</option>)}
                      </optgroup>
                    )}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">To meel supplier *</label>
                  <select required value={sarafForm.supplier_id} onChange={e => setSarafForm(f => ({ ...f, supplier_id: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30">
                    <option value="">— pick a meel —</option>
                    {meelSuppliers.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
                  </select>
                  {meelSuppliers.length === 0 && (
                    <p className="text-xs text-amber-700 mt-1">No meel suppliers yet — add one under Suppliers first.</p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.amount')} (AFN) *</label>
                  <input required type="number" min="0.01" step="0.01" value={sarafForm.amount}
                    onChange={e => setSarafForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.date')}</label>
                  <input type="date" value={sarafForm.date} onChange={e => setSarafForm(f => ({ ...f, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Transaction # / حواله نمبر {isIn ? '*' : <span className="text-slate-400 font-normal">({t('common.optional')})</span>}
                </label>
                <input required={isIn} value={sarafForm.hawala_number}
                  onChange={e => setSarafForm(f => ({ ...f, hawala_number: e.target.value }))}
                  placeholder="e.g. 12345"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
                <input value={sarafForm.notes} onChange={e => setSarafForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
              </div>
              <p className="text-xs text-slate-400">This is recorded on the Saraf's ledger and appears in the Roznamcha. {isIn ? 'IN reduces the client’s remaining.' : 'OUT reduces the meel supplier’s remaining.'}</p>
            </div>
          )
        })()}

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
