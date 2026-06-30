import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../config/supabase'
import toast from 'react-hot-toast'
import { useLanguage } from '../contexts/LanguageContext'

export function useRoznamcha(date) {
  const { t } = useLanguage()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)

  const fetch = useCallback(async () => {
    if (!date) return
    setLoading(true)

    const [
      { data: dispatches },
      { data: payments },
      { data: sales },
      { data: supplyPayments },
      { data: expenses },
      { data: stockPurchases },
      { data: supplierDispatches },
      { data: supplierPayments },
      { data: marketTransactions },
      { data: marketSellerPayments },
      { data: cashLedger },
      { data: cashMovements },
      { data: commissionSales },
      { data: commissionPayments },
      { data: dealerPayouts },
      { data: commissionFees },
      { data: farmBatches },
    ] = await Promise.all([
      supabase.from('dispatches').select('*, farms(name, name_fa, name_ps), dispatch_items(quantity, sell_price_at_time, total_amount, products(name))').eq('dispatch_date', date).order('created_at'),
      supabase.from('payments').select('*, farms(name, name_fa, name_ps)').eq('payment_date', date).order('created_at'),
      supabase.from('sales').select('*').eq('sale_date', date).order('created_at'),
      supabase.from('supply_payments').select('*, farms(name, name_fa, name_ps)').eq('payment_date', date).order('created_at'),
      supabase.from('expenses').select('*').eq('expense_date', date).order('created_at'),
      supabase.from('stock_purchases').select('*, products(name)').eq('purchase_date', date).order('created_at'),
      // Inbound goods from suppliers
      supabase.from('supplier_dispatches').select('*, suppliers(company_name), farms(name, name_fa, name_ps)').eq('dispatch_date', date).order('created_at'),
      // Payments made to suppliers
      supabase.from('supplier_payments').select('*, suppliers(company_name)').eq('payment_date', date).order('created_at'),
      // Chickens sent to market sellers
      supabase.from('market_transactions').select('*, farms(name, name_fa, name_ps), market_sellers(name)').eq('transaction_date', date).order('created_at'),
      // Cash received from market sellers
      supabase.from('market_seller_payments').select('*, market_sellers(name)').eq('payment_date', date).order('created_at'),
      // Personal cash ledger (lent / borrowed)
      supabase.from('cash_ledger').select('*').eq('transaction_date', date).order('created_at'),
      // Store cash drawer — only show MANUAL / OPENING entries (movements tied to a source row are already in the feed via that row).
      supabase.from('cash_movements').select('*').in('source', ['manual', 'opening']).eq('movement_date', date).order('created_at'),
      // Commission module
      supabase.from('commission_sales').select('*, commission_customers(name)').eq('sale_date', date).order('created_at'),
      supabase.from('commission_payments').select('*, commission_customers(name)').eq('payment_date', date).order('created_at'),
      supabase.from('commission_dealer_payments').select('*, commission_dealers(name)').eq('payment_date', date).order('created_at'),
      supabase.from('commission_fee_expenses').select('*').eq('expense_date', date).order('created_at'),
      // Chicken batches placed on a farm (chicken debt = count × price, from a choza supplier)
      supabase.from('farm_batches').select('*, farms(name, name_fa, name_ps), suppliers(company_name)').eq('start_date', date).order('created_at'),
    ])

    const all = [
      ...(dispatches            || []).map(d  => ({ ...d,  _type: 'dispatch' })),
      ...(payments              || []).map(p  => ({ ...p,  _type: 'payment' })),
      ...(sales                 || []).map(s  => ({ ...s,  _type: 'sale' })),
      ...(supplyPayments        || []).map(sp => ({ ...sp, _type: 'supply' })),
      ...(expenses              || []).map(e  => ({ ...e,  _type: 'expense' })),
      ...(stockPurchases        || []).map(sp => ({ ...sp, _type: 'stock' })),
      ...(supplierDispatches    || []).map(sd => ({ ...sd, _type: 'supplier_dispatch' })),
      ...(supplierPayments      || []).map(sp => ({ ...sp, _type: 'supplier_payment' })),
      ...(marketTransactions    || []).map(mt => ({ ...mt, _type: 'market_tx' })),
      ...(marketSellerPayments  || []).map(mp => ({ ...mp, _type: 'market_payment' })),
      ...(cashLedger            || []).map(cl => ({ ...cl, _type: 'cash_ledger' })),
      ...(cashMovements         || []).map(cm => ({ ...cm, _type: 'cash_movement' })),
      ...(commissionSales       || []).map(cs => ({ ...cs, _type: 'commission_sale' })),
      ...(commissionPayments    || []).map(cp => ({ ...cp, _type: 'commission_payment' })),
      ...(dealerPayouts         || []).map(dp => ({ ...dp, _type: 'dealer_payout' })),
      ...(commissionFees        || []).map(cf => ({ ...cf, _type: 'commission_fee' })),
      ...(farmBatches           || []).map(fb => ({ ...fb, _type: 'batch' })),
    ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))

    setEntries(all)
    setLoading(false)
  }, [date])

  useEffect(() => { fetch() }, [fetch])

  // Delete a transaction from the central log and undo ALL its side effects
  // (entity debt, product stock, and the linked store-cash movement).
  async function deleteEntry(entry) {
    const id = entry.id
    const type = entry._type
    try {
      if (type === 'payment') {
        await supabase.from('payments').delete().eq('id', id)
        if (entry.farm_id) {
          const { data: f } = await supabase.from('farms').select('total_debt').eq('id', entry.farm_id).single()
          if (f) await supabase.from('farms').update({ total_debt: (f.total_debt || 0) + (entry.amount || 0) }).eq('id', entry.farm_id)
        }
        await supabase.from('cash_movements').delete().eq('reference_id', id)
      } else if (type === 'supply') {
        await supabase.from('supply_payments').delete().eq('id', id)
        if (entry.farm_id) {
          const { data: f } = await supabase.from('farms').select('total_debt').eq('id', entry.farm_id).single()
          if (f) await supabase.from('farms').update({ total_debt: Math.max(0, (f.total_debt || 0) - (entry.amount || 0)) }).eq('id', entry.farm_id)
        }
        await supabase.from('cash_movements').delete().eq('reference_id', id)
      } else if (type === 'expense') {
        await supabase.from('expenses').delete().eq('id', id)
        await supabase.from('cash_movements').delete().eq('reference_id', id)
      } else if (type === 'stock') {
        if (entry.product_id) {
          const { data: p } = await supabase.from('products').select('quantity').eq('id', entry.product_id).single()
          if (p) await supabase.from('products').update({ quantity: Math.max(0, (p.quantity || 0) - (entry.quantity || 0)) }).eq('id', entry.product_id)
        }
        await supabase.from('stock_purchases').delete().eq('id', id)
        await supabase.from('cash_movements').delete().eq('reference_id', id)
      } else if (type === 'dispatch') {
        const { data: items } = await supabase.from('dispatch_items').select('product_id, quantity, total_profit').eq('dispatch_id', id)
        for (const it of items || []) {
          if (!it.product_id) continue
          const { data: p } = await supabase.from('products').select('quantity').eq('id', it.product_id).single()
          if (p) await supabase.from('products').update({ quantity: (p.quantity || 0) + (it.quantity || 0) }).eq('id', it.product_id)
        }
        if (entry.farm_id) {
          const profit = (items || []).reduce((s, i) => s + (i.total_profit || 0), 0)
          const { data: f } = await supabase.from('farms').select('total_debt, total_profit_generated').eq('id', entry.farm_id).single()
          if (f) await supabase.from('farms').update({
            total_debt: Math.max(0, (f.total_debt || 0) - (entry.total_amount || 0)),
            total_profit_generated: Math.max(0, (f.total_profit_generated || 0) - profit),
          }).eq('id', entry.farm_id)
        }
        await supabase.from('dispatch_items').delete().eq('dispatch_id', id)
        await supabase.from('dispatches').delete().eq('id', id)
      } else if (type === 'sale') {
        const { data: items } = await supabase.from('sale_items').select('product_id, quantity').eq('sale_id', id)
        for (const it of items || []) {
          if (!it.product_id) continue
          const { data: p } = await supabase.from('products').select('quantity').eq('id', it.product_id).single()
          if (p) await supabase.from('products').update({ quantity: (p.quantity || 0) + (it.quantity || 0) }).eq('id', it.product_id)
        }
        if (entry.customer_id && (entry.remaining || 0) > 0) {
          const { data: c } = await supabase.from('customers').select('total_debt').eq('id', entry.customer_id).single()
          if (c) await supabase.from('customers').update({ total_debt: Math.max(0, (c.total_debt || 0) - (entry.remaining || 0)) }).eq('id', entry.customer_id)
        }
        await supabase.from('sale_items').delete().eq('sale_id', id)
        await supabase.from('sales').delete().eq('id', id)
        await supabase.from('cash_movements').delete().eq('reference_id', id)
      } else if (type === 'supplier_dispatch') {
        await supabase.from('supplier_dispatches').delete().eq('id', id)
      } else if (type === 'supplier_payment') {
        await supabase.from('supplier_payments').delete().eq('id', id)
        await supabase.from('cash_movements').delete().eq('reference_id', id)
      } else if (type === 'market_tx') {
        await supabase.from('market_transactions').delete().eq('id', id)
      } else if (type === 'market_payment') {
        await supabase.from('market_seller_payments').delete().eq('id', id)
        await supabase.from('cash_movements').delete().eq('reference_id', id)
      } else if (type === 'cash_ledger') {
        await supabase.from('cash_ledger').delete().eq('id', id)
        await supabase.from('cash_movements').delete().eq('reference_id', id)
      } else if (type === 'cash_movement') {
        await supabase.from('cash_movements').delete().eq('id', id)
      } else if (type === 'commission_sale') {
        await supabase.from('commission_sales').delete().eq('id', id)
      } else if (type === 'commission_payment') {
        await supabase.from('commission_payments').delete().eq('id', id)
      } else if (type === 'dealer_payout') {
        await supabase.from('commission_dealer_payments').delete().eq('id', id)
      } else if (type === 'commission_fee') {
        await supabase.from('commission_fee_expenses').delete().eq('id', id)
      } else if (type === 'batch') {
        // Chicken debt + choza-supplier allocation are both computed live from
        // farm_batches, so deleting the row reverses them automatically.
        await supabase.from('farm_batches').delete().eq('id', id)
      }
      toast.success('Deleted')
      await fetch()
      return true
    } catch (err) {
      toast.error(err.message || 'Delete failed')
      return false
    }
  }

  return { entries, loading, refetch: fetch, deleteEntry }
}
