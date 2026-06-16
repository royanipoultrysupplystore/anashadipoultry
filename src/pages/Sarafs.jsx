import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Phone, MapPin, Repeat, Edit2, Trash2, ChevronRight } from 'lucide-react'
import { useSarafs } from '../hooks/useSarafs'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PhoneInput from '../components/common/PhoneInput'
import { formatCurrency } from '../utils/formatCurrency'
import { useLanguage } from '../contexts/LanguageContext'

const emptyForm = { name: '', phone: '', location: '', notes: '' }

export default function Sarafs() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { sarafs, loading, addSaraf, updateSaraf, deleteSaraf } = useSarafs()
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  function openAdd() { setEditItem(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(ev, s) {
    ev.stopPropagation()
    setEditItem(s)
    setForm({ name: s.name, phone: s.phone || '', location: s.location || '', notes: s.notes || '' })
    setModalOpen(true)
  }

  async function handleSubmit(ev) {
    ev.preventDefault()
    setSaving(true)
    const ok = editItem ? await updateSaraf(editItem.id, form) : await addSaraf(form)
    setSaving(false)
    if (ok) setModalOpen(false)
  }

  const filtered = sarafs.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.phone || '').includes(search) ||
    (s.location || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search sarafs..."
          className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30"
        />
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-[#0F5257] text-white rounded-xl text-sm font-medium hover:bg-[#14B8A6] transition-colors">
          <Plus size={16} /> Add Saraf
        </button>
      </div>

      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600 leading-relaxed">
        <span className="font-semibold text-slate-700">Saraf / صراف</span> — a money exchanger who sits between client and meel.
        Clients send money <span className="font-medium text-green-700">in</span>, the Saraf releases it <span className="font-medium text-red-700">out</span> to suppliers.
        Each Saraf's balance shows how much money is in flight at any moment.
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">
          <div className="w-8 h-8 border-2 border-[#14B8A6] border-t-transparent rounded-full animate-spin me-3" />{t('common.loading')}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Repeat size={48} className="mb-4 opacity-30" />
          <p className="text-sm">{search ? `No saraf matching "${search}"` : 'No sarafs yet — add one to start tracking exchange-money flow'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(s => {
            const balanceColor = s.balance > 0 ? 'text-amber-700 bg-amber-50' : s.balance < 0 ? 'text-red-700 bg-red-50' : 'text-emerald-700 bg-emerald-50'
            const balanceLabel = s.balance > 0 ? 'Holding' : s.balance < 0 ? 'Over-paid' : 'Settled'
            return (
              <div
                key={s.id}
                onClick={() => navigate(`/sarafs/${s.id}`)}
                className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:border-[#14B8A6]/30 transition-all cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-slate-800 group-hover:text-[#0F5257] transition-colors">{s.name}</h3>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={e => openEdit(e, s)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={e => { e.stopPropagation(); setDeleteTarget(s) }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                    <ChevronRight size={16} className="text-slate-300 group-hover:text-[#14B8A6] transition-colors" />
                  </div>
                </div>

                <div className={`rounded-xl p-3 mb-4 ${balanceColor}`}>
                  <p className="text-xs font-medium opacity-80 mb-0.5">{balanceLabel}</p>
                  <p className="text-xl font-bold">{formatCurrency(Math.abs(s.balance))}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-green-600 mb-0.5">In from clients</p>
                    <p className="font-bold text-green-700">{formatCurrency(s.total_in)}</p>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2">
                    <p className="text-red-600 mb-0.5">Out to meels</p>
                    <p className="font-bold text-red-700">{formatCurrency(s.total_out)}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {s.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <Phone size={13} /> {s.phone}
                    </div>
                  )}
                  {s.location && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                      <MapPin size={13} /> {s.location}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { deleteSaraf(deleteTarget?.id); setDeleteTarget(null) }}
        title="Delete Saraf"
        message={`Delete "${deleteTarget?.name}"? Existing payments stay but lose their Saraf link.`}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit Saraf' : 'Add Saraf'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.name')} *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.phone')}</label>
              <PhoneInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.location')}</label>
              <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30 resize-none" />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#0F5257] text-white rounded-lg hover:bg-[#14B8A6] disabled:opacity-60">
              {saving ? t('common.saving') : editItem ? t('common.saveChanges') : 'Add Saraf'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
