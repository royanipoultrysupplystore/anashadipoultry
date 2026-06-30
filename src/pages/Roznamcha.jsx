import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, BookOpen, RefreshCw, Plus, Trash2, Pencil } from 'lucide-react'
import { useRoznamcha } from '../hooks/useRoznamcha'
import { useStoreCash } from '../contexts/StoreCashContext'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { formatCurrency } from '../utils/formatCurrency'
import { todayStr } from '../utils/dateHelpers'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'
import QuickEntryModal from '../components/common/QuickEntryModal'
import { ROZNAMCHA_TYPE_BI, EXPENSE_CATEGORY_BI, SUPPLY_ITEM_BI } from '../utils/biLabels'

const CAT_ICONS = { fuel: '⛽', salary: '👤', rent: '🏢', maintenance: '🔧', utilities: '💡', other: '📦' }
const DANA_LABEL_KEY = { '4_number': 'dana4Number', '6_number': 'dana6Number', '9_number': 'dana9Number', '12_number': 'dana12Number', other: 'danaOther' }

function entryTime(entry) {
  if (!entry.created_at) return ''
  return new Date(entry.created_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function prevDay(date) {
  const d = new Date(date)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

function nextDay(date) {
  const d = new Date(date)
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function formatDayLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// Types that can be edited in place via the QuickEntry modal. A dispatch is only
// inline-editable when it has a single line item (the quick modal is single-product).
const EDITABLE_TYPES = { dispatch: true, payment: true, expense: true, cash_ledger: true }

function EntryCard({ entry, onDelete, onEdit }) {
  const { t, lang } = useLanguage()

  const TYPE_CONFIG = {
    dispatch:  { label: ROZNAMCHA_TYPE_BI.dispatch, badge: 'bg-blue-100 text-blue-700',    border: 'border-l-blue-400',    icon: '🚚', amountColor: 'text-blue-700' },
    payment:   { label: ROZNAMCHA_TYPE_BI.payment,  badge: 'bg-green-100 text-green-700',  border: 'border-l-green-500',   icon: '💵', amountColor: 'text-green-700' },
    sale:      { label: ROZNAMCHA_TYPE_BI.sale,     badge: 'bg-emerald-100 text-emerald-700', border: 'border-l-emerald-500', icon: '🛒', amountColor: 'text-emerald-700' },
    supply:    { label: ROZNAMCHA_TYPE_BI.supply,   badge: 'bg-orange-100 text-orange-700', border: 'border-l-orange-400',  icon: '🛍️', amountColor: 'text-orange-700' },
    expense:   { label: ROZNAMCHA_TYPE_BI.expense,  badge: 'bg-red-100 text-red-700',      border: 'border-l-red-400',     icon: '📋', amountColor: 'text-red-700' },
    stock:     { label: ROZNAMCHA_TYPE_BI.stock,    badge: 'bg-purple-100 text-purple-700', border: 'border-l-purple-400',  icon: '📦', amountColor: 'text-purple-700' },
    supplier_dispatch: { label: ROZNAMCHA_TYPE_BI.supplier_dispatch, badge: 'bg-indigo-100 text-indigo-700', border: 'border-l-indigo-400', icon: '📥', amountColor: 'text-indigo-700' },
    supplier_payment:  { label: ROZNAMCHA_TYPE_BI.supplier_payment,  badge: 'bg-rose-100 text-rose-700',     border: 'border-l-rose-400',   icon: '💸', amountColor: 'text-rose-700' },
    market_tx:         { label: ROZNAMCHA_TYPE_BI.market_tx,         badge: 'bg-cyan-100 text-cyan-700',     border: 'border-l-cyan-400',   icon: '🏪', amountColor: 'text-cyan-700' },
    market_payment:    { label: ROZNAMCHA_TYPE_BI.market_payment,    badge: 'bg-teal-100 text-teal-700',     border: 'border-l-teal-500',   icon: '💵', amountColor: 'text-teal-700' },
    cash_ledger:       { label: ROZNAMCHA_TYPE_BI.cash_ledger,       badge: 'bg-violet-100 text-violet-700', border: 'border-l-violet-400', icon: '🤝', amountColor: 'text-violet-700' },
    cash_movement:     { label: ROZNAMCHA_TYPE_BI.cash_movement,     badge: 'bg-slate-100 text-slate-700',   border: 'border-l-slate-400',  icon: '💰', amountColor: 'text-slate-700' },
    commission_sale:   { label: ROZNAMCHA_TYPE_BI.commission_sale,   badge: 'bg-lime-100 text-lime-700',     border: 'border-l-lime-500',   icon: '🐔', amountColor: 'text-lime-700' },
    commission_payment:{ label: ROZNAMCHA_TYPE_BI.commission_payment,badge: 'bg-green-100 text-green-700',   border: 'border-l-green-500',  icon: '💵', amountColor: 'text-green-700' },
    dealer_payout:     { label: ROZNAMCHA_TYPE_BI.dealer_payout,     badge: 'bg-rose-100 text-rose-700',     border: 'border-l-rose-400',   icon: '💸', amountColor: 'text-rose-700' },
    commission_fee:    { label: ROZNAMCHA_TYPE_BI.commission_fee,    badge: 'bg-red-100 text-red-700',       border: 'border-l-red-400',    icon: '🧾', amountColor: 'text-red-700' },
    batch:             { label: ROZNAMCHA_TYPE_BI.batch,             badge: 'bg-amber-100 text-amber-700',   border: 'border-l-amber-500',  icon: '🐔', amountColor: 'text-amber-700' },
  }

  const cfg = TYPE_CONFIG[entry._type]
  const time = entryTime(entry)
  const canEdit = !!EDITABLE_TYPES[entry._type] &&
    !(entry._type === 'dispatch' && (entry.dispatch_items?.length || 0) > 1)

  let title = ''
  let detail = ''
  let amount = 0

  switch (entry._type) {
    case 'dispatch':
      title = `${t('roznamcha.dispatchedTo')} ${lf(entry.farms, 'name', lang) || '—'}`
      detail = [
        entry.invoice_number ? `${t('dispatches.invoice')}${entry.invoice_number}` : '',
        entry.dispatch_items?.length ? `${entry.dispatch_items.length} ${t('dispatches.items').toLowerCase()}` : '',
        entry.notes || '',
      ].filter(Boolean).join(' · ')
      amount = entry.total_amount || 0
      break
    case 'payment':
      title = `${t('roznamcha.paymentFrom')} ${lf(entry.farms, 'name', lang) || '—'}`
      detail = entry.notes || ''
      amount = entry.amount || 0
      break
    case 'sale':
      title = `${t('roznamcha.walkInSaleEntry')} — ${entry.customer_name || t('customers.walkIn')}`
      detail = [
        entry.invoice_number ? `${t('dispatches.invoice')}${entry.invoice_number}` : '',
        entry.total_amount ? `${t('common.total')}: ${formatCurrency(entry.total_amount)}` : '',
        entry.payment_type === 'credit' ? t('roznamcha.creditSale') : t('customers.cash'),
        entry.remaining > 0 ? `${t('roznamcha.remaining')}: ${formatCurrency(entry.remaining)}` : '',
        entry.notes || '',
      ].filter(Boolean).join(' · ')
      amount = entry.amount_paid || 0
      break
    case 'supply':
      title = `${t('roznamcha.supplyEntry')}: ${SUPPLY_ITEM_BI[entry.supply_item] || entry.supply_item} → ${lf(entry.farms, 'name', lang) || '—'}`
      detail = entry.notes || ''
      amount = entry.amount || 0
      break
    case 'expense':
      title = `${CAT_ICONS[entry.category] || '📦'} ${entry.title}`
      detail = [EXPENSE_CATEGORY_BI[entry.category] || entry.category, entry.notes].filter(Boolean).join(' · ')
      amount = entry.amount || 0
      break
    case 'stock':
      title = `${t('roznamcha.restocked')}: ${entry.products?.name || '—'}`
      detail = [
        entry.quantity ? `${entry.quantity} ${t('roznamcha.units')}` : '',
        entry.supplier ? `${t('common.from')} ${entry.supplier}` : '',
        entry.batch_number ? `${t('inventory.batchNo')}: ${entry.batch_number}` : '',
        entry.notes || '',
      ].filter(Boolean).join(' · ')
      amount = entry.total_cost || 0
      break
    case 'supplier_dispatch': {
      const client = entry.farms ? lf(entry.farms, 'name', lang) : null
      title = client
        ? `🌾 ${client} ← ${entry.suppliers?.company_name || '—'}`
        : `${entry.product_name || '—'} ← ${entry.suppliers?.company_name || '—'}`
      const danaK = DANA_LABEL_KEY[entry.dana_type]
      detail = [
        danaK ? t(`suppliers.${danaK}`) : '',
        entry.quantity ? `${entry.quantity} × ${formatCurrency(entry.price_per_bag || 0)}` : '',
        entry.bill_number ? `${t('market.billNumber')}: ${entry.bill_number}` : '',
        entry.notes || '',
      ].filter(Boolean).join(' · ')
      amount = entry.total_amount || 0
      break
    }
    case 'supplier_payment':
      title = `${entry.suppliers?.company_name || '—'}`
      detail = entry.notes || ''
      amount = (entry.amount || 0) || (entry.amount_usd || 0)
      break
    case 'market_tx':
      title = `${entry.market_sellers?.name || '—'} ← ${lf(entry.farms, 'name', lang) || '—'}`
      detail = [
        entry.chicken_count ? `🐔 ${entry.chicken_count}` : '',
        entry.bill_number ? `${t('market.billNumber')}: ${entry.bill_number}` : '',
        entry.notes || '',
      ].filter(Boolean).join(' · ')
      amount = entry.total_amount || 0
      break
    case 'market_payment':
      title = `${entry.market_sellers?.name || '—'}`
      detail = entry.notes || ''
      amount = entry.amount || 0
      break
    case 'cash_ledger':
      title = `${entry.type === 'lent' ? '↗' : '↘'} ${entry.person_name || '—'}`
      detail = [entry.type === 'lent' ? t('cashLedger.lent') : t('cashLedger.borrowed'), entry.note].filter(Boolean).join(' · ')
      amount = entry.amount || 0
      break
    case 'cash_movement':
      title = `${entry.direction === 'in' ? '↘ ' : '↗ '}${entry.source === 'opening' ? 'Opening balance' : 'Cash adjustment'}`
      detail = entry.note || ''
      amount = entry.amount || 0
      break
    case 'commission_sale':
      title = `${entry.commission_customers?.name || '—'}`
      detail = [
        entry.chicken_count ? `🐔 ${entry.chicken_count}` : '',
        entry.weight_kg ? `${entry.weight_kg} kg` : '',
        entry.notes || '',
      ].filter(Boolean).join(' · ')
      amount = entry.total_amount || 0
      break
    case 'commission_payment':
      title = `${entry.commission_customers?.name || '—'}`
      detail = entry.notes || ''
      amount = entry.amount || 0
      break
    case 'dealer_payout':
      title = `${entry.commission_dealers?.name || '—'}`
      detail = entry.notes || ''
      amount = entry.amount || 0
      break
    case 'commission_fee':
      title = entry.title || '—'
      detail = entry.note || ''
      amount = entry.amount || 0
      break
    case 'batch':
      title = `🐔 ${t('batches.batch') || 'Batch'} #${entry.batch_number} → ${lf(entry.farms, 'name', lang) || '—'}`
      detail = [
        entry.initial_chicken_count ? `${entry.initial_chicken_count} × ${formatCurrency(entry.price_per_chicken || 0)}` : '',
        entry.suppliers?.company_name ? `${t('common.from')} ${entry.suppliers.company_name}` : '',
        entry.notes || '',
      ].filter(Boolean).join(' · ')
      amount = (entry.initial_chicken_count || 0) * (entry.price_per_chicken || 0)
      break
  }

  return (
    <div className={`bg-white rounded-xl border border-slate-100 border-l-4 ${cfg.border} px-3 sm:px-4 py-3 flex items-start gap-2 sm:gap-3`}>
      <div className="text-lg sm:text-xl shrink-0 mt-0.5">{cfg.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badge}`}>{cfg.label}</span>
          {time && <span className="text-[10px] text-slate-400">{time}</span>}
        </div>
        <p className="text-sm font-medium text-slate-800 wrap-break-word">{title}</p>
        {detail && <p className="text-xs text-slate-400 mt-0.5 wrap-break-word">{detail}</p>}
        {entry._type === 'dispatch' && entry.dispatch_items?.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {entry.dispatch_items.map((item, i) => (
              <span key={i} className="text-xs bg-slate-50 border border-slate-100 px-2 py-0.5 rounded text-slate-600">
                {item.products?.name || '—'} × {item.quantity}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="shrink-0 flex flex-col items-end gap-1">
        <p className={`font-bold text-sm sm:text-base whitespace-nowrap ${cfg.amountColor}`}>{formatCurrency(amount)}</p>
        <div className="flex items-center gap-0.5">
          {canEdit && (
            <button
              onClick={() => onEdit(entry)}
              title={t('common.edit')}
              className="p-1.5 rounded-lg text-slate-300 hover:bg-blue-50 hover:text-blue-500 transition-colors"
            >
              <Pencil size={15} />
            </button>
          )}
          <button
            onClick={() => onDelete(entry)}
            title={t('common.delete')}
            className="p-1.5 rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500 transition-colors"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Roznamcha() {
  const { t } = useLanguage()
  const [date, setDate] = useState(todayStr())
  const [quickOpen, setQuickOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const { entries, loading, refetch, deleteEntry } = useRoznamcha(date)
  const { refetch: refetchCash } = useStoreCash()

  useEffect(() => {
    const onVisible = () => { if (document.visibilityState === 'visible') refetch() }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refetch])

  const dispatches    = entries.filter(e => e._type === 'dispatch')
  const payments      = entries.filter(e => e._type === 'payment')
  const sales         = entries.filter(e => e._type === 'sale')
  const supplyOuts    = entries.filter(e => e._type === 'supply')
  const expenses      = entries.filter(e => e._type === 'expense')
  const stockBuys     = entries.filter(e => e._type === 'stock')
  const supplierPays  = entries.filter(e => e._type === 'supplier_payment')
  const marketPays    = entries.filter(e => e._type === 'market_payment')
  const marketTxs     = entries.filter(e => e._type === 'market_tx')
  const loansLent     = entries.filter(e => e._type === 'cash_ledger' && e.type === 'lent')
  const loansBorrowed = entries.filter(e => e._type === 'cash_ledger' && e.type === 'borrowed')
  const cashAdjIn     = entries.filter(e => e._type === 'cash_movement' && e.source === 'manual' && e.direction === 'in')
  const cashAdjOut    = entries.filter(e => e._type === 'cash_movement' && e.source === 'manual' && e.direction === 'out')
  const batches       = entries.filter(e => e._type === 'batch')
  const commSales     = entries.filter(e => e._type === 'commission_sale')
  const commPays      = entries.filter(e => e._type === 'commission_payment')
  const dealerPayouts = entries.filter(e => e._type === 'dealer_payout')
  const commFees      = entries.filter(e => e._type === 'commission_fee')

  const sum = (arr, key) => arr.reduce((s, x) => s + (x[key] || 0), 0)

  const moneyIn       = sum(payments, 'amount')
                      + sum(sales, 'amount_paid')
                      + sum(marketPays, 'amount')
                      + sum(loansBorrowed, 'amount')
                      + sum(cashAdjIn, 'amount')
                      + sum(commPays, 'amount')
  const moneyOut      = sum(expenses, 'amount')
                      + sum(supplyOuts, 'amount')
                      + sum(supplierPays, 'amount')
                      + sum(loansLent, 'amount')
                      + sum(cashAdjOut, 'amount')
                      + sum(dealerPayouts, 'amount')
                      + sum(commFees, 'amount')
  const debtFromSales = sum(sales, 'remaining')
  const batchValue    = batches.reduce((s, b) => s + (b.initial_chicken_count || 0) * (b.price_per_chicken || 0), 0)
  const dispatched    = sum(dispatches, 'total_amount') + sum(marketTxs, 'total_amount') + sum(commSales, 'total_amount') + batchValue
  const stockSpent    = sum(stockBuys, 'total_cost')
  const netCash       = moneyIn - moneyOut

  const isToday = date === todayStr()

  return (
    <div className="space-y-4 max-w-3xl mx-auto">

      {/* Date Navigation */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-[#0F5257]" />
          <span className="font-bold text-[#0F5257] text-base sm:text-lg">{t('nav.roznamcha')}</span>
        </div>
        <div className="flex-1 min-w-0" />
        <button onClick={() => setDate(prevDay(date))} className="p-2 rounded-lg hover:bg-slate-100 text-slate-600">
          <ChevronLeft size={18} />
        </button>
        <input
          type="date" value={date}
          max={todayStr()}
          onChange={e => setDate(e.target.value)}
          className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30 font-medium text-slate-700"
        />
        <button
          onClick={() => setDate(nextDay(date))}
          disabled={isToday}
          className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight size={18} />
        </button>
        {!isToday && (
          <button onClick={() => setDate(todayStr())} className="text-xs px-3 py-1.5 bg-[#0F5257] text-white rounded-lg hover:bg-[#14B8A6]">
            {t('roznamcha.today')}
          </button>
        )}
        <button onClick={refetch} className="p-2 rounded-lg hover:bg-slate-100 text-slate-400" title={t('common.refresh')}>
          <RefreshCw size={15} />
        </button>
        <button
          onClick={() => setQuickOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0F5257] text-white rounded-lg text-sm font-semibold hover:bg-[#14B8A6] whitespace-nowrap"
        >
          <Plus size={15} /> New Entry
        </button>
      </div>

      <p className="text-sm font-medium text-slate-500 px-1">{formatDayLabel(date)}</p>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-xs font-medium text-green-700 mb-1">{t('roznamcha.moneyIn')}</p>
          <p className="text-xl font-bold text-green-700">{formatCurrency(moneyIn)}</p>
          <p className="text-xs text-green-600 mt-0.5">{payments.length + sales.length + marketPays.length + loansBorrowed.length + cashAdjIn.length + commPays.length} entries</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-xs font-medium text-red-700 mb-1">{t('roznamcha.moneyOut')}</p>
          <p className="text-xl font-bold text-red-700">{formatCurrency(moneyOut)}</p>
          <p className="text-xs text-red-600 mt-0.5">{expenses.length + supplyOuts.length + supplierPays.length + loansLent.length + cashAdjOut.length + dealerPayouts.length + commFees.length} entries</p>
        </div>
        <div className={`rounded-xl p-3 border ${debtFromSales > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <p className={`text-xs font-medium mb-1 ${debtFromSales > 0 ? 'text-amber-700' : 'text-slate-500'}`}>{t('roznamcha.debtOut')}</p>
          <p className={`text-xl font-bold ${debtFromSales > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{formatCurrency(debtFromSales)}</p>
          <p className={`text-xs mt-0.5 ${debtFromSales > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{t('roznamcha.creditSale')}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-xs font-medium text-blue-700 mb-1">{t('roznamcha.dispatched')}</p>
          <p className="text-xl font-bold text-blue-700">{formatCurrency(dispatched)}</p>
          <p className="text-xs text-blue-600 mt-0.5">{dispatches.length + batches.length} {t('roznamcha.dispatches')}</p>
        </div>
        <div className={`rounded-xl p-3 border ${netCash >= 0 ? 'bg-slate-50 border-slate-200' : 'bg-orange-50 border-orange-200'}`}>
          <p className={`text-xs font-medium mb-1 ${netCash >= 0 ? 'text-slate-600' : 'text-orange-700'}`}>{t('roznamcha.netCash')}</p>
          <p className={`text-xl font-bold ${netCash >= 0 ? 'text-slate-800' : 'text-orange-700'}`}>{formatCurrency(netCash)}</p>
          {stockSpent > 0 && <p className="text-xs text-purple-600 mt-0.5">{t('roznamcha.stockBought')}: {formatCurrency(stockSpent)}</p>}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="space-y-2">
        {loading ? (
          <div className="bg-white rounded-xl border border-slate-100 py-16 text-center text-slate-400">
            <div className="w-8 h-8 border-2 border-[#14B8A6] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            {t('common.loading')}
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-100 py-16 text-center">
            <BookOpen size={40} className="mx-auto text-slate-200 mb-3" />
            <p className="text-slate-400 font-medium">{t('roznamcha.noActivity')}</p>
            <p className="text-slate-300 text-sm mt-1">{t('roznamcha.noActivitySub')}</p>
          </div>
        ) : (
          entries.map((entry, i) => <EntryCard key={`${entry._type}-${entry.id}-${i}`} entry={entry} onDelete={setDeleteTarget} onEdit={setEditTarget} />)
        )}
      </div>

      {/* Day Total Footer */}
      {entries.length > 0 && (
        <div className="bg-[#0F5257] rounded-2xl p-4 text-white">
          <p className="text-white/60 text-xs mb-3 font-medium uppercase tracking-wide">{t('roznamcha.daySummary')} — {entries.length} {t('roznamcha.transactions')}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {payments.length > 0 && <div><p className="text-white/50 text-xs">{t('roznamcha.farmPayments')}</p><p className="font-bold text-green-300">+{formatCurrency(payments.reduce((s,p) => s+(p.amount||0),0))}</p></div>}
            {sales.length > 0 && <div><p className="text-white/50 text-xs">{t('roznamcha.walkInSales')}</p><p className="font-bold text-emerald-300">+{formatCurrency(sales.reduce((s,p) => s+(p.amount_paid||0),0))}</p></div>}
            {debtFromSales > 0 && <div><p className="text-white/50 text-xs">{t('roznamcha.debtOut')}</p><p className="font-bold text-amber-300">{formatCurrency(debtFromSales)}</p></div>}
            {dispatches.length > 0 && <div><p className="text-white/50 text-xs">{t('roznamcha.dispatchedCredit')}</p><p className="font-bold text-blue-300">{formatCurrency(dispatched)}</p></div>}
            {supplyOuts.length > 0 && <div><p className="text-white/50 text-xs">{t('roznamcha.supplyPayments')}</p><p className="font-bold text-orange-300">-{formatCurrency(supplyOuts.reduce((s,p) => s+(p.amount||0),0))}</p></div>}
            {expenses.length > 0 && <div><p className="text-white/50 text-xs">{t('roznamcha.expenses')}</p><p className="font-bold text-red-300">-{formatCurrency(expenses.reduce((s,e) => s+(e.amount||0),0))}</p></div>}
            {stockBuys.length > 0 && <div><p className="text-white/50 text-xs">{t('roznamcha.stockBought')}</p><p className="font-bold text-purple-300">-{formatCurrency(stockSpent)}</p></div>}
            {supplierPays.length > 0 && <div><p className="text-white/50 text-xs">Supplier paid / پرداخت تأمین‌کننده</p><p className="font-bold text-rose-300">-{formatCurrency(sum(supplierPays,'amount'))}</p></div>}
            {marketPays.length > 0 && <div><p className="text-white/50 text-xs">Market received / دریافت از بازار</p><p className="font-bold text-teal-300">+{formatCurrency(sum(marketPays,'amount'))}</p></div>}
            {(loansLent.length + loansBorrowed.length) > 0 && <div><p className="text-white/50 text-xs">Loans / قرض</p><p className="font-bold text-violet-300">{formatCurrency(sum(loansBorrowed,'amount') - sum(loansLent,'amount'))}</p></div>}
            {(cashAdjIn.length + cashAdjOut.length) > 0 && <div><p className="text-white/50 text-xs">Cash adjust / صندوق</p><p className="font-bold text-slate-200">{formatCurrency(sum(cashAdjIn,'amount') - sum(cashAdjOut,'amount'))}</p></div>}
          </div>
          <div className="border-t border-white/10 mt-3 pt-3 flex justify-between items-center">
            <span className="text-white/70 text-sm">{t('roznamcha.netCashFlow')}</span>
            <span className={`text-xl font-bold ${netCash >= 0 ? 'text-green-300' : 'text-red-300'}`}>{netCash >= 0 ? '+' : ''}{formatCurrency(netCash)}</span>
          </div>
        </div>
      )}

      <QuickEntryModal
        open={quickOpen || !!editTarget}
        editEntry={editTarget}
        onClose={() => { setQuickOpen(false); setEditTarget(null) }}
        onCreated={(wasEdit) => { if (!wasEdit) setDate(todayStr()); refetch(); refetchCash() }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={async () => { await deleteEntry(deleteTarget); await refetchCash(); setDeleteTarget(null) }}
        title={t('common.delete')}
        message="Delete this transaction? It will be removed from Roznamcha and all its effects (debt, stock, store cash) will be undone."
      />
    </div>
  )
}
