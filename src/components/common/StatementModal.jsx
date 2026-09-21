import { useState, useEffect } from 'react'
import { Send } from 'lucide-react'
import { supabase } from '../../config/supabase'
import Modal from './Modal'
import WhatsAppPromptDialog from './WhatsAppPromptDialog'
import { formatCurrency } from '../../utils/formatCurrency'
import { formatDate, todayStr } from '../../utils/dateHelpers'
import { useLanguage } from '../../contexts/LanguageContext'
import { lf } from '../../utils/localizedField'

const num = (n) => (Number(n) || 0).toLocaleString()
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

// Per-entity statement config. Each row carries two amount columns (c1, c2);
// what they mean and how they map to the WhatsApp template differs by kind.
const KIND = {
  client: {
    c1: { label: 'Bill / بل', txt: 'text-red-600', foot: 'text-red-700', icon: '🧾', box: 'red' },
    c2: { label: 'Paid / تادیه', txt: 'text-green-600', foot: 'text-green-700', icon: '💵', box: 'green' },
    balLabel: 'Current balance / اوسنی بیلانس',
    template: 'client_statement',
    vars: (t1, t2, bal) => ({ billed: num(t1), paid: num(t2), balance: num(bal) }),
  },
  supplier: {
    c1: { label: 'Billed / بل', txt: 'text-red-600', foot: 'text-red-700', icon: '🧾', box: 'red' },
    c2: { label: 'Paid / تادیه', txt: 'text-green-600', foot: 'text-green-700', icon: '💵', box: 'green' },
    balLabel: 'We owe / پاتې پور',
    template: 'supplier_statement',
    vars: (t1, t2, bal) => ({ billed: num(t1), paid: num(t2), balance: num(bal) }),
  },
  saraf: {
    c1: { label: 'In / دننه', txt: 'text-green-600', foot: 'text-green-700', icon: '⬇️', box: 'green' },
    c2: { label: 'Out / بهر', txt: 'text-red-600', foot: 'text-red-700', icon: '⬆️', box: 'red' },
    balLabel: 'Holding / موجوده',
    template: 'saraf_statement',
    vars: (t1, t2, bal) => ({ inflow: num(t1), outflow: num(t2), holding: num(bal) }),
  },
}
const BOX = {
  red: { wrap: 'border-red-200 bg-red-50', lbl: 'text-red-600', val: 'text-red-700' },
  green: { wrap: 'border-green-200 bg-green-50', lbl: 'text-green-600', val: 'text-green-700' },
  amber: { wrap: 'border-amber-200 bg-amber-50', lbl: 'text-amber-600', val: 'text-amber-700' },
}

async function fetchRows(kind, id, from, to, lang) {
  const out = []
  const between = (q, col) => q.eq(kind === 'client' ? 'farm_id' : kind === 'supplier' ? 'supplier_id' : 'saraf_id', id).gte(col, from).lte(col, to)

  if (kind === 'client' || kind === 'supplier') {
    const bills = await between(supabase.from('supplier_dispatches').select('bill_number, quantity, price_per_bag, total_amount, dispatch_date, farms(name, name_fa, name_ps)'), 'dispatch_date')
    for (const b of bills.data || []) out.push({
      date: b.dispatch_date, label: `Bill #${b.bill_number || '—'}`,
      sub: kind === 'supplier' && b.farms ? (lf(b.farms, 'name', lang) || '') : `${num(b.quantity)} × ${num(b.price_per_bag)}`,
      c1: parseFloat(b.total_amount) || 0, c2: 0,
    })
  }
  if (kind === 'client') {
    // Pull the line items too — a statement that just says "Dispatch" tells the
    // farm nothing about what they were billed for.
    const disp = await between(
      supabase.from('dispatches').select('total_amount, dispatch_date, notes, dispatch_items(quantity, products(name, unit))'),
      'dispatch_date',
    )
    for (const d of disp.data || []) {
      const items = (d.dispatch_items || [])
        .map(i => `${i.products?.name || '—'} × ${num(i.quantity)}${i.products?.unit ? ` ${i.products.unit}` : ''}`)
        .join(' · ')
      out.push({
        date: d.dispatch_date,
        label: 'Dispatch / ارسال',
        sub: [items, d.notes || ''].filter(Boolean).join(' · '),
        c1: parseFloat(d.total_amount) || 0,
        c2: 0,
      })
    }
    const pays = await between(supabase.from('payments').select('amount, payment_date, notes, hawala_number, sarafs(name)'), 'payment_date')
    for (const p of pays.data || []) out.push({ date: p.payment_date, label: 'Payment / تادیه', sub: [p.sarafs?.name ? `🔁 ${p.sarafs.name}` : '', p.hawala_number ? `حواله #${p.hawala_number}` : '', p.notes || ''].filter(Boolean).join(' · '), c1: 0, c2: parseFloat(p.amount) || 0 })
  }
  if (kind === 'supplier') {
    const pays = await between(supabase.from('supplier_payments').select('amount, payment_date, notes, hawala_number, sarafs(name)'), 'payment_date')
    for (const p of pays.data || []) out.push({ date: p.payment_date, label: 'Payment / تادیه', sub: [p.sarafs?.name ? `🔁 ${p.sarafs.name}` : '', p.hawala_number ? `حواله #${p.hawala_number}` : '', p.notes || ''].filter(Boolean).join(' · '), c1: 0, c2: parseFloat(p.amount) || 0 })
  }
  if (kind === 'saraf') {
    const ins = await between(supabase.from('payments').select('amount, payment_date, notes, hawala_number, farms(name, name_fa, name_ps)'), 'payment_date')
    for (const p of ins.data || []) out.push({ date: p.payment_date, label: `In · ${lf(p.farms, 'name', lang) || '—'}`, sub: [p.hawala_number ? `حواله #${p.hawala_number}` : '', p.notes || ''].filter(Boolean).join(' · '), c1: parseFloat(p.amount) || 0, c2: 0 })
    const outs = await between(supabase.from('supplier_payments').select('amount, payment_date, notes, hawala_number, suppliers(company_name)'), 'payment_date')
    for (const p of outs.data || []) out.push({ date: p.payment_date, label: `Out · ${p.suppliers?.company_name || '—'}`, sub: [p.hawala_number ? `حواله #${p.hawala_number}` : '', p.notes || ''].filter(Boolean).join(' · '), c1: 0, c2: parseFloat(p.amount) || 0 })
  }
  out.sort((a, b) => (a.date || '').localeCompare(b.date || ''))
  return out
}

// Account statement over a date range for a client / supplier / saraf. Renders a
// table + summary and builds a bilingual (English + Pashto) WhatsApp message.
export default function StatementModal({ open, onClose, kind = 'client', entity, currentBalance = 0 }) {
  const { lang } = useLanguage()
  const [from, setFrom] = useState(daysAgo(30))
  const [to, setTo] = useState(todayStr())
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [waPrompt, setWaPrompt] = useState(null)

  const cfg = KIND[kind] || KIND.client
  const name = entity?.name || ''

  useEffect(() => {
    if (!open || !entity?.id) return
    let alive = true
    ;(async () => {
      setLoading(true)
      const r = await fetchRows(kind, entity.id, from, to, lang)
      if (alive) { setRows(r); setLoading(false) }
    })()
    return () => { alive = false }
  }, [open, entity?.id, kind, from, to, lang])

  const total1 = rows.reduce((s, r) => s + r.c1, 0)
  const total2 = rows.reduce((s, r) => s + r.c2, 0)

  function handleSend() {
    const items = rows.length === 0 ? '—' : rows.map(r => {
      const isC1 = r.c1 > 0
      const icon = isC1 ? cfg.c1.icon : cfg.c2.icon
      const amt = isC1 ? `+${num(r.c1)}` : `−${num(r.c2)}`
      const head = `${formatDate(r.date)}  ${icon} ${r.label}  ${amt}`
      // Item detail goes on its own indented line so the message stays readable.
      return r.sub ? `${head}\n    ${r.sub}` : head
    }).join('\n')
    setWaPrompt({
      templateKey: cfg.template,
      variables: { name, from: formatDate(from), to: formatDate(to), items_list: '\n' + items, ...cfg.vars(total1, total2, currentBalance) },
      recipient: { name, phone: entity?.phone },
    })
  }

  const b1 = BOX[cfg.c1.box], b2 = BOX[cfg.c2.box], bBal = BOX.amber

  return (
    <>
      <Modal open={open} onClose={onClose} title={`📄 Statement / د حساب صورت — ${name}`} size="xl">
        <div className="space-y-4">
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

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 text-xs">
                    <th className="text-start font-semibold px-3 py-2.5">Date / نیټه</th>
                    <th className="text-start font-semibold px-3 py-2.5">Details / تفصیل</th>
                    <th className="text-end font-semibold px-3 py-2.5">{cfg.c1.label}</th>
                    <th className="text-end font-semibold px-3 py-2.5">{cfg.c2.label}</th>
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
                        <p className="text-xs text-slate-400">{r.label}</p>
                        {/* The items are what the customer actually wants to read,
                            so they lead; the row type sits above as a small label. */}
                        {r.sub && <p className="text-sm font-semibold text-slate-800 mt-0.5">{r.sub}</p>}
                      </td>
                      <td className={`px-3 py-2.5 text-end font-semibold whitespace-nowrap ${cfg.c1.txt}`}>{r.c1 ? formatCurrency(r.c1) : '—'}</td>
                      <td className={`px-3 py-2.5 text-end font-semibold whitespace-nowrap ${cfg.c2.txt}`}>{r.c2 ? formatCurrency(r.c2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                {rows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 font-bold text-slate-700">
                      <td className="px-3 py-2.5" colSpan={2}>Total / مجموعه</td>
                      <td className={`px-3 py-2.5 text-end whitespace-nowrap ${cfg.c1.foot}`}>{formatCurrency(total1)}</td>
                      <td className={`px-3 py-2.5 text-end whitespace-nowrap ${cfg.c2.foot}`}>{formatCurrency(total2)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className={`rounded-xl border p-3 ${b1.wrap}`}>
              <p className={`text-xs mb-0.5 ${b1.lbl}`}>{cfg.c1.label}</p>
              <p className={`text-lg font-bold ${b1.val}`}>{formatCurrency(total1)}</p>
            </div>
            <div className={`rounded-xl border p-3 ${b2.wrap}`}>
              <p className={`text-xs mb-0.5 ${b2.lbl}`}>{cfg.c2.label}</p>
              <p className={`text-lg font-bold ${b2.val}`}>{formatCurrency(total2)}</p>
            </div>
            <div className={`rounded-xl border p-3 ${bBal.wrap}`}>
              <p className={`text-xs mb-0.5 ${bBal.lbl}`}>{cfg.balLabel}</p>
              <p className={`text-lg font-bold ${bBal.val}`}>{formatCurrency(currentBalance)}</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-end pt-1">
            <button onClick={onClose} className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Close / بندول</button>
            <button onClick={handleSend} disabled={!entity?.phone}
              className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed">
              <Send size={15} /> Send via WhatsApp / د واتساپ له لارې واستوئ
            </button>
          </div>
          {!entity?.phone && <p className="text-xs text-amber-700 text-end">⚠ No phone number on file / د تلیفون شمېره نشته</p>}
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
