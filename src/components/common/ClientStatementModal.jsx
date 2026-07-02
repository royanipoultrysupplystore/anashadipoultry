import { useState, useEffect } from 'react'
import { Send, FileText } from 'lucide-react'
import { supabase } from '../../config/supabase'
import Modal from './Modal'
import WhatsAppPromptDialog from './WhatsAppPromptDialog'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatDate, todayStr } from '../../utils/dateHelpers'
import { useLanguage } from '../../contexts/LanguageContext'
import { lf } from '../../utils/localizedField'

const num = (n) => (Number(n) || 0).toLocaleString()
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

// Account statement for a client over a date range: gathers every charge (Dana
// bills / dispatches) and payment in the window, shows a table, and builds a
// bilingual (English + Pashto) WhatsApp message ready to send.
export default function ClientStatementModal({ open, onClose, farm, currentBalance = 0 }) {
  const { lang } = useLanguage()
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(todayStr())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [waPrompt, setWaPrompt] = useState(null)

  const name = farm ? (lf(farm, 'name', lang) || farm.name) : ''

  useEffect(() => {
    if (!open || !farm?.id) return
    let alive = true
    ;(async () => {
      setLoading(true)
      const [billsRes, paysRes, dispRes] = await Promise.all([
        supabase.from('supplier_dispatches').select('id, bill_number, quantity, price_per_bag, total_amount, dispatch_date')
          .eq('farm_id', farm.id).gte('dispatch_date', from).lte('dispatch_date', to),
        supabase.from('payments').select('id, amount, payment_date, notes, hawala_number, sarafs(name)')
          .eq('farm_id', farm.id).gte('payment_date', from).lte('payment_date', to),
        supabase.from('dispatches').select('id, total_amount, dispatch_date, notes')
          .eq('farm_id', farm.id).gte('dispatch_date', from).lte('dispatch_date', to),
      ])
      const out = []
      for (const b of billsRes.data || []) out.push({
        date: b.dispatch_date, kind: 'bill',
        label: `Bill #${b.bill_number || '—'}`,
        sub: `${num(b.quantity)} × ${num(b.price_per_bag)}`,
        charge: parseFloat(b.total_amount) || 0, credit: 0,
      })
      for (const d of dispRes.data || []) out.push({
        date: d.dispatch_date, kind: 'dispatch',
        label: 'Dispatch / ارسال', sub: d.notes || '',
        charge: parseFloat(d.total_amount) || 0, credit: 0,
      })
      for (const p of paysRes.data || []) out.push({
        date: p.payment_date, kind: 'payment',
        label: 'Payment / تادیه',
        sub: [p.sarafs?.name ? `🔁 ${p.sarafs.name}` : '', p.hawala_number ? `حواله #${p.hawala_number}` : '', p.notes || ''].filter(Boolean).join(' · '),
        charge: 0, credit: parseFloat(p.amount) || 0,
      })
      out.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
      if (alive) { setRows(out); setLoading(false) }
    })()
    return () => { alive = false }
  }, [open, farm?.id, from, to])

  const totalBilled = rows.reduce((s, r) => s + r.charge, 0)
  const totalPaid = rows.reduce((s, r) => s + r.credit, 0)

  function handleSend() {
    const items = rows.length === 0
      ? '—'
      : rows.map(r => {
          const icon = r.charge ? '🧾' : '💵'
          const amt = r.charge ? `+${num(r.charge)}` : `−${num(r.credit)}`
          return `${formatDate(r.date)}  ${icon} ${r.label}  ${amt}`
        }).join('\n')
    setWaPrompt({
      templateKey: 'client_statement',
      variables: {
        name,
        from: formatDate(from),
        to: formatDate(to),
        items_list: '\n' + items,
        billed: num(totalBilled),
        paid: num(totalPaid),
        balance: num(currentBalance),
      },
      recipient: { name, phone: farm?.phone },
    })
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title={`📄 Statement / د حساب صورت — ${name}`} size="xl">
        <div className="space-y-4">
          {/* Range picker */}
          <div className="flex flex-wrap items-end gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">From / له</label>
              <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">To / تر</label>
              <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
            </div>
            <p className="text-xs text-slate-400 ms-auto self-center">{rows.length} transaction(s) / معاملې</p>
          </div>

          {/* Table */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-xs">
                    <th className="text-start font-semibold px-3 py-2.5">Date / نیټه</th>
                    <th className="text-start font-semibold px-3 py-2.5">Details / تفصیل</th>
                    <th className="text-end font-semibold px-3 py-2.5">Bill / بل</th>
                    <th className="text-end font-semibold px-3 py-2.5">Paid / تادیه</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr><td colSpan={4} className="text-center py-8 text-slate-400">Loading… / بارول…</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan={4} className="text-center py-8 text-slate-400">No transactions in this range / په دې موده کې معامله نشته</td></tr>
                  ) : rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 text-slate-600 whitespace-nowrap" dir="ltr">{formatDate(r.date)}</td>
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-slate-800">{r.label}</p>
                        {r.sub && <p className="text-xs text-slate-400">{r.sub}</p>}
                      </td>
                      <td className="px-3 py-2.5 text-end font-semibold text-red-600 whitespace-nowrap">{r.charge ? formatCurrency(r.charge) : '—'}</td>
                      <td className="px-3 py-2.5 text-end font-semibold text-green-600 whitespace-nowrap">{r.credit ? formatCurrency(r.credit) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                {rows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 font-bold text-slate-700">
                      <td className="px-3 py-2.5" colSpan={2}>Total / مجموعه</td>
                      <td className="px-3 py-2.5 text-end text-red-700 whitespace-nowrap">{formatCurrency(totalBilled)}</td>
                      <td className="px-3 py-2.5 text-end text-green-700 whitespace-nowrap">{formatCurrency(totalPaid)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-red-200 bg-red-50 p-3">
              <p className="text-xs text-red-600 mb-0.5">Total billed / ټول بل</p>
              <p className="text-lg font-bold text-red-700">{formatCurrency(totalBilled)}</p>
            </div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-3">
              <p className="text-xs text-green-600 mb-0.5">Total paid / ټوله تادیه</p>
              <p className="text-lg font-bold text-green-700">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-600 mb-0.5">Current balance / اوسنی بیلانس</p>
              <p className="text-lg font-bold text-amber-700">{formatCurrency(currentBalance)}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-end pt-1">
            <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Close / بندول</button>
            <button onClick={handleSend} disabled={!farm?.phone}
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
              <Send size={15} /> Send via WhatsApp / د واتساپ له لارې واستوئ
            </button>
          </div>
          {!farm?.phone && <p className="text-xs text-amber-700 text-end">⚠ No phone number on file / د تلیفون شمېره نشته</p>}
        </div>
      </Modal>

      <WhatsAppPromptDialog
        open={!!waPrompt}
        onClose={() => setWaPrompt(null)}
        templateKey={waPrompt?.templateKey}
        variables={waPrompt?.variables}
        recipient={waPrompt?.recipient}
      />
    </>
  )
}
