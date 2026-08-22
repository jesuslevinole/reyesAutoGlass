// ============================================================================
// MIGRACIÓN DE LA BASE DE DATOS COMPLETA (export SQL del sistema viejo)
// ----------------------------------------------------------------------------
// Recibe los CSV exportados del sistema anterior (BD_*.csv / CAT_*.csv), los
// detecta automáticamente, mapea cada tabla a su colección de GlassWorks y los
// escribe en Firestore CONSERVANDO LOS IDs ORIGINALES como ID de documento.
// Al preservar los IDs, todas las relaciones (idCustomer, idStatus, idAgent...)
// quedan funcionando sin ningún paso extra.
//
// Reglas de transformación aplicadas:
//  - 'NULL' y '0000-00-00' → vacío.
//  - Fechas serial de Excel (ej. 46036) → 'YYYY-MM-DD'.
//  - Porcentajes fraccionales (0.0875) → 8.75 (formato que muestra la app).
//  - Booleanos '0'/'1'/'True'/'False' → boolean.
//  - Listas AppSheet "id1 , id2" → array (campos fkList).
//  - BD_TEAM se reparte en agents / techs / distributors según TYPE_TEAM.
//  - El vehículo de cada Work Order se resuelve cruzando CAT_VEHICLE EN MEMORIA
//    (year/mark/model/body) — sin necesidad de subir los 301,780 vehículos.
//  - Las aseguradoras se crean desde los INSURRANCE_CARRIER únicos de las órdenes.
//  - PCI-DSS: de BD_PAYMENT_CLIENTE solo se guardan los últimos 4 dígitos de la
//    tarjeta; el número completo y la fecha de expiración NUNCA se suben.
// ============================================================================

import { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Database, FileSpreadsheet, FileUp, Loader2, Play, RotateCcw, Trash2,
} from 'lucide-react';
import { collection, doc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { parseCsv } from '../utils/csv';
import './DatabaseImportView.css';

// ─────────────────────────── Helpers de limpieza ───────────────────────────

const clean = (v: unknown): string => {
  const s = (v ?? '').toString().trim();
  if (!s || s === 'NULL' || s === 'null' || s === '0000-00-00') return '';
  return s;
};

const num = (v: unknown): number => {
  const s = clean(v).replace(/[$,%\s]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

/** Porcentaje: el sistema viejo guarda fracciones (0.0875) → la app muestra 8.75. */
const pct = (v: unknown): number => {
  const n = num(v);
  return n > 0 && n <= 1.5 ? Math.round(n * 10000) / 100 : n;
};

const boolish = (v: unknown): boolean => /^(true|1|s[ií]|yes|y)$/i.test(clean(v));

/** Fecha: acepta ISO ('2026-04-03...') o serial de Excel ('46036'). */
const dateVal = (v: unknown): string => {
  const s = clean(v);
  if (!s) return '';
  if (/^\d{4,5}$/.test(s)) {
    const serial = parseInt(s, 10);
    if (serial > 20000 && serial < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
      return d.toISOString().slice(0, 10);
    }
  }
  return s.slice(0, 10);
};

const timeVal = (v: unknown): string => {
  const s = clean(v);
  return s ? s.slice(0, 5) : ''; // '14:30:00' → '14:30'
};

/** Listas AppSheet: "id1 , id2 , id3" → ['id1','id2','id3'] */
const listVal = (v: unknown): string[] =>
  clean(v) ? clean(v).split(/\s*,\s*/).filter(Boolean) : [];

const last4 = (v: unknown): string => {
  const digits = clean(v).replace(/\D/g, '');
  return digits.slice(-4);
};

const up = (v: unknown): string => clean(v).toUpperCase();

const slug = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const ts = (v: unknown): string => clean(v);

// ─────────────────────────── Tipos del migrador ────────────────────────────

type CsvRow = Record<string, string>;
interface WriteOp { collection: string; id: string; data: Record<string, unknown> }

interface Ctx {
  /** ID_VEHICLE → { year, mark, model, body } (cruce en memoria) */
  vehicleXref: Map<string, { year: number; mark: string; model: string; body: string }>;
  /** nombre de aseguradora → id de doc en `insurances` */
  carrierIds: Map<string, string>;
  importVehicles: boolean;
}

interface TableSpec {
  table: string;                       // nombre de la tabla origen (y del archivo)
  order: number;                       // orden de importación
  signature: string[];                 // columnas que identifican la tabla
  targets: string;                     // descripción de colecciones destino
  build: (rows: CsvRow[], ctx: Ctx) => WriteOp[];
}

// ─────────────────────────── Especificaciones ──────────────────────────────

const SPECS: TableSpec[] = [
  // ============ CATÁLOGOS (primero) ============
  {
    table: 'CAT_VEHICLE', order: 1, signature: ['ID_VEHICLE', 'YEAR_VEHICLE'],
    targets: 'cruce en memoria (opcional: cat_vehicle)',
    build: (rows, ctx) => {
      rows.forEach((r) => {
        const id = clean(r.ID_VEHICLE);
        if (id) ctx.vehicleXref.set(id, {
          year: num(r.YEAR_VEHICLE), mark: clean(r.MAKE_VEHICLE),
          model: clean(r.MODEL_VEHICLE), body: clean(r.BODY_VEHICLE),
        });
      });
      if (!ctx.importVehicles) return [];
      return rows.map((r) => ({
        collection: 'cat_vehicle', id: clean(r.ID_VEHICLE),
        data: { year: num(r.YEAR_VEHICLE), make: clean(r.MAKE_VEHICLE), model: clean(r.MODEL_VEHICLE), body: clean(r.BODY_VEHICLE) },
      })).filter((o) => o.id);
    },
  },
  {
    table: 'CAT_TAG', order: 2, signature: ['ID_TAG', 'NAME_TAG'], targets: 'cat_status',
    build: (rows) => rows.map((r) => ({
      collection: 'cat_status', id: clean(r.ID_TAG),
      data: { name: clean(r.NAME_TAG), type: up(r.TYPE_TAG), color: clean(r.COLOR_TAG) },
    })).filter((o) => o.id),
  },
  {
    table: 'CAT_ZIPCODE', order: 2, signature: ['ID_ZIPCODE', 'ZIPCODE_ZIPCODE'], targets: 'cat_zipcode',
    build: (rows) => rows.map((r) => ({
      collection: 'cat_zipcode', id: clean(r.ID_ZIPCODE),
      data: {
        country: clean(r.COUNTRY_ZIPCODE), city: clean(r.CITY_ZIPCODE), state: clean(r.STATE_ZIPCODE),
        zipcode: clean(r.ZIPCODE_ZIPCODE), tax: pct(r.TAX_ZIPCODE), longTrip: num(r.LOG_TRIP_ZIPCODE),
      },
    })).filter((o) => o.id),
  },
  {
    table: 'CAT_COMPANY', order: 2, signature: ['ID_COMPANY', 'NAME_COMPANY'], targets: 'cat_company',
    build: (rows) => rows.map((r) => ({
      collection: 'cat_company', id: clean(r.ID_COMPANY),
      data: { name: clean(r.NAME_COMPANY), type: up(r.TYPE) },
    })).filter((o) => o.id),
  },
  {
    table: 'CAT_JOBTYPE', order: 2, signature: ['ID_JOBTYPE', 'NAME_JOBTYPE'], targets: 'cat_jobtype',
    build: (rows) => rows.map((r) => ({
      collection: 'cat_jobtype', id: clean(r.ID_JOBTYPE),
      data: { name: clean(r.NAME_JOBTYPE), type: up(r.TYPE) },
    })).filter((o) => o.id),
  },
  {
    table: 'CAT_CALIBRATION_TYPE', order: 2, signature: ['ID_CALIBRATION_TYPE'], targets: 'cat_calibrationtype',
    build: (rows) => rows.map((r) => ({
      collection: 'cat_calibrationtype', id: clean(r.ID_CALIBRATION_TYPE),
      data: { name: clean(r.NAME_CALIBRATION_TYPE), amount: num(r.PRCE_CALIBRATION_TYPE) },
    })).filter((o) => o.id),
  },
  {
    table: 'CAT_PRICETIER', order: 2, signature: ['ID_PRICETIER', 'NAME_PRICETIER'], targets: 'cat_pricetier',
    build: (rows) => rows.map((r) => ({
      collection: 'cat_pricetier', id: clean(r.ID_PRICETIER),
      data: { name: clean(r.NAME_PRICETIER), amount: num(r.PRCE_PRICETIER) },
    })).filter((o) => o.id),
  },
  {
    table: 'CAT_PARTNUMBER', order: 2, signature: ['ID_PARTNUMBER', 'NAME_PART_NUMBER'], targets: 'cat_partnumber',
    build: (rows) => rows.map((r) => ({
      collection: 'cat_partnumber', id: clean(r.ID_PARTNUMBER),
      data: { name: clean(r.NAME_PART_NUMBER), nagsDescription: clean(r.NAGS_DESCRIPTION_PART_NUMBER), note: clean(r.NOTE_PART_NUMBER) },
    })).filter((o) => o.id),
  },
  {
    table: 'CAT_PAYMENTMETHOD', order: 2, signature: ['ID_PAYMENTMETHOD', 'NAME'], targets: 'cat_paymentmethod',
    build: (rows) => rows.map((r) => {
      let type = up(r.TYPE);
      if (type === 'EXPENSE') type = 'EXPENSES'; // enum de la app
      return {
        collection: 'cat_paymentmethod', id: clean(r.ID_PAYMENTMETHOD),
        data: { name: clean(r.NAME), type },
      };
    }).filter((o) => o.id),
  },
  {
    table: 'CAT_MOLDING', order: 2, signature: ['ID_MOLDING'], targets: 'cat_molding',
    build: (rows) => rows.map((r) => ({
      collection: 'cat_molding', id: clean(r.ID_MOLDING), data: { name: clean(r.NAME_MOLDING) },
    })).filter((o) => o.id),
  },
  {
    table: 'CAT_EXPENSES', order: 2, signature: ['ID_CATEXPENSES'], targets: 'cat_expenses',
    build: (rows) => rows.map((r) => ({
      collection: 'cat_expenses', id: clean(r.ID_CATEXPENSES), data: { name: clean(r.NAME) },
    })).filter((o) => o.id),
  },

  // ============ CONTACTOS ============
  {
    table: 'BD_CUSTOMER', order: 3, signature: ['ID_CUSTOMER', 'FIRST_NAME'], targets: 'customers',
    build: (rows) => rows.map((r) => ({
      collection: 'customers', id: clean(r.ID_CUSTOMER),
      data: {
        firstName: clean(r.FIRST_NAME), lastName: clean(r.LAST_NAME),
        phone: clean(r.PHONE), alternativePhone: clean(r.ALTERNATIVE_PHONE),
        email: clean(r.EMAIL), address: clean(r.ADDRESS_CUSTOMER),
        createdAt: ts(r.Timestamp_userCreate),
      },
    })).filter((o) => o.id),
  },
  {
    table: 'BD_TEAM', order: 3, signature: ['ID_TEAM', 'TYPE_TEAM'],
    targets: 'agents / techs / distributors (según TYPE_TEAM)',
    build: (rows) => rows.map((r) => {
      const id = clean(r.ID_TEAM);
      if (!id) return null;
      const type = up(r.TYPE_TEAM);
      const contacto = {
        phone: clean(r.PHONE), alternativePhone: clean(r.ALTERNATIVE_PHONE),
        email: clean(r.EMAIL), address: clean(r.ADDRESS_TEAM),
      };
      const comisiones = {
        comissionJob: num(r.Comission_job),
        aftermarketComission: num(r.AFTERMARKET_COMISSION), recommendComission: num(r.RECOMMEND_COMISSION),
        oemComission: num(r.OEM_COMISSION), insuranceComission: num(r.INSURANCE_COMISSION),
        servicesComission: num(r.SERVICES_COMISSION), laborTech: num(r.LABOR_TECH),
      };
      if (type === 'DISTRIBUTOR') {
        return {
          collection: 'distributors', id,
          data: { name: `${clean(r.FIRST_NAME)} ${clean(r.LAST_NAME)}`.trim(), ...contacto, idCompany: clean(r.ID_COMPANY) },
        };
      }
      if (type === 'TECH') {
        return {
          collection: 'techs', id,
          data: { firstName: clean(r.FIRST_NAME), lastName: clean(r.LAST_NAME), ...contacto, idCompany: clean(r.ID_COMPANY), ...comisiones },
        };
      }
      return {
        collection: 'agents', id,
        data: { idCompany: clean(r.ID_COMPANY), firstName: clean(r.FIRST_NAME), lastName: clean(r.LAST_NAME), ...contacto, ...comisiones },
      };
    }).filter((o): o is WriteOp => !!o),
  },

  // ============ OPERACIÓN ============
  {
    table: 'BD_WORKORDER', order: 4, signature: ['ID_WORKORDER', 'SUBTOTAL_PART'],
    targets: 'workorders (+ insurances derivadas)',
    build: (rows, ctx) => {
      const ops: WriteOp[] = [];
      rows.forEach((r) => {
        const id = clean(r.ID_WORKORDER);
        if (!id) return;

        // Aseguradora: se crea una sola vez por nombre único.
        const carrier = clean(r.INSURRANCE_CARRIER);
        let idInsurance = '';
        if (carrier) {
          if (!ctx.carrierIds.has(carrier)) {
            const insId = `ins-${slug(carrier)}`;
            ctx.carrierIds.set(carrier, insId);
            ops.push({ collection: 'insurances', id: insId, data: { name: carrier, phone: '', email: '', address: '' } });
          }
          idInsurance = ctx.carrierIds.get(carrier)!;
        }

        // Vehículo: cruce por ID_VEHICLE; respaldo: parsear el label "2016 Chevrolet Suburban ...".
        const veh = ctx.vehicleXref.get(clean(r.ID_VEHICLE));
        let year = veh?.year ?? 0, mark = veh?.mark ?? '', model = veh?.model ?? '', body = veh?.body ?? '';
        if (!veh) {
          const label = clean(r.VEHICLE_LABEL);
          const m = label.match(/^(\d{4})\s+(\S+)\s+(.*)$/);
          if (m) { year = num(m[1]); mark = m[2]; model = m[3]; }
        }

        ops.push({
          collection: 'workorders', id,
          data: {
            workOrderNumber: clean(r.WORKORDER_LABEL).split(' - ')[0], // "Wo-3371"
            insuranceType: clean(r.Insurance) === '1' ? 'INSURANCE' : 'PERSONAL',
            dateRegister: dateVal(r.DATE_WORKORDER),
            idStatus: clean(r.ID_TAG),
            idCompany: clean(r.ID_COMPANY),
            idAgent: clean(r.ID_AGENT),
            idZipcode: clean(r.ID_ZIPCODE),
            longTrip: num(r.LONG_TRIP),
            year, mark, model, body,
            vinNumber: clean(r.VIN_NUMBER).toUpperCase(),
            plate: clean(r.PLATE).toUpperCase(),
            idCustomer: clean(r.ID_CUSTOMER),
            appointmentDate: dateVal(r.APPOIMENT_DATE),
            timeIn: timeVal(r.TIME_FRAME_START),
            timeOut: timeVal(r.TIME_FRAME_END),
            idInsurance,
            insuranceCarrier: carrier,
            subtotalPart: num(r.SUBTOTAL_PART),
            subtotalMolding: num(r.SUBTOTAL_MOLDING),
            subtotalServices: num(r.SUBTOTAL_SERVICES),
            totalLabor: num(r.TOTAL_LABOR),
            deductible: num(r.DEDUCTIBLE_WORKORDER),
            kitFlatRate: num(r.KIT_FLAT_RATE),
            taxPercent: pct(r.TAX_PERCENT),
            taxDolar: num(r.TAX_DOLAR),
            cashComeback: num(r.CASH_COMEBACK),
            total: num(r.TOTAL),
            upsold: num(r.UPSOLD),
            upsell: num(r.UPSELL),
            laborUpsell: num(r.LABOR_UPSELL),
            discount: num(r.DISCOUNT),
            paid: num(r.PAID),
            balance: num(r.BALANCE),
            createdAt: ts(r.Timestamp_userCreate),
          },
        });
      });
      return ops;
    },
  },
  {
    table: 'BD_WORKORDER_DETAIL', order: 5, signature: ['ID_WORKORDER', 'TYPE PART'], targets: 'servicesdetail',
    build: (rows) => rows.map((r) => {
      const id = clean(r.ID);
      if (!id) return null;
      return {
        collection: 'servicesdetail', id,
        data: {
          idWorkorder: clean(r.ID_WORKORDER),
          insurance: boolish(r.INSURANCE),
          type: up(r['TYPE PART']),
          idJobtype: clean(r.ID_JOBTYPE),
          idPartnumber: clean(r.ID_PARTNUMBER),
          nagsDescription: clean(r['NAGS DESCRIPTION']),
          glassCost: num(r['Glass Cost']),
          idDistributor: clean(r.ID_DISTRIBUTOR),
          orderNumber: clean(r['Order Number']),
          pricetier: boolish(r.PRICE_TIER),
          idPricetier: clean(r.ID_PRICETIER),
          amountPricetier: num(r.AMOUNT),
          calibrationType: boolish(r.CALIBRATION_TYPE),
          idCalibrationType: clean(r.ID_CALIBRATION_TYPE),
          amountCalibrationtype: num(r.AMOUNT_CALIBRATION_TYPE),
          totalLabor: num(r.TOTAL_LABOR),
          servicesDescription: clean(r.SERVICES_DESCRIPTION),
          servicesAmount: num(r.SERVICES_AMOUNT),
          noteServices: clean(r.NOTE_SERVICES),
          listPrice: num(r['List Price']),
          nagsDiscountRate: pct(r['Nags Discount Rate']),
          pricePartInsurance: num(r['Amount List Price']),
          nagsLaborHour: num(r['Nags Labour Hour']),
          priceForHour: num(r['Price for hour']),
          totalLaborHour: num(r['Total Labor Hour']),
          status: clean(r.Status),
          idPaymentdistributor: clean(r.ID_PAYMENTDISTRIBUTOR),
          idDebitnote: clean(r.ID_DEBITNOTE),
          idCreditnote: clean(r.ID_CREDITNOTE),
        },
      };
    }).filter((o): o is WriteOp => !!o),
  },

  // ============ FINANZAS ============
  {
    table: 'BD_PAYMENT_CLIENTE', order: 6, signature: ['ID_PAYMENT', 'CARD_NUMBER'], targets: 'payments (solo últimos 4 de tarjeta)',
    build: (rows) => rows.map((r) => {
      const id = clean(r.ID_PAYMENT);
      if (!id) return null;
      return {
        collection: 'payments', id,
        data: {
          idWorkorder: clean(r.ID_WORKORDER),
          idPaymentmethod: clean(r.ID_PAYMENTMETHOD),
          // PCI-DSS: número completo y expiración NO se suben.
          cardLast4: last4(r.CARD_NUMBER),
          cardBrand: '',
          firstName: clean(r.First_name),
          lastName: clean(r.Last_name),
          idAutorization: clean(r.ID_AUTORIZATION),
          amount: num(r.AMOUNT),
          createdAt: ts(r.Timestamp_userCreate),
        },
      };
    }).filter((o): o is WriteOp => !!o),
  },
  {
    table: 'BD_PAYMENTDISTRIBUTOR', order: 6, signature: ['ID_DISTRIBUTOR', 'WORK ORDER TO PAY'], targets: 'paymentdistributor',
    build: (rows) => rows.map((r) => {
      const id = clean(r.ID);
      if (!id) return null;
      return {
        collection: 'paymentdistributor', id,
        data: {
          consecutive: clean(r['CONSECUTIVE DISTRIBUTOR']),
          datePayment: dateVal(r.DATE),
          idDistributor: listVal(r.ID_DISTRIBUTOR),
          idWorkorder: listVal(r['WORK ORDER TO PAY']),
          subtotal: num(r.SUBTOTAL),
          debit: num(r.BONUS),
          credit: num(r.DISCOUNT),
          bonus: num(r.BONUS),
          discount: num(r.DISCOUNT),
          total: num(r.TOTAL),
          idPaymentmethod: clean(r.ID_PAYMENT_METHOD),
        },
      };
    }).filter((o): o is WriteOp => !!o),
  },
  {
    table: 'BD_PAYMENTTECH', order: 6, signature: ['ID_TECHWO', 'Consecutive Payment Tech'], targets: 'techpayments',
    build: (rows) => rows.map((r) => {
      const id = clean(r.ID);
      if (!id) return null;
      return {
        collection: 'techpayments', id,
        data: {
          consecutive: clean(r['Consecutive Payment Tech']),
          datePayment: dateVal(r.DATE),
          idTech: clean(r.ID_TECHWO),
          idWorkorder: listVal(r['WORK ORDER']),
          labor: num(r.SUBTOTAL),
          cash: num(r.CASH),
          bonus: num(r.BONUS),
          discount: num(r.DISCOUNT),
          parts: clean(r.PARTS),
          partsSuma: num(r['PARTS SUMA']),
          totalLabor: num(r.TOTAL),
          idPaymentmethod: clean(r.ID_PAYMENTMETHOD),
        },
      };
    }).filter((o): o is WriteOp => !!o),
  },
  {
    table: 'BD_AGENTCOMISSIONWO', order: 6, signature: ['ID_AGENT', 'AFTERMARKET'], targets: 'agentcomissions',
    build: (rows) => rows.map((r) => {
      const id = clean(r.ID);
      if (!id) return null;
      return {
        collection: 'agentcomissions', id,
        data: {
          idAgent: clean(r.ID_AGENT),
          comission: num(r['TOTAL `PAY'] ?? r.TOTAL_PAY ?? r['TOTAL PAY']),
          idWorkorder: clean(r['ID_ WORKORDER'] ?? r.ID_WORKORDER),
          dateWorkorder: dateVal(r['DATE WORK ORDER']),
          idCompany: clean(r.ID_COMPANY),
          aftermarket: num(r.AFTERMARKET),
          recommended: num(r.RECOMMENDED),
          oem: num(r.OEM),
          services: num(r.SERVICES),
          insurance: num(r.INSURANCE),
          status: clean(r.STATUS),
          idPaymentagent: clean(r.ID_PAYMENTAGENT),
        },
      };
    }).filter((o): o is WriteOp => !!o),
  },
  {
    table: 'BD_PAYMENTAGENT', order: 7, signature: ['ID_AGENTCOMISSION', 'DATE PAYMENT'], targets: 'agentpayments',
    build: (rows) => rows.map((r) => {
      const id = clean(r.ID);
      if (!id) return null;
      return {
        collection: 'agentpayments', id,
        data: {
          datePayment: dateVal(r['DATE PAYMENT']),
          idAgent: clean(r.ID_AGENTCOMISSION),
          idCompany: clean(r.ID_COMPANY),
          idWorkorder: listVal(r['WORK ORDER TO PAY']),
          subtotal: num(r.SUBTOTAL),
          bonus: num(r.BONUS),
          discount: num(r.DISCOUNT),
          total: num(r.TOTAL),
          idPaymentmethod: clean(r.ID_PAYMENTMETHOD),
        },
      };
    }).filter((o): o is WriteOp => !!o),
  },
  {
    table: 'BD_TECHWO', order: 7, signature: ['ID_TEAM', 'LABOR'], targets: 'techwo',
    build: (rows) => rows.map((r) => {
      const id = clean(r.ID);
      if (!id) return null;
      return {
        collection: 'techwo', id,
        data: {
          idWorkorder: clean(r['ID WORK ORDER']),
          dateWorkorder: dateVal(r['DATE WORK ORDER']),
          idTeam: clean(r.ID_TEAM),
          labor: num(r.LABOR),
          cash: num(r.CASH),
          status: clean(r.Status),
          idPaymenttech: clean(r.ID_PAYMENTTECH),
        },
      };
    }).filter((o): o is WriteOp => !!o),
  },
  {
    table: 'BD_EXPENSES', order: 7, signature: ['ID_EXPENSES', 'AMOUNT_EXPENSES'], targets: 'expenses',
    build: (rows) => rows.map((r) => {
      const id = clean(r.ID_EXPENSES);
      if (!id) return null;
      return {
        collection: 'expenses', id,
        data: {
          idCatexpenses: clean(r.ID_CATEXPENSES),
          description: clean(r.DESCRIPTION_EXPENSES),
          amount: num(r.AMOUNT_EXPENSES),
          idPaymentmethod: clean(r.ID_PAYMENTMETHOD),
          reference: clean(r.REFERENCE),
          note: clean(r.NOTE),
          status: clean(r.STATUS_EXPENSES),
          dateExpenses: dateVal(r.DATE_EXPENSES),
          createdAt: ts(r.Timestamp_userCreate),
        },
      };
    }).filter((o): o is WriteOp => !!o),
  },
  {
    table: 'BD_DEBITNOTE', order: 7, signature: ['# DEBIT NOTE'], targets: 'debitnotes',
    build: (rows) => rows.map((r) => {
      const id = clean(r.ID);
      if (!id) return null;
      return {
        collection: 'debitnotes', id,
        data: {
          date: dateVal(r.DATE),
          debitNoteNumber: clean(r['# DEBIT NOTE']),
          creditNoteNumber: clean(r['# Credit Note']),
          idDistributor: clean(r.ID_DISTRIBUTOR),
          idServicepart: clean(r.ID_SERVICEPART),
          idPartnumber: clean(r.ID_PARTNUMBER),
          glassCost: num(r.GLASS_COST),
          appliedTo: clean(r.APPLIED_TO),
          idTech: clean(r.ID_TECH),
          idPaymenttech: clean(r.ID_PAYMENTTECH),
          note: clean(r.NOTE),
        },
      };
    }).filter((o): o is WriteOp => !!o),
  },
  {
    table: 'BD_CREDITNOTE', order: 7, signature: ['ID_DEBITNOTE', 'CREDIT_INVOICE'], targets: 'creditnotes',
    build: (rows) => rows.map((r) => {
      const id = clean(r.ID);
      if (!id) return null;
      return {
        collection: 'creditnotes', id,
        data: {
          idDebitnote: clean(r.ID_DEBITNOTE),
          idPaymentdistributor: clean(r['ID_PAYMENT DISTRIBUTOR']),
          date: dateVal(r.DATE),
          idPartnumber: clean(r.ID_PARTNUMBER),
          glassCost: num(r['GLASS COST']),
          creditInvoice: clean(r.CREDIT_INVOICE),
          note: clean(r.NOTE),
        },
      };
    }).filter((o): o is WriteOp => !!o),
  },
  {
    table: 'BONUS_DISCOUNT_AGENT', order: 7, signature: ['ID_PAYMENTAGENT', 'TYPE'], targets: 'bonusdiscountagent',
    build: (rows) => rows.map((r) => {
      const id = clean(r.ID);
      if (!id) return null;
      return {
        collection: 'bonusdiscountagent', id,
        data: { idPaymentagent: clean(r.ID_PAYMENTAGENT), date: dateVal(r.DATE), type: clean(r.TYPE_LABEL) || clean(r.TYPE), amount: num(r.AMOUNT), note: clean(r.NOTE) },
      };
    }).filter((o): o is WriteOp => !!o),
  },
  {
    table: 'BONUS_DISCOUNT_TECH', order: 7, signature: ['ID_PAYMENTTECH', 'TYPE'], targets: 'bonusdiscounttech',
    build: (rows) => rows.map((r) => {
      const id = clean(r.ID);
      if (!id) return null;
      return {
        collection: 'bonusdiscounttech', id,
        data: { idPaymenttech: clean(r.ID_PAYMENTTECH), date: dateVal(r.DATE), type: clean(r.TYPE_LABEL) || clean(r.TYPE), amount: num(r.AMOUNT), note: clean(r.NOTE) },
      };
    }).filter((o): o is WriteOp => !!o),
  },
];

// ─────────────────────── Detección y utilidades ────────────────────────────

function detectSpec(fileName: string, headers: string[]): TableSpec | null {
  const base = fileName.toUpperCase();
  const byName = SPECS.find((s) => base.includes(s.table));
  if (byName) return byName;
  const set = new Set(headers.map((h) => h.trim()));
  return SPECS.find((s) => s.signature.every((col) => set.has(col))) || null;
}

function toRows(parsed: string[][]): CsvRow[] {
  if (parsed.length < 2) return [];
  const headers = parsed[0].map((h) => h.trim());
  return parsed.slice(1).map((cells) => {
    const o: CsvRow = {};
    headers.forEach((h, i) => { if (h) o[h] = (cells[i] ?? '').toString(); });
    return o;
  });
}

async function clearCollection(name: string, onProgress: (n: number) => void): Promise<number> {
  const snap = await getDocs(collection(db, name));
  let removed = 0;
  const ids = snap.docs.map((d) => d.id);
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    ids.slice(i, i + 400).forEach((id) => batch.delete(doc(db, name, id)));
    await batch.commit();
    removed += Math.min(400, ids.length - i);
    onProgress(removed);
  }
  return removed;
}

// ─────────────────────────────── Componente ────────────────────────────────

interface LoadedFile {
  name: string;
  spec: TableSpec | null;
  rows: CsvRow[];
}

type Phase = 'pick' | 'ready' | 'running' | 'done';

export default function DatabaseImportView() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<LoadedFile[]>([]);
  const [phase, setPhase] = useState<Phase>('pick');
  const [importVehicles, setImportVehicles] = useState(false);
  const [clearBefore, setClearBefore] = useState(false);
  const [progress, setProgress] = useState<{ label: string; done: number; total: number }>({ label: '', done: 0, total: 0 });
  const [summary, setSummary] = useState<{ collection: string; count: number }[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const detected = useMemo(() => files.filter((f) => f.spec), [files]);
  const unknown = useMemo(() => files.filter((f) => !f.spec), [files]);
  const totalRows = useMemo(() => detected.reduce((s, f) => s + f.rows.length, 0), [detected]);
  const hasVehicleFile = detected.some((f) => f.spec!.table === 'CAT_VEHICLE');
  const vehicleRows = detected.find((f) => f.spec!.table === 'CAT_VEHICLE')?.rows.length ?? 0;

  const handleFiles = async (list: FileList | null) => {
    if (!list || !list.length) return;
    const loaded: LoadedFile[] = [];
    for (const file of Array.from(list)) {
      try {
        const text = await file.text();
        const parsed = parseCsv(text);
        const headers = parsed[0]?.map((h) => h.trim()) ?? [];
        loaded.push({ name: file.name, spec: detectSpec(file.name, headers), rows: toRows(parsed) });
      } catch {
        loaded.push({ name: file.name, spec: null, rows: [] });
      }
    }
    // Reemplaza archivos repetidos por nombre; conserva el resto.
    setFiles((prev) => {
      const names = new Set(loaded.map((f) => f.name));
      return [...prev.filter((f) => !names.has(f.name)), ...loaded];
    });
    setPhase('ready');
  };

  const runImport = async () => {
    setPhase('running');
    setErrors([]);
    const errs: string[] = [];
    const counts = new Map<string, number>();

    const ctx: Ctx = { vehicleXref: new Map(), carrierIds: new Map(), importVehicles };
    const ordered = [...detected].sort((a, b) => a.spec!.order - b.spec!.order);

    try {
      // 1. Generar todas las operaciones (los cruces en memoria se llenan en orden).
      const allOps: WriteOp[] = [];
      for (const f of ordered) {
        try {
          const ops = f.spec!.build(f.rows, ctx);
          allOps.push(...ops);
        } catch (e) {
          errs.push(`${f.name}: ${e instanceof Error ? e.message : 'error al transformar'}`);
        }
      }

      // 2. Vaciar colecciones destino si se pidió.
      if (clearBefore) {
        const cols = Array.from(new Set(allOps.map((o) => o.collection)));
        for (const col of cols) {
          setProgress({ label: `Vaciando ${col}...`, done: 0, total: 0 });
          await clearCollection(col, (n) => setProgress({ label: `Vaciando ${col}...`, done: n, total: 0 }));
        }
      }

      // 3. Escribir en lotes de 400 (mezclando colecciones sin problema).
      setProgress({ label: 'Importando...', done: 0, total: allOps.length });
      for (let i = 0; i < allOps.length; i += 400) {
        const batch = writeBatch(db);
        allOps.slice(i, i + 400).forEach((op) => {
          batch.set(doc(db, op.collection, op.id), op.data);
          counts.set(op.collection, (counts.get(op.collection) ?? 0) + 1);
        });
        await batch.commit();
        setProgress({ label: 'Importando...', done: Math.min(i + 400, allOps.length), total: allOps.length });
      }

      setSummary(Array.from(counts.entries()).map(([collection, count]) => ({ collection, count })).sort((a, b) => b.count - a.count));
      setErrors(errs);
      setPhase('done');
    } catch (e) {
      errs.push(e instanceof Error ? e.message : 'Error inesperado durante la importación.');
      setErrors(errs);
      setPhase('ready');
    }
  };

  const reset = () => {
    setFiles([]); setSummary([]); setErrors([]);
    setPhase('pick');
    setProgress({ label: '', done: 0, total: 0 });
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="dbimport">
      <div className="dbimport-head">
        <h1><Database size={22} /> Migración de base de datos</h1>
        <p className="dbimport-sub">
          Carga los CSV exportados del sistema anterior (BD_*.csv y CAT_*.csv). Cada tabla se detecta
          automáticamente y se importa a su colección conservando los IDs originales, así todas las
          relaciones quedan funcionando.
        </p>
      </div>

      {/* Zona de carga */}
      <div
        className="dbimport-drop"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); void handleFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
      >
        <FileUp size={30} />
        <p><strong>Arrastra aquí los CSV</strong> (puedes soltar los 27 a la vez) o haz clic para elegirlos</p>
        <input
          ref={inputRef} type="file" accept=".csv,text/csv" multiple className="dbimport-input"
          onChange={(e) => void handleFiles(e.target.files)}
        />
      </div>

      {/* Plan de importación */}
      {files.length > 0 && (
        <div className="dbimport-plan">
          <h2>Plan de importación · {detected.length} tablas · {totalRows.toLocaleString()} filas</h2>
          <table>
            <thead>
              <tr><th>Archivo</th><th>Filas</th><th>Destino</th></tr>
            </thead>
            <tbody>
              {[...detected].sort((a, b) => a.spec!.order - b.spec!.order).map((f) => (
                <tr key={f.name}>
                  <td><FileSpreadsheet size={14} /> {f.name}</td>
                  <td className="num">{f.rows.length.toLocaleString()}</td>
                  <td>{f.spec!.targets}</td>
                </tr>
              ))}
              {unknown.map((f) => (
                <tr key={f.name} className="row-unknown">
                  <td><AlertTriangle size={14} /> {f.name}</td>
                  <td className="num">{f.rows.length.toLocaleString()}</td>
                  <td>No reconocido — se omite</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="dbimport-options">
            {hasVehicleFile && (
              <label className="opt">
                <input type="checkbox" checked={importVehicles} onChange={(e) => setImportVehicles(e.target.checked)} />
                <span>
                  Subir también el catálogo completo de vehículos ({vehicleRows.toLocaleString()} docs).
                  <em> No es necesario: los vehículos de las órdenes se resuelven en memoria. Subirlo tarda bastante y consume escrituras.</em>
                </span>
              </label>
            )}
            <label className="opt">
              <input type="checkbox" checked={clearBefore} onChange={(e) => setClearBefore(e.target.checked)} />
              <span>Vaciar las colecciones destino antes de importar <em>(recomendado si ya habías hecho pruebas)</em></span>
            </label>
          </div>

          {phase === 'running' ? (
            <div className="dbimport-progress">
              <Loader2 size={18} className="spin" />
              <div className="bar">
                <div className="fill" style={{ width: progress.total ? `${(progress.done / progress.total) * 100}%` : '30%' }} />
              </div>
              <span>{progress.label} {progress.total > 0 && `${progress.done.toLocaleString()} / ${progress.total.toLocaleString()}`}</span>
            </div>
          ) : (
            <div className="dbimport-actions">
              <button className="btn-primary" onClick={() => void runImport()} disabled={detected.length === 0}>
                <Play size={15} /> Importar todo
              </button>
              <button className="btn-ghost" onClick={reset}><RotateCcw size={15} /> Empezar de nuevo</button>
            </div>
          )}
        </div>
      )}

      {/* Resumen */}
      {phase === 'done' && (
        <div className="dbimport-summary">
          <h2><CheckCircle2 size={18} /> Importación completada</h2>
          <table>
            <thead><tr><th>Colección</th><th>Documentos</th></tr></thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.collection}><td>{s.collection}</td><td className="num">{s.count.toLocaleString()}</td></tr>
              ))}
            </tbody>
          </table>
          {errors.length > 0 && (
            <div className="dbimport-errors">
              <h3><AlertTriangle size={15} /> Avisos</h3>
              <ul>{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}
          <p className="dbimport-note">
            Los módulos se actualizan en vivo (suscripción a Firestore) — abre Work Orders o cualquier
            catálogo y verás los datos. Si quieres repetir la migración, usa "Vaciar las colecciones destino".
          </p>
          <button className="btn-ghost" onClick={reset}><Trash2 size={15} /> Limpiar y cargar otros archivos</button>
        </div>
      )}
    </div>
  );
}
