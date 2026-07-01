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

// Saraf screens — Anas Hadi & Hadi want English + Pashto shown together
// (money-critical, so both languages always visible, like the sidebar labels).
export const SARAF_BI = {
  backToSarafs:        'Back to Sarafs / بیرته صرافانو ته',
  inFromClients:       'In from clients / د پیرودونکو څخه ترلاسه',
  outToMeels:          'Out to meels / میلونو ته ورکړه',
  currentlyHolding:    'Currently holding / د صراف سره موجوده',
  overPaid:            'Over-paid / اضافه ورکړه',
  settled:             'Settled / تصفیه شوی',
  holding:             'Holding / موجوده',
  payments:            'payments / تادیات',
  clientNetTitle:      'Client & farm balance with Saraf / د پیرودونکي بیلانس د صراف سره',
  clientNetSub:        'In from them − Out on their behalf / ترلاسه − د دوی په استازیتوب ورکړه',
  suppliersPaidTitle:  'Suppliers paid by Saraf / د صراف لخوا تادیه شوي عرضه‌کوونکي',
  suppliersPaidSub:    'Total released to each / هر یوه ته د ورکړو مجموعه',
  noClientActivity:    'No client activity yet / تر اوسه د پیرودونکي فعالیت نشته',
  noSupplierPayouts:   'No supplier payouts yet / تر اوسه عرضه‌کوونکي ته تادیه نشته',
  sarafHolds:          'Saraf holds / د صراف سره',
  owesSaraf:           'Owes Saraf / صراف ته پوروړی',
  client:              'Client / پیرودونکی',
  farm:                'Farm / فارم',
  inShort:             'in / دننه',
  outShort:            'out / بهر',
  noIncoming:          'No money received yet / تر اوسه پیسې نه دي ترلاسه شوي',
  noOutgoing:          'No money paid out yet / تر اوسه پیسې نه دي ورکړل شوي',
  recordIn:            'Record IN / د ترلاسې ثبت',
  recordOut:           'Record OUT / د ورکړې ثبت',
  onBehalfOf:          'on behalf of / په استازیتوب د',
  bill:                'Bill / بل',
  recordInTitle:       'Record money IN from a client / د پیرودونکي څخه د پیسو ترلاسې ثبت',
  recordOutTitle:      'Record money OUT to a meel / میل ته د پیسو ورکړې ثبت',
  fromClient:          'From client & farm / د پیرودونکي / فارم څخه',
  pickFarmClient:      '— pick farm or client / فارم یا پیرودونکی وټاکئ —',
  forBill:             'For bill / د بل لپاره',
  pickBill:            '— pick a bill / یو بل وټاکئ —',
  noBillsForClient:    'No bills written for this client yet / د دې پیرودونکي لپاره تر اوسه بل نشته',
  amountAfn:           'Amount (AFN) / اندازه (افغانۍ)',
  toMeel:              'To meel supplier / میل عرضه‌کوونکي ته',
  pickSupplier:        '— pick a supplier / یو عرضه‌کوونکی وټاکئ —',
  inclOpening:         'incl. opening / د پیل موجوده په ګډون',
  deleteTxTitle:       'Delete transaction? / تراکنش حذف شي؟',
  deleteInMsg:         'The payment will be removed and the client & farm debt restored. / تادیه به حذف او د پیرودونکي پور به بیرته اضافه شي.',
  deleteOutMsg:        'The payment to the supplier will be removed. / عرضه‌کوونکي ته تادیه به حذف شي.',
  searchPlaceholder:   'Search sarafs... / د صراف لټون...',
  addSaraf:            'Add Saraf / صراف زیاتول',
  editSaraf:           'Edit Saraf / صراف سمول',
  deleteSaraf:         'Delete Saraf / صراف حذف',
  deleteSarafMsg:      'Existing payments stay but lose their Saraf link. / موجود تادیات پاتې کیږي خو د صراف اړیکه یې پرې کیږي.',
  introTerm:           'Saraf / صراف',
  intro:               'a money exchanger between client and meel. Clients send money IN, the Saraf releases it OUT to suppliers. / د پیرودونکي او میل ترمنځ صراف؛ پیرودونکي پیسې دننه لیږي او صراف یې عرضه‌کوونکو ته بهر ورکوي.',
  noSarafsSearch:      'No saraf matching your search / ستاسو د لټون سره سم صراف ونه موندل شو',
  noSarafs:            'No sarafs yet — add one to start / تر اوسه صراف نشته — یو زیات کړئ',
  openingBalances:     'Opening balances / د پیل موجوده',
  openingBalancesHint: 'optional — for years of prior business / اختیاري — د تېرو کلونو لپاره',
  openingHolding:      'Opening holding / د پیل موجوده',
  openingHoldingHint:  'Money the Saraf already holds for you. / هغه پیسې چې صراف دمخه ستاسو لپاره ساتلي.',
  overPaidAdvanced:    'Over-paid & advanced / اضافه ورکړه',
  overPaidAdvancedHint:'Money the Saraf paid out beyond what clients paid. / هغه پیسې چې صراف د پیرودونکو له تادیې زیاتې ورکړې.',
}

// Convenience: looks up a key in a map and falls back to the raw key if no bilingual entry exists.
export const bi = (map, key) => (key && map[key]) || key || ''
