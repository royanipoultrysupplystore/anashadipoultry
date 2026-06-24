import { NavLink, Link } from 'react-router-dom'
import {
  LayoutDashboard, Package, Building2, Truck, CreditCard,
  Receipt, BarChart3, Settings, X,
  ShoppingCart, Users, ShoppingBag, BookOpen, Factory, Banknote, Store, Bird, Coins,
  LogOut, UserCog, Shield, User as UserIcon, Building, Wallet, Repeat
} from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useAuth } from '../../contexts/AuthContext'
import { useBusinessInfo } from '../../contexts/SettingsContext'
import { NAV_BI, SIDEBAR_SECTION_BI } from '../../utils/biLabels'

const ASSOCIATE_PATHS = new Set(['/commission', '/commission-fee'])

// Grouped nav — section headers give the polished, "elite software" feel.
const SECTIONS = [
  { title: null, items: [
    { to: '/', icon: LayoutDashboard, labelKey: 'nav.dashboard' },
    { to: '/roznamcha', icon: BookOpen, labelKey: 'nav.roznamcha' },
    { to: '/pos', icon: ShoppingCart, labelKey: 'nav.pos', highlight: true },
  ]},
  { title: 'Sales', items: [
    { to: '/inventory', icon: Package, labelKey: 'nav.inventory' },
    { to: '/farms', icon: Building2, labelKey: 'nav.farms' },
    { to: '/clients', icon: Building, labelKey: 'nav.clients' },
    { to: '/customers', icon: Users, labelKey: 'nav.customers' },
    { to: '/dispatches', icon: Truck, labelKey: 'nav.dispatches' },
  ]},
  { title: 'Suppliers', items: [
    { to: '/suppliers', icon: Factory, labelKey: 'nav.suppliers' },
    { to: '/supply-payments', icon: ShoppingBag, labelKey: 'nav.supplyPayments' },
  ]},
  { title: 'Money', items: [
    { to: '/store-cash', icon: Wallet, labelKey: 'nav.storeCash' },
    { to: '/cash-ledger', icon: Banknote, labelKey: 'nav.cashLedger' },
    { to: '/sarafs', icon: Repeat, labelKey: 'nav.sarafs' },
    { to: '/payments', icon: CreditCard, labelKey: 'nav.payments' },
    { to: '/expenses', icon: Receipt, labelKey: 'nav.expenses' },
  ]},
  { title: 'Market', items: [
    { to: '/market', icon: Store, labelKey: 'nav.market' },
    { to: '/commission', icon: Bird, labelKey: 'nav.commission' },
    { to: '/commission-fee', icon: Coins, labelKey: 'nav.commissionFee' },
  ]},
  { title: 'System', items: [
    { to: '/reports', icon: BarChart3, labelKey: 'nav.reports' },
    { to: '/users', icon: UserCog, labelKey: 'nav.users' },
    { to: '/settings', icon: Settings, labelKey: 'nav.settings' },
  ]},
]

export default function Sidebar({ open, onClose }) {
  const { t, isRTL } = useLanguage()
  const { user, logout, isAdmin } = useAuth()
  const { businessName } = useBusinessInfo()
  const logoLetter = (businessName || '?').trim().charAt(0).toUpperCase()

  // For associates, keep only their allowed items; drop sections that end up empty.
  const sections = SECTIONS
    .map(s => ({ ...s, items: isAdmin ? s.items : s.items.filter(i => ASSOCIATE_PATHS.has(i.to)) }))
    .filter(s => s.items.length > 0)

  const sideClass = `fixed top-0 ${isRTL ? 'right-0' : 'left-0'} h-full z-30 flex flex-col w-64 bg-gradient-to-b from-[#0C2E31] to-[#06191B] text-white transition-transform duration-300 ease-in-out ${
    open ? 'translate-x-0' : (isRTL ? 'translate-x-full' : '-translate-x-full')
  } lg:translate-x-0 lg:static lg:z-auto border-e border-white/5`

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-20 lg:hidden" onClick={onClose} />}

      <aside className={sideClass}>
        {/* Brand header */}
        <div className="flex items-center justify-between px-4 h-16 shrink-0 border-b border-white/5">
          <Link to="/" onClick={onClose} aria-label="Go to Dashboard" className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#2DD4BF] to-[#0D9488] flex items-center justify-center text-white font-bold text-base shadow-lg ring-1 ring-white/20 shrink-0">
              {logoLetter}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold leading-tight truncate">{businessName}</div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-teal-300/50">{t('common.supplyStore')}</div>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden p-1 rounded hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2 overflow-y-auto scrollbar-thin">
          {sections.map((section, si) => (
            <div key={si} className="px-2 py-1">
              {section.title && (
                <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-300/40">
                  {SIDEBAR_SECTION_BI[section.title] || section.title}
                </div>
              )}
              {section.items.map(({ to, icon: Icon, labelKey, highlight }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `relative flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                      isActive ? 'bg-white/10 text-white' : 'text-teal-50/55 hover:text-white hover:bg-white/[0.06]'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className={`absolute inset-y-1.5 start-0 w-0.5 rounded-full bg-[#2DD4BF] transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                      <Icon size={18} className={isActive ? 'text-[#2DD4BF] shrink-0' : 'shrink-0'} />
                      <span className="flex-1 truncate">{NAV_BI[labelKey] || t(labelKey)}</span>
                      {highlight && (
                        <span className="text-[9px] bg-emerald-400 text-emerald-950 px-1.5 py-0.5 rounded-full font-bold tracking-wide">POS</span>
                      )}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* User + Logout */}
        {user && (
          <div className="border-t border-white/5 px-3 py-3 space-y-2 shrink-0">
            <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-white/5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2DD4BF] to-[#0D9488] flex items-center justify-center text-white text-sm font-bold shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white truncate">{user.name}</div>
                <div className="text-xs text-teal-200/60 flex items-center gap-1">
                  {isAdmin ? <Shield size={10} /> : <UserIcon size={10} />}
                  {isAdmin ? 'Admin' : 'Associate'}
                </div>
              </div>
            </div>
            <button
              onClick={() => { logout(); onClose() }}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-teal-50/70 hover:bg-red-500/20 hover:text-red-200 transition-colors"
            >
              <LogOut size={14} /> Sign Out
            </button>
            <div className="text-[10px] text-white/25 text-center pt-1">{businessName} v1.0</div>
          </div>
        )}
      </aside>
    </>
  )
}
