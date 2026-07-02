import { useState, useEffect } from 'react'
import { Bell, X } from 'lucide-react'
import { supabase } from '../../config/supabase'
import { useDueReminders } from '../../hooks/useClientReminders'
import { useAuth } from '../../contexts/AuthContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { formatCurrency } from '../../utils/formatCurrency'
import { todayStr } from '../../utils/dateHelpers'
import { lf } from '../../utils/localizedField'
import { playNotificationSound } from '../../utils/notificationSound'
import WhatsAppPromptDialog from './WhatsAppPromptDialog'

// Live remaining for one client — same formula as useEntityDebts('client'),
// but scoped to a single farm so it's cheap to run when a reminder pops.
async function fetchClientRemaining(farmId) {
  const [dispRes, payRes, billRes, farmRes] = await Promise.all([
    supabase.from('dispatches').select('total_amount').eq('farm_id', farmId),
    supabase.from('payments').select('amount').eq('farm_id', farmId),
    supabase.from('supplier_dispatches').select('total_amount').eq('farm_id', farmId),
    supabase.from('farms').select('opening_balance').eq('id', farmId).single(),
  ])
  const dispatched = (dispRes.data || []).reduce((s, d) => s + (d.total_amount || 0), 0)
  const paid = (payRes.data || []).reduce((s, p) => s + (p.amount || 0), 0)
  const bills = (billRes.data || []).reduce((s, b) => s + (parseFloat(b.total_amount) || 0), 0)
  const opening = parseFloat(farmRes.data?.opening_balance) || 0
  return Math.max(0, opening + dispatched + bills - paid)
}

// App-wide popup: surfaces client payment reminders that have come due and
// offers to send a WhatsApp balance reminder. Rendered once in Layout.
export default function ClientReminderPopup() {
  const { isAdmin } = useAuth()
  const { lang } = useLanguage()
  const { due, completeReminder } = useDueReminders()
  const [dismissed, setDismissed] = useState(() => new Set()) // "Close" — this session only
  const [remaining, setRemaining] = useState(null)
  const [waPrompt, setWaPrompt] = useState(null)

  const active = due.find(r => !dismissed.has(r.id)) || null

  useEffect(() => {
    let alive = true
    if (!active) { setRemaining(null); return }
    playNotificationSound() // chime when a reminder comes due
    setRemaining(null)
    fetchClientRemaining(active.farm_id).then(v => { if (alive) setRemaining(v) })
    return () => { alive = false }
  }, [active?.id])

  if (!isAdmin || !active) {
    return <WhatsAppPromptDialog open={!!waPrompt} onClose={() => setWaPrompt(null)} templateKey={waPrompt?.templateKey} variables={waPrompt?.variables} recipient={waPrompt?.recipient} />
  }

  const name = lf(active.farms, 'name', lang) || active.farms?.name || '—'
  const hasPhone = !!active.farms?.phone

  function handleSend() {
    setWaPrompt({
      templateKey: 'balance_reminder',
      variables: { name, amount: formatCurrency(remaining || 0), date: todayStr() },
      recipient: { name, phone: active.farms?.phone },
    })
    completeReminder(active.id)
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 bg-amber-50 border-b border-amber-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-400 flex items-center justify-center text-white">
                <Bell size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-800">Payment reminder / د تادیې یادونه</h3>
                <p className="text-xs text-slate-500">This client is due for a follow-up</p>
              </div>
            </div>
            <button onClick={() => setDismissed(s => new Set(s).add(active.id))} title="Close / بندول" className="p-1.5 text-slate-400 hover:bg-white rounded-lg">
              <X size={18} />
            </button>
          </div>

          <div className="px-5 py-4 space-y-3">
            <p className="text-lg font-semibold text-slate-800">{name}</p>
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-xs font-medium text-red-600 mb-0.5">Total remaining / مجموعه باقي</p>
              <p className="text-2xl font-bold text-red-700">{remaining === null ? '…' : formatCurrency(remaining)}</p>
            </div>
            <p className="text-sm text-slate-600">
              <span className="font-medium">{name}</span> needs to be contacted. Do you want to send a balance reminder?
            </p>
            {active.note && <p className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">📝 {active.note}</p>}
            {!hasPhone && <p className="text-xs text-amber-700">⚠ No phone number on file — add one to send a WhatsApp message.</p>}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50">
            <button
              onClick={handleSend}
              disabled={!hasPhone}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              💬 Send balance reminder / پیغام واستوئ
            </button>
            <button
              onClick={() => completeReminder(active.id)}
              className="px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-100"
            >
              No / نه
            </button>
          </div>
        </div>
      </div>

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
