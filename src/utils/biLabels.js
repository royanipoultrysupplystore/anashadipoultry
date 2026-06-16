// Bilingual EN / Dari labels for transaction-side terms across Anas Hadi.
// Used wherever a customer-facing or transaction artifact appears — so the user
// sees "Medicine / دوا" instead of just "Medicine", regardless of the active UI language.

// Product categories (used on Inventory tabs, dispatch category tabs, etc.)
export const PRODUCT_CATEGORY_BI = {
  medicine:  'Medicine / دوا',
  medicines: 'Medicines / ادویه‌ها',
  meel:      'Feed / دانه',
  food:      'Feed / دانه',
  feed:      'Feed (Dana) / دانه',
  choza:     'Choza / چوزه',
  coal:      'Coal / زغال',
  meel_bill: 'Feed Bills / بل دانه',
}

// Expense categories (used on Expenses tables and Roznamcha cards)
export const EXPENSE_CATEGORY_BI = {
  fuel:        'Fuel / تیل',
  salary:      'Salary / معاش',
  rent:        'Rent / کرایه',
  maintenance: 'Maintenance / تعمیر',
  utilities:   'Utilities / خدمات',
  other:       'Other / دیگر',
}

// Roznamcha entry type badges
export const ROZNAMCHA_TYPE_BI = {
  dispatch:          'Dispatch / ارسال',
  payment:           'Payment / پرداخت',
  sale:              'Sale / فروش',
  supply:            'Supply / تدارکات',
  expense:           'Expense / مصرف',
  stock:             'Stock / موجودی',
  supplier_dispatch: 'Goods In / مال رسید',
  supplier_payment:  'Supplier Paid / پرداخت تأمین‌کننده',
  market_tx:         'To Market / به بازار',
  market_payment:    'Market Payment / دریافت از بازار',
  cash_ledger:       'Loan / قرض',
  cash_movement:     'Cash Drawer / صندوق نقدی',
  commission_sale:   'Commission Sale / فروش کمیشن',
  commission_payment:'Commission Payment / تادیه کمیشن',
  dealer_payout:     'Dealer Payout / پرداخت به دیلر',
  commission_fee:    'Commission Fee / فیس کمیشن',
  batch:             'Chicken Batch / دوره مرغ',
}

// Farm ownership (Anas Hadi runs own + contractor farms)
export const FARM_OWNERSHIP_BI = {
  own: 'Own / شخصی',
  contractor: 'Contractor / قراردادی',
}

// Supply payment items
export const SUPPLY_ITEM_BI = {
  Sugar:        'Sugar / شکر',
  Coal:         'Coal / زغال',
  'Wood Flour': 'Wood Flour / آرد چوب',
  Other:        'Other / دیگر',
}

// Sidebar nav items — keyed by the labelKey used in Sidebar.jsx's SECTIONS array.
export const NAV_BI = {
  'nav.dashboard':      'Home / خانه',
  'nav.roznamcha':      'Roznamcha / روزنامچه',
  'nav.pos':            'POS / نقطه فروش',
  'nav.inventory':      'Inventory / موجودی',
  'nav.farms':          'Farms / فارم‌ها',
  'nav.clients':        'Clients / مشتریان',
  'nav.customers':      'Walk-in / مشتری عبوری',
  'nav.dispatches':     'Dispatches / ارسالات',
  'nav.suppliers':      'Suppliers / تأمین‌کنندگان',
  'nav.supplyPayments': 'Supply Pay / پرداخت تدارکات',
  'nav.storeCash':      'Store Cash / صندوق نقدی',
  'nav.cashLedger':     'Cash Ledger / دفتر نقدی',
  'nav.sarafs':         'Saraf / صراف',
  'nav.payments':       'Payments / پرداخت‌ها',
  'nav.expenses':       'Expenses / مصارف',
  'nav.market':         'Market / بازار',
  'nav.commission':     'Commission / کمیشن',
  'nav.commissionFee':  'Commission Fee / فیس کمیشن',
  'nav.reports':        'Reports / گزارش‌ها',
  'nav.users':          'Users / کاربران',
  'nav.settings':       'Settings / تنظیمات',
}

// Sidebar section headers — keyed by the title string used in Sidebar.jsx.
export const SIDEBAR_SECTION_BI = {
  Sales:     'Sales / فروشات',
  Suppliers: 'Suppliers / تأمین‌کنندگان',
  Money:     'Money / پول',
  Market:    'Market / بازار',
  System:    'System / سیستم',
}

// Roznamcha quick-entry tile labels (the modal's six type buttons).
export const QUICK_ENTRY_TYPE_BI = {
  dispatch: 'Dispatch / ارسال',
  bill:     'Meel Bill / بل دانه',
  payment:  'Payment IN / پرداخت',
  expense:  'Expense / مصرف',
  cash:     'Cash Ledger / دفتر قرض',
  stock:    'Stock In / موجودی',
}

// Convenience: looks up a key in a map and falls back to the raw key if no bilingual entry exists.
export const bi = (map, key) => (key && map[key]) || key || ''
