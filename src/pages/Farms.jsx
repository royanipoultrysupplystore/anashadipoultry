import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Phone, MapPin, Edit2, ChevronRight, Building2, Trash2 } from 'lucide-react'
import { useFarms } from '../hooks/useFarms'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import PhoneInput from '../components/common/PhoneInput'
import { formatCurrency } from '../utils/formatCurrency'
import { useLanguage } from '../contexts/LanguageContext'
import { lf } from '../utils/localizedField'
import { FARM_OWNERSHIP_BI } from '../utils/biLabels'

const emptyForm = { name: '', owner_name: '', phone: '', location: '', notes: '', is_active: true, initial_chicken_count: 0, price_per_chicken: 0, ownership: 'own' }

export default function Farms({ entityKind = 'farm' }) {
  const navigate = useNavigate()
  const { t, lang } = useLanguage()
  const { farms, loading, addFarm, updateFarm, deleteFarm } = useFarms({ kind: entityKind })
  const isClient = entityKind === 'client'
  const detailBase = isClient ? '/clients' : '/farms'
  const L = {
    add: isClient ? t('clients.addClient') : t('farms.addFarm'),
    search: isClient ? t('clients.searchClients') : t('farms.searchFarms'),
    none: isClient ? t('clients.noClients') : t('farms.noFarms'),
    nameLabel: isClient ? t('clients.clientName') : t('farms.farmName'),
    edit: isClient ? t('clients.editClient') : t('farms.editFarm'),
    deleteTitle: isClient ? t('clients.deleteClient') : t('farms.deleteFarm'),
    activeLabel: isClient ? t('clients.activeClient') : t('farms.activeFarm'),
  }
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  function openAdd() { setEditItem(null); setForm(emptyForm); setModalOpen(true) }
  function openEdit(e, farm) { e.stopPropagation(); setEditItem(farm); setForm({ ...farm, ownership: farm.ownership || 'own' }); setModalOpen(true) }

  async function handleSubmit(ev) {
    ev.preventDefault()
    setSaving(true)
    if (editItem) await updateFarm(editItem.id, form)
    else await addFarm(form)
    setSaving(false)
    setModalOpen(false)
  }

  const filtered = farms.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()) || (f.owner_name || '').toLowerCase().includes(search.toLowerCase()))
  const ownFarms = filtered.filter(f => (f.ownership || 'own') === 'own')
  const contractorFarms = filtered.filter(f => f.ownership === 'contractor')

  const renderCard = (farm) => (
    <div
      key={farm.id}
      onClick={() => navigate(`${detailBase}/${farm.id}`)}
      className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md hover:border-[#14B8A6]/30 transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-slate-800 group-hover:text-[#0F5257] transition-colors truncate">{lf(farm, 'name', lang)}</h3>
          <p className="text-sm text-slate-500 truncate">{lf(farm, 'owner_name', lang) || t('farms.noOwner')}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={(e) => openEdit(e, farm)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600">
            <Edit2 size={14} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setDeleteTarget(farm) }} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500">
            <Trash2 size={14} />
          </button>
          <ChevronRight size={16} className="text-slate-300 group-hover:text-[#14B8A6] transition-colors" />
        </div>
      </div>

      <div className={`rounded-xl p-3 mb-4 ${farm.total_debt > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
        <p className={`text-xs font-medium mb-0.5 ${farm.total_debt > 0 ? 'text-red-600' : 'text-green-600'}`}>
          {farm.total_debt > 0 ? t('farms.currentDebt') : t('common.balance')}
        </p>
        <p className={`text-xl font-bold ${farm.total_debt > 0 ? 'text-red-700' : 'text-green-700'}`}>
          {formatCurrency(farm.total_debt)}
        </p>
      </div>

      <div className="space-y-1.5">
        {farm.phone && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Phone size={13} /> {farm.phone}
          </div>
        )}
        {farm.location && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <MapPin size={13} /> {farm.location}
          </div>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${farm.is_active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
            {farm.is_active ? t('common.active') : t('common.inactive')}
          </span>
          {!isClient && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${(farm.ownership || 'own') === 'contractor' ? 'bg-amber-100 text-amber-700' : 'bg-teal-100 text-teal-700'}`}>
              {FARM_OWNERSHIP_BI[farm.ownership || 'own']}
            </span>
          )}
        </div>
        <span className="text-xs text-slate-400 shrink-0">{formatCurrency(farm.total_profit_generated)}</span>
      </div>
    </div>
  )

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="w-8 h-8 border-2 border-[#14B8A6] border-t-transparent rounded-full animate-spin me-3" />{t('common.loading')}
    </div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder={L.search}
          className="flex-1 px-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30"
        />
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-[#0F5257] text-white rounded-xl text-sm font-medium hover:bg-[#14B8A6] transition-colors">
          <Plus size={16} /> {L.add}
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Building2 size={48} className="mb-4 opacity-30" />
          <p className="text-sm">{L.none}</p>
        </div>
      ) : isClient ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(renderCard)}
        </div>
      ) : (
        <div className="space-y-6">
          {ownFarms.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-600 mb-2.5 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0F5257]" /> Our Farms / فارم‌های شخصی
                <span className="text-xs font-normal text-slate-400">({ownFarms.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ownFarms.map(renderCard)}
              </div>
            </section>
          )}
          {contractorFarms.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-slate-600 mb-2.5 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Contractor Farms / فارم‌های قراردادی
                <span className="text-xs font-normal text-slate-400">({contractorFarms.length})</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {contractorFarms.map(renderCard)}
              </div>
            </section>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { deleteFarm(deleteTarget?.id); setDeleteTarget(null) }}
        title={L.deleteTitle}
        message={`${t('common.delete')} "${deleteTarget?.name}"? ${t('farms.deleteConfirm')}`}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? L.edit : L.add}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{L.nameLabel} *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('farms.ownerName')}</label>
            <input value={form.owner_name} onChange={e => setForm(f => ({ ...f, owner_name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          {!isClient && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('farms.initialChickenCount')}</label>
                <input
                  type="number" min="0"
                  value={form.initial_chicken_count || 0}
                  onChange={e => setForm(f => ({ ...f, initial_chicken_count: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">{t('farms.pricePerChicken')}</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.price_per_chicken || 0}
                  onChange={e => setForm(f => ({ ...f, price_per_chicken: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30"
                />
              </div>
            </div>
          )}
          {!isClient && (
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Farm type / نوع فارم</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setForm(f => ({ ...f, ownership: 'own' }))}
                  className={`px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${form.ownership === 'own' ? 'border-teal-500 bg-teal-50 text-teal-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  🏠 Own / شخصی
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, ownership: 'contractor' }))}
                  className={`px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition-colors ${form.ownership === 'contractor' ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  🤝 Contractor / قراردادی
                </button>
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">{t('common.notes')}</label>
            <textarea rows={3} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30 resize-none" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} className="rounded" />
            <label htmlFor="active" className="text-sm text-slate-600">{L.activeLabel}</label>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">{t('common.cancel')}</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#0F5257] text-white rounded-lg hover:bg-[#14B8A6] disabled:opacity-60">
              {saving ? t('common.saving') : editItem ? t('common.saveChanges') : t('farms.addFarm')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
