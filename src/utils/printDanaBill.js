// Opens a polished, trilingual (English / Dari / Pashto) Dana Bill in a new
// window and triggers the browser print dialog. "Save as PDF" downloads it;
// "Print" prints it. Browser-rendered so Pashto/Dari (RTL) lay out correctly;
// Vazirmatn is pulled from Google Fonts for crisp Arabic-script rendering.

const DANA = {
  '4_number':  '4 Number · ۴ نمبر',
  '6_number':  '6 Number · ۶ نمبر',
  '9_number':  '9 Number · ۹ نمبر',
  '12_number': '12 Number · ۱۲ نمبر',
  'other':     'Other · دیگر',
}

const afn = (n) => `${(Number(n) || 0).toLocaleString('en-US')}`
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export function printDanaBill(bill) {
  const dana = DANA[bill.dana_type] || '—'
  const total = afn(bill.total_amount)

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Dana Bill ${esc(bill.bill_number || '')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Vazirmatn:wght@400;500;700&display=swap" rel="stylesheet">
<style>
  :root { --teal:#0F5257; --accent:#14B8A6; --ink:#0f172a; --muted:#94a3b8; --line:#e8edf1; }
  * { box-sizing:border-box; margin:0; padding:0; }
  html,body { background:#f1f5f9; }
  body { font-family:'Inter','Vazirmatn',system-ui,sans-serif; color:var(--ink); padding:28px; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
  .rtl { font-family:'Vazirmatn','Tahoma',sans-serif; direction:rtl; }
  .sheet { max-width:760px; margin:0 auto; background:#fff; border-radius:16px; overflow:hidden; box-shadow:0 10px 30px rgba(15,82,87,.08); }

  /* Header */
  .top { background:linear-gradient(135deg,var(--teal),#0a3b3f); color:#fff; padding:26px 30px; display:flex; justify-content:space-between; align-items:flex-start; gap:20px; }
  .biz { font-size:23px; font-weight:800; letter-spacing:-.2px; }
  .doc { margin-top:6px; font-size:12px; font-weight:600; letter-spacing:2px; color:#bdf0e8; }
  .doc .rtl { letter-spacing:0; font-weight:500; opacity:.85; }
  .meta { text-align:right; }
  .billbox { background:rgba(255,255,255,.14); border:1px solid rgba(255,255,255,.25); border-radius:10px; padding:8px 14px; display:inline-block; }
  .billbox .k { display:block; font-size:9px; letter-spacing:2px; color:#bdf0e8; }
  .billbox .v { font-size:18px; font-weight:800; }
  .meta .date { margin-top:8px; font-size:12px; color:#d7faf4; }

  /* Parties */
  .parties { display:flex; gap:14px; padding:22px 30px 6px; }
  .party { flex:1; background:#f8fafb; border:1px solid var(--line); border-radius:12px; padding:14px 16px; }
  .plabel { font-size:9.5px; font-weight:700; letter-spacing:1.5px; color:var(--muted); }
  .plabel .rtl { letter-spacing:0; font-weight:500; }
  .pname { margin-top:5px; font-size:17px; font-weight:700; color:var(--teal); }

  /* Items table */
  .items { width:100%; border-collapse:collapse; margin:18px 0 0; }
  .items th { background:var(--teal); color:#fff; font-size:10px; font-weight:700; letter-spacing:.6px; text-align:right; padding:11px 14px; }
  .items th:first-child { text-align:left; padding-left:30px; }
  .items th:last-child { padding-right:30px; }
  .items th .rtl { display:block; font-weight:500; opacity:.8; font-size:10px; }
  .items td { padding:16px 14px; border-bottom:1px solid var(--line); font-size:14px; font-weight:600; text-align:right; vertical-align:top; }
  .items td:first-child { text-align:left; padding-left:30px; }
  .items td:last-child { padding-right:30px; }
  .items .line1 { font-weight:700; }
  .items .dana { margin-top:3px; font-size:12px; font-weight:500; color:var(--muted); }

  /* Total */
  .totalwrap { display:flex; justify-content:flex-end; padding:16px 30px 26px; }
  .totalrow { min-width:280px; display:flex; justify-content:space-between; align-items:center; background:#f0fdfa; border:1px solid #cdeee7; border-radius:12px; padding:14px 18px; }
  .tlabel { font-size:11px; font-weight:700; letter-spacing:1px; color:var(--teal); }
  .tlabel .rtl { display:block; font-weight:500; letter-spacing:0; color:#5b9a91; }
  .tval { font-size:24px; font-weight:800; color:var(--teal); }
  .tval .cur { font-size:13px; font-weight:600; color:#5b9a91; margin-right:4px; }

  .foot { border-top:1px solid var(--line); padding:14px 30px; font-size:10.5px; color:var(--muted); text-align:center; letter-spacing:.3px; }

  @media print {
    html,body { background:#fff; }
    body { padding:0; }
    .sheet { box-shadow:none; border-radius:0; max-width:none; }
    @page { margin:14mm; }
  }
</style></head>
<body>
  <div class="sheet">
    <div class="top">
      <div>
        <div class="biz">${esc(bill.business_name || '')}</div>
        <div class="doc">DANA BILL <span class="rtl">بل دانه · د دانې بل</span></div>
      </div>
      <div class="meta">
        <div class="billbox"><span class="k">BILL #</span><span class="v">${esc(bill.bill_number || '—')}</span></div>
        <div class="date">${esc(bill.date)}</div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <div class="plabel">SUPPLIER (MEEL) <span class="rtl">· تأمین‌کننده · اکمالوونکی</span></div>
        <div class="pname">${esc(bill.supplier_name || '—')}</div>
      </div>
      <div class="party">
        <div class="plabel">CLIENT <span class="rtl">· مشتری · پیرودونکی</span></div>
        <div class="pname">${esc(bill.client_name || '—')}</div>
      </div>
    </div>

    <table class="items">
      <thead><tr>
        <th>DESCRIPTION <span class="rtl">تفصیل</span></th>
        <th>BAGS <span class="rtl">بوری</span></th>
        <th>PRICE / BAG <span class="rtl">فی بوری</span></th>
        <th>AMOUNT <span class="rtl">اندازه</span></th>
      </tr></thead>
      <tbody><tr>
        <td><div class="line1">Feed (Dana)</div><div class="dana">${esc(dana)}</div></td>
        <td>${esc((Number(bill.quantity) || 0).toLocaleString('en-US'))}</td>
        <td>AFN ${afn(bill.price_per_bag)}</td>
        <td>AFN ${total}</td>
      </tr></tbody>
    </table>

    <div class="totalwrap">
      <div class="totalrow">
        <div class="tlabel">TOTAL <span class="rtl">مجموع · ټوله</span></div>
        <div class="tval"><span class="cur">AFN</span>${total}</div>
      </div>
    </div>

    <div class="foot">${esc(bill.business_name || '')} &nbsp;·&nbsp; ${esc(bill.date)}</div>
  </div>
  <script>
    window.onload = function(){
      // Give the web fonts a moment so Dari/Pashto render before the dialog opens.
      var go = function(){ window.focus(); window.print(); };
      if (document.fonts && document.fonts.ready) { document.fonts.ready.then(function(){ setTimeout(go, 120); }); }
      else { setTimeout(go, 400); }
    };
  </script>
</body></html>`

  const w = window.open('', '_blank')
  if (!w) return // popup blocked
  w.document.open()
  w.document.write(html)
  w.document.close()
}
