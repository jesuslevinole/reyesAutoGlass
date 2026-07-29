// "Report Work Order" — réplica del reporte Excel del cliente (AppSheet).
// Una fila por orden con cliente, vehículo, financiero, part numbers,
// distribuidores, agente/técnico y Profit and Loss calculado.

import type { Row } from '../services/firestore';
import { fetchAll } from '../services/firestore';
import { getFieldValue, rowLabel } from './relations';

/** Lee un valor probando varias keys (bases snake_case / camelCase). */
function val(row: Row, keys: string[]): unknown {
  return getFieldValue(row, { key: keys[0], altKeys: keys.slice(1) });
}

function num(row: Row, keys: string[]): number {
  const v = val(row, keys);
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : 0;
}

function text(row: Row, keys: string[]): string {
  const v = val(row, keys);
  if (v === null || v === undefined) return '';
  return Array.isArray(v) ? v.join(' , ') : String(v);
}

export async function generateWorkOrderReport(orders: Row[]): Promise<void> {
  // Cachés de FK: una lectura por colección
  const [tags, customers, team, tiers, calibrations, details, jobtypes, partnumbers, companies] =
    await Promise.all([
      fetchAll('catalog_tag'), fetchAll('customers'), fetchAll('team'),
      fetchAll('catalog_price_tier'),
      fetchAll('catalog_calibration_type'), fetchAll('work_order_details'),
      fetchAll('catalog_jobtype'), fetchAll('catalog_part_number'), fetchAll('catalog_company'),
    ]);

  const byId = (rows: Row[]) => new Map(rows.map((r) => [r.id, r]));
  const tagMap = byId(tags); const custMap = byId(customers); const teamMap = byId(team);
  const tierMap = byId(tiers); const calMap = byId(calibrations);
  const jobMap = byId(jobtypes); const partMap = byId(partnumbers); const compMap = byId(companies);

  const label = (map: Map<string, Row>, id: unknown) =>
    typeof id === 'string' && id ? rowLabel(map.get(id)) : '';

  // Detalles agrupados por work order
  const detailsByOrder = new Map<string, Row[]>();
  for (const d of details) {
    const woId = String(val(d, ['idWorkorder', 'work_order_id', 'id_work_order', 'workOrderId']) ?? '');
    if (!woId) continue;
    const list = detailsByOrder.get(woId) ?? [];
    list.push(d);
    detailsByOrder.set(woId, list);
  }

  const HEADERS = [
    'STATUS', 'Work order #', 'Insurance?', 'APPOINTMENT DATE', 'CUSTOMER', 'PHONE', 'ADDRESS', 'EMAIL',
    'YEAR', 'MAKE', 'MODEL', 'BODY', 'VIN#',
    'SUBTOTAL PART', 'SUBTOTAL MOLDING', 'SUBTOTAL SERVICES', 'TAX%', 'TOTAL TAX',
    'LONG TRIP', 'DISCOUNT', 'UPSELL', 'TOTAL',
    'JOB TYPE', 'PART NUMBER', 'DISTRIBUTOR', 'DISTRIBUTOR ORDER',
    'TIER', 'AGENT', 'TECH', 'LABOR', 'CALIBRATION TYPE', 'ID AUTORIZATION', 'PROFIT AND LOSS',
  ];

  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('Report Work Order');
  sheet.addRow(HEADERS);
  const head = sheet.getRow(1);
  head.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10.5 };
  head.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3583F6' } };
  head.height = 20;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  for (const wo of orders) {
    const woDetails = detailsByOrder.get(wo.id) ?? [];
    const customer = custMap.get(String(val(wo, ['idCustomer', 'customer_id', 'id_customer']) ?? ''));

    const subtotalPart = num(wo, ['subtotalPart', 'subtotal_part']);
    const totalTax = num(wo, ['taxDolar', 'total_tax', 'tax_dolar']);
    const labor = num(wo, ['totalLabor', 'labor', 'total_labor']);
    const total = num(wo, ['total']);
    const upsell = num(wo, ['upsell']);
    // Profit and Loss = cobrado (total + upsell) − parte − tax − labor
    // (la comisión del agente vive en agent_commissions; se resta al conciliar)
    const profitLoss = (total + upsell) - subtotalPart - totalTax - labor;

    sheet.addRow([
      label(tagMap, val(wo, ['idStatus', 'tag_id', 'status_id', 'id_status'])),
      text(wo, ['workOrderNumber', 'work_order_number', 'wo_number', 'work_order']),
      text(wo, ['insuranceType', 'insurrance', 'insurance', 'insurance_type']),
      text(wo, ['appointmentDate', 'appointment_date', 'appoiment_date']),
      customer ? rowLabel(customer) : '',
      customer ? text(customer, ['phone', 'phone_number']) : '',
      customer ? text(customer, ['address']) : '',
      customer ? text(customer, ['email']) : '',
      text(wo, ['year', 'vehicle_year']),
      text(wo, ['mark', 'make', 'vehicle_make']),
      text(wo, ['model', 'vehicle_model']),
      text(wo, ['body', 'vehicle_body']),
      text(wo, ['vinNumber', 'vin', 'vin_number']),
      subtotalPart,
      num(wo, ['subtotalMolding', 'subtotal_molding']),
      num(wo, ['subtotalServices', 'subtotal_services']),
      num(wo, ['taxPercent', 'tax_percent', 'tax']),
      totalTax,
      num(wo, ['longTrip', 'long_trip']),
      num(wo, ['discount']),
      upsell,
      total,
      woDetails.map((d) => label(jobMap, val(d, ['idJobtype', 'job_type_id', 'id_job_type']))).filter(Boolean).join(' , '),
      woDetails.map((d) => label(partMap, val(d, ['idPartnumber', 'part_number_id', 'id_part_number']))).filter(Boolean).join(' , '),
      woDetails.map((d) => label(compMap, val(d, ['idDistributor', 'distributor_id', 'id_distributor']))).filter(Boolean).join(' , '),
      woDetails.map((d) => text(d, ['orderNumber', 'distributor_order', 'order_number'])).filter(Boolean).join(' , '),
      label(tierMap, val(wo, ['idTier', 'tier_id', 'price_tier_id', 'id_tier'])),
      label(teamMap, val(wo, ['idAgent', 'agent_id', 'id_agent'])),
      label(teamMap, val(wo, ['idTech', 'tech_id', 'id_tech'])),
      labor,
      label(calMap, val(wo, ['idCalibration', 'calibration_type_id', 'id_calibration'])),
      text(wo, ['idAutorization', 'id_autorization', 'authorization_id']),
      Math.round(profitLoss * 100) / 100,
    ]);
  }

  HEADERS.forEach((h, i) => {
    sheet.getColumn(i + 1).width = Math.max(13, Math.min(30, h.length + 4));
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Report_Work_Order.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}
