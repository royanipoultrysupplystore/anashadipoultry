// WhatsApp message templates — English + Dari (Farsi) stacked, for Anas Hadi.
// (The second-language key is kept as `ps` to avoid renaming the SettingsContext /
// dialog plumbing; for Anas Hadi the slot holds Dari text instead of Pashto.)
//
// Variables: {name}, {amount}, {date}, {balance}, {items_list}, {paid},
//            {count}, {weight}, {price}, {unit}, {farm_name}, {bill}, {advance},
//            {seller_name}
// The {store} placeholder is the business name (filled per-language at build time).

// Mutable store signature — set from SettingsContext once the business name loads.
let storeNameEn = 'Anas Hadi Poultry Services'
let storeNamePs = 'انس هادي مرغداري خدمتونه'

export function setStoreSignature(en, ps) {
  if (en) storeNameEn = en
  if (ps) storeNamePs = ps
}

const SEPARATOR = '\n\n────────────\n\n'

export const WA_TEMPLATES = {
  // 1. Dispatch sent to farm (medicine / feed / choza / coal)
  farm_dispatch: {
    en:
`Dear {name},

We confirm that the following items have been dispatched to your farm today.

Items: {items_list}
Total amount: {amount} AFN
Date: {date}
Outstanding balance: {balance} AFN

Thank you for doing business with us.
{store}`,
    ps:
`محترم {name}،

تأیید می‌کنیم که اقلام ذیل امروز به فارم شما ارسال گردید.

اقلام: {items_list}
مبلغ مجموعی: {amount} افغانی
تاریخ: {date}
باقی‌مانده حساب: {balance} افغانی

از همکاری شما تشکر می‌کنیم.
{store}`,
  },

  // 2. Payment received from farm
  farm_payment_received: {
    en:
`Dear {name},

We confirm that we have received your payment today.

Amount received: {amount} AFN
Date: {date}
Remaining balance: {balance} AFN

Thank you for your prompt payment.
{store}`,
    ps:
`محترم {name}،

تأیید می‌کنیم که پرداخت شما امروز دریافت گردید.

مبلغ دریافت‌شده: {amount} افغانی
تاریخ: {date}
باقی‌مانده حساب: {balance} افغانی

از پرداخت به‌موقع شما تشکر می‌کنیم.
{store}`,
  },

  // 3. Payment made to supplier
  supplier_payment_made: {
    en:
`Dear {name},

We confirm that we have paid the following amount to your account today.

Amount paid: {amount} AFN
Date: {date}
Remaining balance owed to you: {balance} AFN

Thank you for your continued partnership.
{store}`,
    ps:
`محترم {name}،

تأیید می‌کنیم که مبلغ ذیل امروز به حساب شما پرداخت گردید.

مبلغ پرداخت‌شده: {amount} افغانی
تاریخ: {date}
باقی‌مانده قرض ما به شما: {balance} افغانی

از همکاری مداوم شما تشکر می‌کنیم.
{store}`,
  },

  // 4. Goods received from supplier
  supplier_goods_received: {
    en:
`Dear {name},

We confirm that we have received the following goods from you today.

Items: {items_list}
Total amount: {amount} AFN
Date: {date}
Total now owed to you: {balance} AFN

Thank you.
{store}`,
    ps:
`محترم {name}،

تأیید می‌کنیم که اقلام ذیل امروز از شما دریافت گردید.

اقلام: {items_list}
مبلغ مجموعی: {amount} افغانی
تاریخ: {date}
مجموع قرض فعلی به شما: {balance} افغانی

تشکر.
{store}`,
  },

  // 5. POS / walk-in sale - paid in full
  pos_sale_paid: {
    en:
`Dear customer,

Thank you for your purchase today.

Items: {items_list}
Total paid: {amount} AFN
Date: {date}
Status: Paid in full

Thank you for doing business with us.
{store}`,
    ps:
`مشتری گرامی،

از خرید امروز شما تشکر می‌کنیم.

اقلام: {items_list}
مبلغ پرداخت‌شده: {amount} افغانی
تاریخ: {date}
وضعیت: پرداخت کامل

از همکاری شما تشکر می‌کنیم.
{store}`,
  },

  // 6. POS / walk-in sale - partial or unpaid (credit)
  pos_sale_credit: {
    en:
`Dear {name},

Thank you for your purchase today.

Items: {items_list}
Total: {amount} AFN
Amount paid: {paid} AFN
Outstanding balance: {balance} AFN
Date: {date}

Thank you for doing business with us.
{store}`,
    ps:
`محترم {name}،

از خرید امروز شما تشکر می‌کنیم.

اقلام: {items_list}
مبلغ مجموعی: {amount} افغانی
مبلغ پرداخت‌شده: {paid} افغانی
باقی‌مانده حساب: {balance} افغانی
تاریخ: {date}

از همکاری شما تشکر می‌کنیم.
{store}`,
  },

  // 7. Walk-in customer payment received
  walkin_payment_received: {
    en:
`Dear {name},

We confirm that we have received your payment today.

Amount received: {amount} AFN
Date: {date}
Remaining balance: {balance} AFN

Thank you.
{store}`,
    ps:
`محترم {name}،

تأیید می‌کنیم که پرداخت شما امروز دریافت گردید.

مبلغ دریافت‌شده: {amount} افغانی
تاریخ: {date}
باقی‌مانده حساب: {balance} افغانی

تشکر.
{store}`,
  },

  // 8. Commission sale (chickens sold)
  commission_sale: {
    en:
`Dear {name},

Thank you for your purchase today.

Chickens: {count}
Weight: {weight} kg
Price: {price} AFN per {unit}
Total: {amount} AFN
Date: {date}
Outstanding balance: {balance} AFN

Thank you for doing business with us.
{store}`,
    ps:
`محترم {name}،

از خرید امروز شما تشکر می‌کنیم.

تعداد مرغ: {count}
وزن: {weight} کیلوگرام
قیمت: {price} افغانی فی {unit}
مبلغ مجموعی: {amount} افغانی
تاریخ: {date}
باقی‌مانده حساب: {balance} افغانی

از همکاری شما تشکر می‌کنیم.
{store}`,
  },

  // 9. Commission customer payment received
  commission_payment_received: {
    en:
`Dear {name},

We confirm that we have received your payment today.

Amount received: {amount} AFN
Date: {date}
Remaining balance: {balance} AFN

Thank you.
{store}`,
    ps:
`محترم {name}،

تأیید می‌کنیم که پرداخت شما امروز دریافت گردید.

مبلغ دریافت‌شده: {amount} افغانی
تاریخ: {date}
باقی‌مانده حساب: {balance} افغانی

تشکر.
{store}`,
  },

  // 10. Chickens sent to market seller
  market_chickens_sent: {
    en:
`Dear {name},

We confirm that the following chickens have been sent to your market today.

Chickens: {count}
From farm: {farm_name}
Bill number: {bill}
Total amount: {amount} AFN
Date: {date}

Please confirm receipt and update us with the sale details.
{store}`,
    ps:
`محترم {name}،

تأیید می‌کنیم که مرغ‌های ذیل امروز به بازار شما ارسال گردید.

تعداد مرغ: {count}
از فارم: {farm_name}
شماره بل: {bill}
مبلغ مجموعی: {amount} افغانی
تاریخ: {date}

لطفاً دریافت را تأیید نموده و جزئیات فروش را با ما در میان بگذارید.
{store}`,
  },

  // 10b. Farm owner — their chickens sent to a market seller
  farm_chickens_to_market: {
    en:
`Dear {name},

We confirm that {count} chickens from your farm have been sent to a market seller today for sale.

Chickens sent: {count}
Market seller: {seller_name}
Bill number: {bill}
Total amount: {amount} AFN
Date: {date}

We will update you once the sale is completed.
{store}`,
    ps:
`محترم {name}،

تأیید می‌کنیم که امروز {count} مرغ از فارم شما برای فروش به یک فروشنده بازار ارسال گردید.

مرغ‌های ارسال‌شده: {count}
فروشنده بازار: {seller_name}
شماره بل: {bill}
مبلغ مجموعی: {amount} افغانی
تاریخ: {date}

پس از تکمیل فروش شما را در جریان قرار می‌دهیم.
{store}`,
  },

  // 11. Payment received from market seller
  market_payment_received: {
    en:
`Dear {name},

We confirm that we have received your payment today.

Amount received: {amount} AFN
Date: {date}
Outstanding balance: {balance} AFN

Thank you.
{store}`,
    ps:
`محترم {name}،

تأیید می‌کنیم که پرداخت شما امروز دریافت گردید.

مبلغ دریافت‌شده: {amount} افغانی
تاریخ: {date}
باقی‌مانده حساب: {balance} افغانی

تشکر.
{store}`,
  },

  // 12. Outstanding balance reminder
  balance_reminder: {
    en:
`Dear {name},

This is a friendly reminder regarding your outstanding balance with us.

Outstanding balance: {amount} AFN
As of: {date}

Please arrange payment at your earliest convenience.

Thank you,
{store}`,
    ps:
`محترم {name}،

این یک یادآوری دوستانه در مورد باقی‌مانده حساب شما با ما است.

باقی‌مانده حساب: {amount} افغانی
تا تاریخ: {date}

لطفاً پرداخت خود را در اولین فرصت ترتیب دهید.

با تشکر،
{store}`,
  },

  // 13. Initial chicken delivery to a farm
  farm_chickens_delivered: {
    en:
`Dear {name},

We confirm that we have delivered chickens to your farm today.

Chickens delivered: {count}
Price per chicken: {price} AFN
Total amount: {amount} AFN
Advance payment received: {advance} AFN
Outstanding balance: {balance} AFN
Date: {date}

We wish you success with this batch.
{store}`,
    ps:
`محترم {name}،

تأیید می‌کنیم که امروز مرغ‌ها به فارم شما تحویل داده شد.

مرغ‌های تحویل‌شده: {count}
قیمت هر مرغ: {price} افغانی
مبلغ مجموعی: {amount} افغانی
پیش‌پرداخت دریافت‌شده: {advance} افغانی
باقی‌مانده حساب: {balance} افغانی
تاریخ: {date}

موفقیت شما در این دوره را آرزو می‌کنیم.
{store}`,
  },

  // 14. Cash Ledger — money we gave to a person
  cash_given: {
    en:
`Dear {name},

We confirm that we have given you {amount} AFN today.

Date: {date}
Total amount you owe us: {balance} AFN

{store}`,
    ps:
`محترم {name}،

تأیید می‌کنیم که امروز {amount} افغانی به شما داده شد.

تاریخ: {date}
مجموع پولی که از شما طلب داریم: {balance} افغانی

{store}`,
  },

  // 15. Cash Ledger — money we received from a person
  cash_received: {
    en:
`Dear {name},

We confirm that we have received {amount} AFN from you today.

Date: {date}
Remaining balance: {balance} AFN

{store}`,
    ps:
`محترم {name}،

تأیید می‌کنیم که امروز {amount} افغانی از شما دریافت گردید.

تاریخ: {date}
باقی‌مانده حساب: {balance} افغانی

{store}`,
  },

  // 16. Account statement for a date range (clients) — English + Pashto
  client_statement: {
    en:
`Dear {name},

Here is your account statement for {from} → {to}:

{items_list}

Total billed: {billed} AFN
Total paid: {paid} AFN
Current balance: {balance} AFN

Thank you,
{store}`,
    ps:
`محترم {name}،

دا ستاسو د حساب صورت دی له {from} څخه تر {to} پورې:

{items_list}

ټول بل شوی: {billed} افغانۍ
ټول تادیه شوی: {paid} افغانۍ
اوسنی بیلانس: {balance} افغانۍ

مننه،
{store}`,
  },
}

// Replace {placeholders} with values
function fillTemplate(template, vars) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return vars[key] !== undefined && vars[key] !== null && vars[key] !== '' ? String(vars[key]) : match
  })
}

// Build the combined English + Dari message for sending via WhatsApp.
// {store} is filled with the business name in the matching language.
export function buildWhatsAppMessage(templateKey, vars) {
  const tpl = WA_TEMPLATES[templateKey]
  if (!tpl) return ''
  const en = fillTemplate(tpl.en, { ...vars, store: storeNameEn })
  const ps = fillTemplate(tpl.ps, { ...vars, store: storeNamePs || storeNameEn })
  return `${en}${SEPARATOR}${ps}`
}

// Get just one language (for preview / editing).
// For Anas Hadi the `ps` slot is Dari; the call signature is kept for compatibility.
export function getMessage(templateKey, vars, lang = 'en') {
  const tpl = WA_TEMPLATES[templateKey]
  if (!tpl) return ''
  const store = lang === 'ps' ? (storeNamePs || storeNameEn) : storeNameEn
  return fillTemplate(tpl[lang] || tpl.en, { ...vars, store })
}
