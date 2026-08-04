// Constructor compartido del mensaje de Quote/Work Order.
// Lo usan el wizard (con su estado en vivo) y la vista de detalle
// (con los valores guardados de la orden).

import { money } from './relations';

export interface OrderMessageCtx {
  isQuote: boolean;
  docNumber: string;
  statusName: string;
  insuranceType: string;
  customerName: string;
  phones: string;
  customerAddress: string;
  appointment: string;
  vehicle: { line: string; vin: string; plate: string };
  details: { label: string; amount: number }[];
  totals: {
    subtotalPart: number; subtotalServices: number; totalLabor: number;
    taxDolar: number; longTrip: number;
    discountMoney: number; discountPercent: number;
    total: number; adjustedTotal: number; paid: number; balance: number;
  };
  notes: string;
  fieldLabel: (key: string) => string;
  fieldValueText: (key: string) => string;
}

/** Emite el mensaje EXACTAMENTE en el orden elegido en el modal. */
export function buildOrderMessage(ordered: string[], ctx: OrderMessageCtx): string {
  const t = ctx.totals;
  const blocks: string[][] = [];
  for (const id of ordered) {
    if (id === 'header') {
      blocks.push([
        `${ctx.isQuote ? 'QUOTE' : 'WORK ORDER'}${ctx.docNumber ? ` ${ctx.docNumber}` : ''}`,
        `Status: ${ctx.statusName || 'Pending'} · Type: ${ctx.insuranceType}`,
      ]);
    } else if (id === 'customer' && ctx.customerName) {
      const lines = [`Customer: ${ctx.customerName}`];
      if (ctx.phones) lines.push(`Phone: ${ctx.phones}`);
      blocks.push(lines);
    } else if (id === 'address' && ctx.customerAddress) {
      blocks.push([`Address: ${ctx.customerAddress}`]);
    } else if (id === 'appointment' && ctx.appointment) {
      blocks.push([`Appointment: ${ctx.appointment}`]);
    } else if (id === 'vehicle') {
      if (ctx.vehicle.line || ctx.vehicle.vin || ctx.vehicle.plate) {
        const lines = [`Vehicle: ${ctx.vehicle.line}`];
        if (ctx.vehicle.vin) lines.push(`VIN: ${ctx.vehicle.vin}`);
        if (ctx.vehicle.plate) lines.push(`Plate: ${ctx.vehicle.plate}`);
        blocks.push(lines);
      }
    } else if (id === 'details' && ctx.details.length > 0) {
      blocks.push(['Parts & Services:', ...ctx.details.map((d) => `• ${d.label} — ${money(d.amount)}`)]);
    } else if (id === 'totals') {
      const lines = [
        `Subtotal parts: ${money(t.subtotalPart)} · Services: ${money(t.subtotalServices)} · Labor: ${money(t.totalLabor)}`,
        `Tax: ${money(t.taxDolar)} · Long trip: ${money(t.longTrip)}`,
      ];
      if (t.discountMoney > 0) lines.push(`Discount: −${money(t.discountMoney)} (${t.discountPercent.toFixed(1)}%)`);
      lines.push(`TOTAL: ${money(t.discountMoney > 0 ? t.adjustedTotal : t.total)}`);
      if (t.paid > 0) lines.push(`Paid: ${money(t.paid)} · Balance: ${money(t.balance)}`);
      blocks.push(lines);
    } else if (id === 'notes' && ctx.notes) {
      blocks.push([`Notes: ${ctx.notes}`]);
    } else if (id.startsWith('field:')) {
      const key = id.slice(6);
      const value = ctx.fieldValueText(key);
      if (value) blocks.push([`${ctx.fieldLabel(key)}: ${value}`]);
    }
  }
  const out: string[] = [];
  blocks.forEach((lines, i) => {
    const isField = lines.length === 1 && !lines[0].startsWith('Parts &');
    const prevWasField = i > 0 && blocks[i - 1].length === 1;
    if (i > 0 && !(isField && prevWasField)) out.push('');
    out.push(...lines);
  });
  return out.join('\n');
}
