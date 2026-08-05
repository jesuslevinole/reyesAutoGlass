// Invoice / Quotation imprimible para el cliente — plantilla clásica de factura
// (encabezado tipográfico, logo circular, BILL TO, tabla rayada, Balance Due)
// en la paleta azul de la app. Sin dependencias: imprime/guarda PDF del navegador.

import type { OrderMessageCtx } from './orderMessage';
import { cachedFetchAll } from '../services/catalogCache';

function esc(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Abre el invoice (WO) o quotation (Quote) con el estilo de plantilla clásica. */
export async function openInvoice(ctx: OrderMessageCtx): Promise<void> {
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
  const numberLabel = ctx.isQuote ? 'QUOTE NO.' : 'INVOICE NO.';
  const today = new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  const finalTotal = t.discountMoney > 0 ? t.adjustedTotal : t.total;
  const balance = finalTotal - t.paid;
  const initials = shopName.split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 3).toUpperCase();

  // Filas reales + relleno rayado hasta 12 líneas (look de la plantilla)
  const MIN_ROWS = 12;
  const detailRows = ctx.details.map((d) => `
        <tr>
          <td>${esc(d.label)}</td>
          <td class="num">1</td>
          <td class="num">${fmt(d.amount)}</td>
          <td class="num">${fmt(d.amount)}</td>
        </tr>`);
  for (let i = detailRows.length; i < MIN_ROWS; i++) {
    detailRows.push('\n        <tr class="blank"><td>&nbsp;</td><td></td><td></td><td class="num">0.00</td></tr>');
  }

  const subtotal = t.subtotalPart + t.subtotalServices + t.totalLabor;
  const totalRows: [string, string, string][] = [
    ['SUBTOTAL', fmt(subtotal), ''],
  ];
  if (t.discountMoney > 0) {
    totalRows.push(['DISCOUNT', `−${fmt(t.discountMoney)} (${t.discountPercent.toFixed(1)}%)`, '']);
    totalRows.push(['SUBTOTAL LESS DISCOUNT', fmt(subtotal - t.discountMoney), '']);
  }
  totalRows.push(['TAX', fmt(t.taxDolar), '']);
  if (t.longTrip > 0) totalRows.push(['LONG TRIP', fmt(t.longTrip), '']);
  totalRows.push([`${docTitle} TOTAL`, fmt(finalTotal), 'strong']);
  if (t.paid > 0) totalRows.push(['PAID', fmt(t.paid), '']);

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>${docTitle} ${esc(ctx.docNumber)} — ${esc(shopName)}</title>
<style>
  :root {
    --blue: #1d4ed8;
    --blue-mid: #3b82f6;
    --ink: #1c2433;
    --line: #d9dfeb;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    color: var(--ink);
    background: #eef1f7;
    padding: 26px;
  }
  .sheet {
    position: relative;
    max-width: 800px;
    margin: 0 auto;
    background: #fff;
    box-shadow: 0 12px 44px rgba(15, 23, 42, .14);
    padding: 44px 54px 40px;
    /* márgenes laterales de color, como la plantilla */
    border-left: 10px solid var(--blue);
    border-right: 10px solid var(--blue);
  }
  /* ===== Encabezado ===== */
  .top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 24px;
  }
  .title h1 {
    font-size: 34px;
    letter-spacing: 5px;
    font-weight: 800;
    color: var(--ink);
  }
  .company { margin-top: 14px; font-size: 12.5px; line-height: 1.75; color: #465063; }
  .company .name { font-weight: 800; font-size: 14px; color: var(--ink); }
  .right { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 16px; }
  .logo {
    width: 86px;
    height: 86px;
    border-radius: 50%;
    background: var(--blue);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 22px;
    letter-spacing: 1px;
    overflow: hidden;
  }
  .logo img { width: 100%; height: 100%; object-fit: cover; }
  .refs { font-size: 11px; }
  .refs .row {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    align-items: baseline;
    margin-top: 6px;
  }
  .refs .label { letter-spacing: 1.2px; color: #8b95ac; font-weight: 700; }
  .refs .value {
    min-width: 120px;
    border-bottom: 1.5px solid var(--line);
    padding: 0 4px 3px;
    font-weight: 700;
    font-size: 12.5px;
    text-align: center;
  }
  /* ===== Bill to / Vehicle ===== */
  .parties {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 34px;
    margin: 30px 0 24px;
  }
  .party h3 {
    font-size: 11px;
    letter-spacing: 2px;
    color: var(--blue);
    font-weight: 800;
    border-bottom: 2px solid var(--blue);
    display: inline-block;
    padding-bottom: 3px;
    margin-bottom: 9px;
  }
  .party p { font-size: 12.5px; line-height: 1.7; color: #465063; }
  .party .name { font-weight: 700; color: var(--ink); }
  /* ===== Tabla ===== */
  table { width: 100%; border-collapse: collapse; }
  thead th {
    background: var(--blue);
    color: #fff;
    font-size: 10.5px;
    letter-spacing: 1.6px;
    font-weight: 800;
    text-align: left;
    padding: 9px 12px;
  }
  thead th.num { text-align: right; }
  td { font-size: 12.5px; padding: 7px 12px; border-bottom: 1px solid var(--line); }
  td.num { text-align: right; font-variant-numeric: tabular-nums; }
  tr.blank td { color: #c3cadb; }
  /* ===== Totales ===== */
  .bottom {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 30px;
    margin-top: 18px;
    align-items: start;
  }
  .remarks h3 {
    font-size: 10.5px;
    letter-spacing: 1.6px;
    color: #8b95ac;
    font-weight: 800;
    margin-bottom: 6px;
  }
  .remarks p { font-size: 11.5px; color: #465063; line-height: 1.65; white-space: pre-wrap; }
  .totals { font-size: 12px; }
  .totals .row {
    display: flex;
    justify-content: space-between;
    padding: 6px 10px;
    border-bottom: 1px solid var(--line);
  }
  .totals .row .label { letter-spacing: .8px; color: #5b6579; font-weight: 700; }
  .totals .row .value { font-weight: 700; font-variant-numeric: tabular-nums; }
  .totals .row.strong { background: #eef4ff; }
  .totals .row.strong .label, .totals .row.strong .value { color: var(--blue); font-weight: 800; }
  .balance {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
    padding: 12px 14px;
    background: var(--blue);
    color: #fff;
  }
  .balance .label { font-size: 12px; letter-spacing: 2px; font-weight: 800; }
  .balance .value { font-size: 19px; font-weight: 800; font-variant-numeric: tabular-nums; }
  .thanks {
    margin-top: 34px;
    text-align: center;
    font-size: 11.5px;
    color: #8b95ac;
    letter-spacing: 1px;
  }
  .print-bar { text-align: center; padding: 18px; }
  .print-bar button {
    font: inherit;
    font-weight: 700;
    background: var(--blue);
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 12px 28px;
    cursor: pointer;
    box-shadow: 0 6px 18px rgba(29, 78, 216, .35);
  }
  @media print {
    body { background: #fff; padding: 0; }
    .sheet { box-shadow: none; max-width: none; }
    .print-bar { display: none; }
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="top">
      <div>
        <div class="title"><h1>${docTitle}</h1></div>
        <div class="company">
          <p class="name">${esc(shopName)}</p>
          ${ctx.docNumber ? `<p>${ctx.isQuote ? 'Quotation' : 'Invoice'} ${esc(ctx.docNumber)}</p>` : ''}
        </div>
      </div>
      <div class="right">
        <div class="logo">${shopLogo ? `<img src="${shopLogo}" alt="">` : esc(initials)}</div>
        <div class="refs">
          <div class="row"><span class="label">DATE</span><span class="value">${today}</span></div>
          <div class="row"><span class="label">${numberLabel}</span><span class="value">${esc(ctx.docNumber || '—')}</span></div>
        </div>
      </div>
    </div>

    <div class="parties">
      <div class="party">
        <h3>BILL TO</h3>
        <p class="name">${esc(ctx.customerName || '—')}</p>
        ${ctx.phones ? `<p>${esc(ctx.phones)}</p>` : ''}
        ${ctx.customerAddress ? `<p>${esc(ctx.customerAddress)}</p>` : ''}
      </div>
      <div class="party">
        <h3>VEHICLE</h3>
        <p class="name">${esc(ctx.vehicle.line || '—')}</p>
        ${ctx.vehicle.vin ? `<p>VIN: ${esc(ctx.vehicle.vin)}</p>` : ''}
        ${ctx.vehicle.plate ? `<p>Plate: ${esc(ctx.vehicle.plate)}</p>` : ''}
        ${ctx.appointment ? `<p>Appointment: ${esc(ctx.appointment)}</p>` : ''}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>DESCRIPTION</th>
          <th class="num" style="width:60px">QTY</th>
          <th class="num" style="width:110px">UNIT PRICE</th>
          <th class="num" style="width:110px">TOTAL</th>
        </tr>
      </thead>
      <tbody>${detailRows.join('')}
      </tbody>
    </table>

    <div class="bottom">
      <div class="remarks">
        <h3>REMARKS / NOTES</h3>
        <p>${esc(ctx.notes || 'Thank you for choosing us for your auto glass service.')}</p>
      </div>
      <div class="totals">
        ${totalRows.map(([label, value, cls]) => `
        <div class="row ${cls}"><span class="label">${esc(label)}</span><span class="value">${value}</span></div>`).join('')}
        <div class="balance">
          <span class="label">BALANCE DUE</span>
          <span class="value">$${fmt(balance)}</span>
        </div>
      </div>
    </div>

    <p class="thanks">THANK YOU FOR YOUR BUSINESS</p>
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
