import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Shield, User, UserCog, Building2 } from 'lucide-react'
import { supabase } from '../config/supabase'
import { useAuth } from '../contexts/AuthContext'
import Modal from '../components/common/Modal'
import ConfirmDialog from '../components/common/ConfirmDialog'
import { formatDate } from '../utils/dateHelpers'
import toast from 'react-hot-toast'

const emptyForm = { name: '', username: '', password: '', role: 'associate', entity_type: 'client', entity_id: '' }

const ENTITY_TYPES = [
  { value: 'client', label: 'Client / مشتری' },
  { value: 'farm', label: 'Farm / فارم' },
  { value: 'supplier', label: 'Supplier / تأمین‌کننده' },
  { value: 'saraf', label: 'Saraf / صراف' },
]

export default function Users() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  // Entity option lists for the picker
  const [farmsList, setFarmsList] = useState([])
  const [suppliersList, setSuppliersList] = useState([])
  const [sarafsList, setSarafsList] = useState([])

  async function fetchUsers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('app_users')
      .select('id, name, username, role, entity_type, entity_id, created_at')
      .order('created_at', { ascending: true })
    if (error) toast.error(error.message)
    else setUsers(data || [])
    setLoading(false)
  }

  async function fetchEntities() {
    const [f, s, sr] = await Promise.all([
      supabase.from('farms').select('id, name, kind'),
      supabase.from('suppliers').select('id, company_name, type'),
      supabase.from('sarafs').select('id, name'),
    ])
    setFarmsList(f.data || [])
    setSuppliersList((s.data || []).filter(x => (x.type || 'meel') === 'meel'))
    setSarafsList(sr.data || [])
  }

  useEffect(() => { fetchUsers(); fetchEntities() }, [])

  // Options for the entity dropdown, by the chosen type.
  function entityOptions(type) {
    if (type === 'client') return farmsList.filter(f => f.kind === 'client').map(f => ({ id: f.id, name: f.name }))
    if (type === 'farm') return farmsList.filter(f => f.kind !== 'client').map(f => ({ id: f.id, name: f.name }))
    if (type === 'supplier') return suppliersList.map(s => ({ id: s.id, name: s.company_name }))
    if (type === 'saraf') return sarafsList.map(s => ({ id: s.id, name: s.name }))
    return []
  }

  // Resolve an entity_id to a display name (for the table).
  function entityName(u) {
    if (!u.entity_id) return '—'
    const opt = entityOptions(u.entity_type).find(o => o.id === u.entity_id)
    return opt?.name || '—'
  }

  function openAdd() {
    setEditItem(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(u) {
    setEditItem(u)
    setForm({ name: u.name, username: u.username, password: '', role: u.role, entity_type: u.entity_type || 'client', entity_id: u.entity_id || '' })
    setModalOpen(true)
  }

  // When an entity is picked, auto-fill the name (and suggest a username).
  function pickEntity(id) {
    const opt = entityOptions(form.entity_type).find(o => o.id === id)
    setForm(f => ({
      ...f,
      entity_id: id,
      name: f.name || opt?.name || '',
      username: f.username || (opt?.name ? opt.name.toLowerCase().replace(/\s+/g, '') : ''),
    }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!editItem && !form.password) { toast.error('Password is required for new users'); return }
    if (form.role === 'entity' && !form.entity_id) { toast.error('Pick which account this login belongs to'); return }
    setSaving(true)
    const entity_type = form.role === 'entity' ? form.entity_type : null
    const entity_id = form.role === 'entity' ? form.entity_id : null

    if (editItem) {
      const { error } = await supabase.rpc('update_user', {
        p_id: editItem.id, p_name: form.name, p_username: form.username,
        p_role: form.role, p_password: form.password || null,
      })
      if (error) { toast.error(error.message); setSaving(false); return }
      await supabase.from('app_users').update({ entity_type, entity_id }).eq('id', editItem.id)
      toast.success('User updated')
    } else {
      const { data, error } = await supabase.rpc('add_user', {
        p_name: form.name, p_username: form.username, p_password: form.password, p_role: form.role,
      })
      if (error) { toast.error(error.message); setSaving(false); return }
      if (entity_id && data) await supabase.from('app_users').update({ entity_type, entity_id }).eq('id', data)
      toast.success('User added')
    }
    setSaving(false)
    setModalOpen(false)
    await fetchUsers()
  }

  async function handleDelete(id) {
    const { error } = await supabase.from('app_users').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('User deleted'); await fetchUsers() }
  }

  const roleBadge = (role) => role === 'admin'
    ? { cls: 'bg-purple-100 text-purple-700', icon: <Shield size={11} />, text: 'Admin' }
    : role === 'entity'
    ? { cls: 'bg-teal-100 text-teal-700', icon: <Building2 size={11} />, text: 'Entity' }
    : { cls: 'bg-green-100 text-green-700', icon: <User size={11} />, text: 'Associate' }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <UserCog size={22} className="text-[#0F5257]" /> Users & Access
        </h2>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 bg-[#0F5257] text-white rounded-xl text-sm font-medium hover:bg-[#14B8A6]">
          <Plus size={16} /> Add User
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700 space-y-1">
        <p><strong>Admin</strong> sees and manages everything.</p>
        <p><strong>Associate</strong> only sees the Commission section.</p>
        <p><strong>Entity</strong> logs in to a single account (a client, farm, supplier or saraf) and manages only that account — so they can do their own data entry.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs text-slate-400 uppercase">
                  <th className="text-start px-5 py-3 font-medium">Name</th>
                  <th className="text-start px-5 py-3 font-medium">Username</th>
                  <th className="text-start px-5 py-3 font-medium">Role</th>
                  <th className="text-start px-5 py-3 font-medium">Account</th>
                  <th className="text-start px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(u => {
                  const b = roleBadge(u.role)
                  return (
                    <tr key={u.id} className="hover:bg-slate-50">
                      <td className="px-5 py-3 font-medium text-slate-800">
                        {u.name}
                        {u.id === currentUser.id && <span className="ms-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">You</span>}
                      </td>
                      <td className="px-5 py-3 text-slate-600 font-mono" dir="ltr">{u.username}</td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${b.cls}`}>{b.icon}{b.text}</span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{u.role === 'entity' ? entityName(u) : '—'}</td>
                      <td className="px-5 py-3 text-slate-500 text-xs">{formatDate(u.created_at)}</td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => openEdit(u)} className="p-1.5 text-slate-500 hover:bg-slate-100 rounded-lg"><Edit2 size={14} /></button>
                          {u.id !== currentUser.id && (
                            <button onClick={() => setDeleteTarget(u)} className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Edit User' : 'Add User'}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Role *</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { v: 'admin', icon: <Shield size={14} />, label: 'Admin', on: 'border-purple-500 bg-purple-50 text-purple-700' },
                { v: 'associate', icon: <User size={14} />, label: 'Associate', on: 'border-green-500 bg-green-50 text-green-700' },
                { v: 'entity', icon: <Building2 size={14} />, label: 'Entity', on: 'border-teal-500 bg-teal-50 text-teal-700' },
              ].map(r => (
                <label key={r.v} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 cursor-pointer text-sm font-medium ${form.role === r.v ? r.on : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  <input type="radio" name="role" value={r.v} checked={form.role === r.v} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="sr-only" />
                  {r.icon} {r.label}
                </label>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-1.5">
              {form.role === 'admin' ? 'Full access to the entire system'
                : form.role === 'entity' ? 'Logs in to one account and manages only that account'
                : 'Only sees the Commission section'}
            </p>
          </div>

          {form.role === 'entity' && (
            <div className="rounded-xl border border-teal-200 bg-teal-50/50 p-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Account type *</label>
                <select value={form.entity_type}
                  onChange={e => setForm(f => ({ ...f, entity_type: e.target.value, entity_id: '' }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-300">
                  {ENTITY_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Which account *</label>
                <select value={form.entity_id} onChange={e => pickEntity(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-teal-300">
                  <option value="">— pick the account —</option>
                  {entityOptions(form.entity_type).map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
                {entityOptions(form.entity_type).length === 0 && (
                  <p className="text-xs text-amber-700 mt-1">No accounts of this type yet — add one first.</p>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Full Name *</label>
            <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Username *</label>
            <input required value={form.username}
              onChange={e => setForm(f => ({ ...f, username: e.target.value.toLowerCase().replace(/\s/g, '') }))}
              dir="ltr" autoComplete="off" placeholder="e.g. ahmad"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Password {!editItem && '*'}
              {editItem && <span className="text-slate-400 ms-1 font-normal">(leave blank to keep current)</span>}
            </label>
            <input type="text" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              dir="ltr" autoComplete="off" required={!editItem}
              placeholder={editItem ? '••••••••' : 'Min 6 characters'} minLength={editItem ? 0 : 6}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/30" />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium bg-[#0F5257] text-white rounded-lg hover:bg-[#14B8A6] disabled:opacity-60">
              {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Add User'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => handleDelete(deleteTarget?.id)}
        title="Delete User"
        message={`Delete user "${deleteTarget?.name}"? They will no longer be able to log in.`}
        confirmLabel="Delete"
      />
    </div>
  )
}
