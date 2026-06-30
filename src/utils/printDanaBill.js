// Opens a print-ready, trilingual (English / Dari / Pashto) Dana Bill summary in
// a new window and triggers the browser print dialog. "Save as PDF" in that
// dialog makes it downloadable; "Print" prints it. Using the browser's own
// renderer is the reliable way to lay out Pashto/Dari (RTL) without embedding
// fonts into a PDF library.

// Trilingual labels: [English, Dari, Pashto]
const L = {
  title:    ['Dana Bill', 'بل دانه', 'د دانې بل'],
  date:     ['Date', 'تاریخ', 'نېټه'],
  billNo:   ['Bill #', 'شماره بل', 'د بل نمبر'],
  supplier: ['Supplier (Meel)', 'تأمین‌کننده (میل)', 'اکمالوونکی (میل)'],
  client:   ['Client', 'مشتری', 'پیرودونکی'],
  danaType: ['Dana Type', 'نوع دانه', 'د دانې ډول'],
  bags:     ['Bags', 'تعداد بوری', 'د بوریو شمیر'],
  price:    ['Price / bag', 'قیمت فی بوری', 'فی بوري بیه'],
  total:    ['Total Amount', 'مجموع', 'ټوله اندازه'],
}

const DANA = {
  '4_number':  ['4 Number Dana', 'دانه ۴ نمبر', '۴ نمبر دانه'],
  '6_number':  ['6 Number Dana', 'دانه ۶ نمبر', '۶ نمبر دانه'],
  '9_number':  ['9 Number Dana', 'دانه ۹ نمبر', '۹ نمبر دانه'],
  '12_number': ['12 Number Dana', 'دانه ۱۲ نمبر', '۱۲ نمبر دانه'],
  'other':     ['Other', 'دیگر', 'نور'],
}

const afn = (n) => `AFN ${(Number(n) || 0).toLocaleString('en-US')}`
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const tri = (arr) => `<span class="en">${esc(arr[0])}</span><span class="fa">${esc(arr[1])}</span><span class="ps">${esc(arr[2])}</span>`

export function printDanaBill(bill) {
  const dana = DANA[bill.dana_type] || ['—', '—', '—']
  const row = (labelArr, value) =>
    `<tr><td class="lbl">${tri(labelArr)}</td><td class="val">${value}</td></tr>`

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(L.title[0])} ${esc(bill.bill_number || '')}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Vazirmatn', 'Tahoma', system-ui, sans-serif; color:#0f172a; margin:0; padding:24px; }
  .sheet { max-width: 640px; margin: 0 auto; border:1px solid #cbd5e1; border-radius:14px; overflow:hidden; }
  .head { background:#0F5257; color:#fff; padding:18px 22px; }
  .biz { font-size:20px; font-weight:800; }
  .title { margin-top:4px; font-size:13px; opacity:.85; }
  .title span { margin-inline-end:10px; }
  table { width:100%; border-collapse:collapse; }
  td { padding:11px 22px; border-bottom:1px solid #eef2f6; font-size:14px; vertical-align:top; }
  td.lbl { color:#64748b; width:48%; }
  td.val { font-weight:700; text-align:end; }
  .en { display:block; }
  .fa, .ps { display:block; font-size:12px; color:#94a3b8; direction:rtl; }
  td.lbl .en { font-weight:600; color:#475569; }
  .total td { background:#f0fdf4; font-size:17px; }
  .total td.val { color:#0F5257; font-weight:800; }
  .foot { padding:14px 22px; font-size:11px; color:#94a3b8; text-align:center; }
  @media print { body { padding:0; } .sheet { border:none; } @page { margin: 14mm; } }
</style></head>
<body>
  <div class="sheet">
    <div class="head">
      <div class="biz">${esc(bill.business_name || '')}</div>
      <div class="title">${tri(L.title)}</div>
    </div>
    <table>
      ${row(L.date, esc(bill.date))}
      ${row(L.billNo, esc(bill.bill_number || '—'))}
      ${row(L.supplier, esc(bill.supplier_name || '—'))}
      ${row(L.client, esc(bill.client_name || '—'))}
      ${row(L.danaType, tri(dana))}
      ${row(L.bags, esc((Number(bill.quantity) || 0).toLocaleString('en-US')))}
      ${row(L.price, afn(bill.price_per_bag))}
      <tr class="total"><td class="lbl">${tri(L.total)}</td><td class="val">${afn(bill.total_amount)}</td></tr>
    </table>
    <div class="foot">${esc(bill.business_name || '')} · ${esc(bill.date)}</div>
  </div>
  <script>window.onload = function(){ window.focus(); window.print(); };</script>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) return // popup blocked
  w.document.open()
  w.document.write(html)
  w.document.close()
}
