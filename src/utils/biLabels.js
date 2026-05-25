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

// Convenience: looks up a key in a map and falls back to the raw key if no bilingual entry exists.
export const bi = (map, key) => (key && map[key]) || key || ''
