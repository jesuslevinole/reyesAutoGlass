// Invoice / Quotation imprimible para el cliente — HTML de impresión sin
// dependencias: se abre en una pestaña con estilos de papel carta y el
// usuario imprime o guarda como PDF desde el navegador.

import type { OrderMessageCtx } from './orderMessage';
import { cachedFetchAll } from '../services/catalogCache';

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

const fmt = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Abre el invoice (WO) o quotation (Quote) del cliente listo para imprimir/guardar PDF. */
export async function openInvoice(ctx: OrderMessageCtx): Promise<void> {
  // Identidad del taller (nombre + logo) desde la configuración compartida
  let shopName = 'Reyes Auto Glass';
  let shopLogo = '';
  try {
    const docs = await cachedFetchAll('config_ui');
    const app = docs.find((d) => d.id === '_app') as Record<string, unknown> | undefined;
    if (app?.name) shopName = String(app.name);
    if (typeof app?.logo === 'string') shopLogo = app.logo;
  } catch { /* identidad por defecto */ }

  const t = ctx.totals;
  const docTitle = ctx.isQuote ? 'QUOTATION' : 'INVOICE';
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const finalTotal = t.discountMoney > 0 ? t.adjustedTotal : t.total;

  const rows = ctx.details.map((d) => `
        <tr>
          <td>${esc(d.label)}</td>
          <td class="num">${fmt(d.amount)}</td>
        </tr>`).join('');

  const totalLines: [string, string, string][] = [
    ['Subtotal parts', fmt(t.subtotalPart), ''],
    ['Services', fmt(t.subtotalServices), ''],
    ['Labor', fmt(t.totalLabor), ''],
    ['Tax', fmt(t.taxDolar), ''],
  ];
  if (t.longTrip > 0) totalLines.push(['Long trip', fmt(t.longTrip), '']);
  if (t.discountMoney > 0) totalLines.push([`Discount (${t.discountPercent.toFixed(1)}%)`, `−${fmt(t.discountMoney)}`, 'discount']);
  totalLines.push(['TOTAL', fmt(finalTotal), 'grand']);
  if (t.paid > 0) {
    totalLines.push(['Paid', fmt(t.paid), '']);
    totalLines.push(['Balance due', fmt(finalTotal - t.paid), 'balance']);
  }

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${docTitle} ${esc(ctx.docNumber)} — ${esc(shopName)}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: #1c2433;
    background: #f2f4f9;
    padding: 28px;
  }
  .sheet {
    max-width: 820px;
    margin: 0 auto;
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 10px 40px rgba(15, 23, 42, .12);
    overflow: hidden;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    padding: 30px 38px;
    background: linear-gradient(135deg, #1d4ed8, #3b82f6);
    color: #fff;
  }
  .brand { display: flex; align-items: center; gap: 14px; }
  .brand img { width: 52px; height: 52px; border-radius: 12px; background: #fff; object-fit: contain; }
  .brand h1 { font-size: 21px; letter-spacing: -.3px; }
  .doc { text-align: right; }
  .doc .kind { font-size: 12px; letter-spacing: 3px; opacity: .85; font-weight: 700; }
  .doc .number { font-size: 24px; font-weight: 800; margin-top: 2px; }
  .doc .date { font-size: 12px; opacity: .85; margin-top: 4px; }
  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 22px;
    padding: 26px 38px 6px;
  }
  .meta h3 {
    font-size: 10.5px;
    letter-spacing: 1.6px;
    text-transform: uppercase;
    color: #8b95ac;
    margin-bottom: 7px;
  }
  .meta p { font-size: 13.5px; line-height: 1.55; }
  .meta .name { font-weight: 700; font-size: 14.5px; }
  table { width: 100%; border-collapse: collapse; margin-top: 20px; }
  thead th {
    text-align: left;
    font-size: 10.5px;
    letter-spacing: 1.4px;
    text-transform: uppercase;
    color: #8b95ac;
    padding: 10px 38px;
    border-bottom: 2px solid #e6eaf3;
  }
  thead th.num, td.num { text-align: right; }
  tbody td { padding: 12px 38px; font-size: 13.5px; border-bottom: 1px solid #eef1f7; }
  tbody tr:nth-child(even) { background: #fafbfe; }
  .totals { padding: 18px 38px 6px; display: flex; justify-content: flex-end; }
  .totals dl { width: 300px; }
  .totals div { display: flex; justify-content: space-between; padding: 5px 0; font-size: 13.5px; }
  .totals dt { color: #5b6579; }
  .totals dd { font-weight: 600; }
  .totals .discount dd { color: #b45309; }
  .totals .grand {
    margin-top: 8px;
    padding: 11px 14px;
    background: #ecf6ef;
    border-radius: 10px;
    font-size: 15.5px;
  }
  .totals .grand dt, .totals .grand dd { color: #15803d; font-weight: 800; }
  .totals .balance dd { color: #b91c1c; font-weight: 800; }
  .notes { padding: 14px 38px 0; }
  .notes h3 { font-size: 10.5px; letter-spacing: 1.6px; text-transform: uppercase; color: #8b95ac; margin-bottom: 6px; }
  .notes p { font-size: 12.5px; color: #465063; line-height: 1.6; white-space: pre-wrap; }
  .foot {
    margin-top: 26px;
    padding: 18px 38px;
    border-top: 1px solid #e6eaf3;
    display: flex;
    justify-content: space-between;
    font-size: 11.5px;
    color: #8b95ac;
  }
  .print-bar { text-align: center; padding: 18px; }
  .print-bar button {
    font: inherit;
    font-weight: 700;
    background: #1d4ed8;
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 12px 28px;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(29, 78, 216, .35);
  }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; border-radius: 0; max-width: none; }
    .print-bar { display: none; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <header class="head">
      <div class="brand">
        ${shopLogo ? `<img src="${shopLogo}" alt="">` : ''}
        <h1>${esc(shopName)}</h1>
      </div>
      <div class="doc">
        <p class="kind">${docTitle}</p>
        <p class="number">${esc(ctx.docNumber || '—')}</p>
        <p class="date">${today}</p>
      </div>
    </header>

    <div class="meta">
      <div>
        <h3>${ctx.isQuote ? 'Prepared for' : 'Bill to'}</h3>
        <p class="name">${esc(ctx.customerName || '—')}</p>
        ${ctx.phones ? `<p>${esc(ctx.phones)}</p>` : ''}
        ${ctx.customerAddress ? `<p>${esc(ctx.customerAddress)}</p>` : ''}
      </div>
      <div>
        <h3>Vehicle</h3>
        <p class="name">${esc(ctx.vehicle.line || '—')}</p>
        ${ctx.vehicle.vin ? `<p>VIN: ${esc(ctx.vehicle.vin)}</p>` : ''}
        ${ctx.vehicle.plate ? `<p>Plate: ${esc(ctx.vehicle.plate)}</p>` : ''}
        ${ctx.appointment ? `<p>Appointment: ${esc(ctx.appointment)}</p>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr><th>Service / Part</th><th class="num">Amount</th></tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="2" style="text-align:center;color:#8b95ac">No services registered</td></tr>'}
      </tbody>
    </table>

    <div class="totals">
      <dl>
        ${totalLines.map(([label, value, cls]) => `
        <div class="${cls}"><dt>${esc(label)}</dt><dd>${value}</dd></div>`).join('')}
      </dl>
    </div>

    ${ctx.notes ? `<div class="notes"><h3>Notes</h3><p>${esc(ctx.notes)}</p></div>` : ''}

    <footer class="foot">
      <span>${esc(shopName)}</span>
      <span>Thank you for your business!</span>
    </footer>
  </div>
  <div class="print-bar">
    <button onclick="window.print()">🖨 Print / Save as PDF</button>
  </div>
</body>
</html>`;

  const win = window.open('', '_blank');
  if (!win) {
    window.alert('Allow pop-ups to open the invoice.');
    return;
  }
  win.document.write(html);
  win.document.close();
}
