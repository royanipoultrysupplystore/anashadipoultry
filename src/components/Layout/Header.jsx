import { Menu, Wallet } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useLanguage } from '../../contexts/LanguageContext'
import { useBusinessInfo } from '../../contexts/SettingsContext'
import { useAuth } from '../../contexts/AuthContext'
import { useStoreCash } from '../../contexts/StoreCashContext'
import { formatCurrency } from '../../utils/formatCurrency'

const LANGUAGES = [
  { code: 'en', label: 'EN', full: 'English' },
  { code: 'fa', label: 'دری', full: 'Dari' },
  { code: 'ps', label: 'پښتو', full: 'Pashto' },
]

export default function Header({ onMenuClick, title }) {
  const { lang, t, setLanguage, isRTL } = useLanguage()
  const { businessName } = useBusinessInfo()
  const { isAdmin } = useAuth()
  const { balance } = useStoreCash()
  const logoLetter = (businessName || '?').trim().charAt(0).toUpperCase()

  return (
    <header className="sticky top-0 z-10 bg-white border-b border-slate-200 px-3 sm:px-4 py-3 flex items-center gap-2 sm:gap-4 shadow-sm">
      <button
        onClick={onMenuClick}
        className="lg:hidden p-2 -ms-1 rounded-lg hover:bg-slate-100 text-slate-600 shrink-0"
      >
        <Menu size={20} />
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="text-base sm:text-lg font-semibold text-slate-800 truncate">{title}</h1>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        {/* Store cash on hand — always visible */}
        {isAdmin && (
          <NavLink
            to="/store-cash"
            title={t('storeCash.title')}
            className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg border text-sm font-semibold transition-colors ${
              balance < 0
                ? 'bg-red-50 border-red-200 text-red-700 hover:bg-red-100'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            <Wallet size={15} />
            <span className="hidden sm:inline">{t('storeCash.cash')}:</span>
            <span dir="ltr">{formatCurrency(balance)}</span>
          </NavLink>
        )}

        {/* Language selector */}
        <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden text-xs sm:text-sm font-medium shrink-0">
          {LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => setLanguage(code)}
              className={`px-1.5 sm:px-3 py-1.5 transition-colors ${
                lang === code
                  ? 'bg-[#0F5257] text-white'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
              title={LANGUAGES.find(l => l.code === code)?.full}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="text-end hidden sm:block">
          <div className="text-xs font-medium text-slate-700">{businessName}</div>
          <div className="text-xs text-slate-400">{t('common.supplyStore')}</div>
        </div>
        <div className="w-8 h-8 rounded-full bg-[#0F5257] text-white flex items-center justify-center text-sm font-bold">
          {logoLetter}
        </div>
      </div>
    </header>
  )
}
