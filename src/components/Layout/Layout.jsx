import { useState, useRef, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { useLanguage } from '../../contexts/LanguageContext'

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()
  const { t } = useLanguage()
  const mainRef = useRef(null)

  // Snap each new page back to the top. Without this the scroll container kept
  // the previous page's position, so opening a page could land mid-scroll with
  // the header out of view (especially on mobile).
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0 })
  }, [location.pathname])

  const getTitle = () => {
    const map = {
      '/': t('title.dashboard'),
      '/pos': t('title.pos'),
      '/inventory': t('title.inventory'),
      '/farms': t('title.farms'),
      '/clients': t('title.clients'),
      '/customers': t('title.customers'),
      '/dispatches': t('title.dispatches'),
      '/dispatches/new': t('title.newDispatch'),
      '/roznamcha': t('title.roznamcha'),
      '/supply-payments': t('title.supplyPayments'),
      '/payments': t('title.payments'),
      '/expenses': t('title.expenses'),
      '/store-cash': t('title.storeCash'),
      '/reports': t('title.reports'),
      '/settings': t('title.settings'),
      '/suppliers': t('title.suppliers'),
    }
    if (map[location.pathname]) return map[location.pathname]
    if (location.pathname.startsWith('/farms/')) return t('title.farmDetail')
    if (location.pathname.startsWith('/clients/')) return t('title.clientDetail')
    if (location.pathname.startsWith('/suppliers/')) return t('title.supplierDetail')
    return t('title.dashboard')
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-100">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} title={getTitle()} />

        <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain momentum-scroll p-4 lg:p-6 min-h-0">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
