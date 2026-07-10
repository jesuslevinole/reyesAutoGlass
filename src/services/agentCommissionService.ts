import {
  collection,
  doc,
  getDocs,
  query,
  where,
  limit,
  addDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Módulo de COMISIONES DEL AGENTE por Work Order.
 * Colección: `agent_commissions` (una comisión por work order, enlazada por `workOrderId`).
 *
 * El histórico importado trae también `agentId` / `companyId` (IDs del sistema viejo);
 * los registros creados desde la app guardan el `agent` y `company` por NOMBRE (que es
 * lo que la work order maneja hoy). Ambos conviven sin problema en la misma colección.
 */

const COLLECTION = 'agent_commissions';
const PAYMENTS_COLLECTION = 'commission_payments';

export interface CommissionPayment {
  id?: string;
  consecutivo?: string;         // número de factura: Agent-0252
  date: string;                 // fecha del pago (YYYY-MM-DD o ISO)
  agent?: string;               // nombre del agente (facturas nuevas)
  agentId?: string;             // ID del agente (histórico: ID_AGENTCOMISSION)
  company?: string;             // nombre de la compañía (facturas nuevas)
  companyId?: string;           // histórico
  workOrderIds?: string[];      // WOs incluidas (histórico: WorkOrderToPay)
  commissionIds?: string[];     // IDs de agent_commissions incluidas (nuevas)
  subtotal: number;             // suma de comisiones
  bonus: number;                // bono adicional
  discount: number;             // descuento
  total: number;                // subtotal + bonus - discount
  paymentMethod?: string;
  paid?: boolean;               // factura pagada o pendiente de pago
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentCommission {
  id?: string;
  workOrderId: string;
  agent?: string;          // nombre del agente (desde la work order)
  agentId?: string;        // ID del agente (histórico)
  company?: string;        // nombre de la compañía (desde la work order)
  companyId?: string;      // ID de la compañía (histórico)
  aftermarketCommission: number;
  recommendCommission: number;
  oemCommission: number;
  servicesCommission: number;
  insuranceCommission: number;
  totalCommission: number;
  paid?: boolean;          // pagada / pendiente
  checked?: boolean;
  paymentId?: string;      // referencia al pago (commission_payments)
  createdAt?: string;
  updatedAt?: string;
}

const num = (v: any): number => Number(v) || 0;

export const agentCommissionService = {
  /** Suma de las 5 categorías = total de la comisión. */
  computeTotal(c: Partial<AgentCommission>): number {
    return (
      num(c.aftermarketCommission) +
      num(c.recommendCommission) +
      num(c.oemCommission) +
      num(c.servicesCommission) +
      num(c.insuranceCommission)
    );
  },

  /** Devuelve la comisión de un work order (o null si no existe). */
  async getByWorkOrder(workOrderId: string): Promise<AgentCommission | null> {
    if (!workOrderId) return null;
    const qs = await getDocs(
      query(collection(db, COLLECTION), where('workOrderId', '==', workOrderId), limit(1))
    );
    if (qs.empty) return null;
    const d = qs.docs[0];
    return { id: d.id, ...(d.data() as AgentCommission) };
  },

  /**
   * Crea o actualiza la comisión de un work order (1 por WO).
   * Si ya existe un registro para ese `workOrderId`, lo actualiza; si no, lo crea.
   */
  async saveForWorkOrder(workOrderId: string, data: Partial<AgentCommission>): Promise<string> {
    if (!workOrderId) throw new Error('workOrderId requerido para guardar la comisión.');

    const total = agentCommissionService.computeTotal(data);
    const payload: Record<string, any> = {
      workOrderId,
      agent: data.agent ?? '',
      company: data.company ?? '',
      aftermarketCommission: num(data.aftermarketCommission),
      recommendCommission: num(data.recommendCommission),
      oemCommission: num(data.oemCommission),
      servicesCommission: num(data.servicesCommission),
      insuranceCommission: num(data.insuranceCommission),
      totalCommission: total,
      updatedAt: new Date().toISOString(),
    };

    const existing = await agentCommissionService.getByWorkOrder(workOrderId);
    if (existing?.id) {
      await updateDoc(doc(db, COLLECTION, existing.id), payload);
      return existing.id;
    }

    const ref = await addDoc(collection(db, COLLECTION), {
      ...payload,
      paid: data.paid ?? false,
      checked: data.checked ?? false,
      createdAt: new Date().toISOString(),
    });
    return ref.id;
  },

  /** Elimina la(s) comisión(es) asociadas a un work order (al borrar la orden). */
  async removeByWorkOrder(workOrderId: string): Promise<void> {
    if (!workOrderId) return;
    const qs = await getDocs(
      query(collection(db, COLLECTION), where('workOrderId', '==', workOrderId))
    );
    await Promise.all(qs.docs.map((d) => deleteDoc(doc(db, COLLECTION, d.id))));
  },

  /** Marca una comisión como pagada / pendiente. */
  async setPaid(commissionId: string, paid: boolean): Promise<void> {
    await updateDoc(doc(db, COLLECTION, commissionId), { paid, updatedAt: new Date().toISOString() });
  },

  /** Lista todas las comisiones (para reportes por agente). */
  async listAll(): Promise<AgentCommission[]> {
    const qs = await getDocs(collection(db, COLLECTION));
    return qs.docs.map((d) => ({ id: d.id, ...(d.data() as AgentCommission) }));
  },

  /** Crea una comisión directamente (desde la vista de Comisiones). */
  async create(data: Partial<AgentCommission>): Promise<string> {
    const total = agentCommissionService.computeTotal(data);
    const ref = await addDoc(collection(db, COLLECTION), {
      workOrderId: data.workOrderId ?? '',
      agent: data.agent ?? '',
      agentId: data.agentId ?? '',
      company: data.company ?? '',
      aftermarketCommission: num(data.aftermarketCommission),
      recommendCommission: num(data.recommendCommission),
      oemCommission: num(data.oemCommission),
      servicesCommission: num(data.servicesCommission),
      insuranceCommission: num(data.insuranceCommission),
      totalCommission: total,
      paid: data.paid ?? false,
      checked: data.checked ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    return ref.id;
  },

  /** Actualiza una comisión por su ID de documento (no toca `paid`). */
  async update(id: string, data: Partial<AgentCommission>): Promise<void> {
    const total = agentCommissionService.computeTotal(data);
    await updateDoc(doc(db, COLLECTION, id), {
      workOrderId: data.workOrderId ?? '',
      agent: data.agent ?? '',
      company: data.company ?? '',
      aftermarketCommission: num(data.aftermarketCommission),
      recommendCommission: num(data.recommendCommission),
      oemCommission: num(data.oemCommission),
      servicesCommission: num(data.servicesCommission),
      insuranceCommission: num(data.insuranceCommission),
      totalCommission: total,
      updatedAt: new Date().toISOString(),
    });
  },

  /** Elimina una comisión por su ID de documento. */
  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COLLECTION, id));
  },

  // ── FACTURAS DE PAGO ─────────────────────────────────────────────────────
  // Colección `commission_payments`: cada factura agrupa comisiones de UN agente,
  // con subtotal (suma de comisiones) + bono − descuento = total. Las comisiones
  // incluidas quedan marcadas como pagadas con referencia a la factura.

  /** Crea una factura con las comisiones seleccionadas (todas del mismo agente). */
  async createInvoice(params: {
    agent: string;
    agentId?: string;
    company?: string;
    commissions: AgentCommission[];
    date?: string;
    bonus?: number;
    discount?: number;
    paymentMethod?: string;
    paid?: boolean;
  }): Promise<string> {
    const valid = params.commissions.filter((c) => c.id);
    if (!valid.length) throw new Error('No hay comisiones para facturar.');

    const subtotal = valid.reduce((s, c) => s + (Number(c.totalCommission) || 0), 0);
    const bonus = num(params.bonus);
    const discount = num(params.discount);

    // Consecutivo de factura: Agent-XXXX (siguiente al mayor existente).
    const existing = await getDocs(collection(db, PAYMENTS_COLLECTION));
    let maxNum = 0;
    existing.docs.forEach((d) => {
      const m = String((d.data() as any).consecutivo || '').match(/(\d+)\s*$/);
      if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
    });
    const consecutivo = `Agent-${String(maxNum + 1).padStart(4, '0')}`;

    const payRef = await addDoc(collection(db, PAYMENTS_COLLECTION), {
      consecutivo,
      date: params.date || new Date().toISOString().slice(0, 10),
      agent: params.agent || '',
      agentId: params.agentId || '',
      company: params.company || '',
      workOrderIds: valid.map((c) => c.workOrderId || '').filter(Boolean),
      commissionIds: valid.map((c) => c.id),
      subtotal,
      bonus,
      discount,
      total: subtotal + bonus - discount,
      paymentMethod: params.paymentMethod || '',
      paid: params.paid ?? false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const batch = writeBatch(db);
    valid.forEach((c) => {
      batch.update(doc(db, COLLECTION, c.id!), { paid: true, paymentId: payRef.id, updatedAt: new Date().toISOString() });
    });
    await batch.commit();

    return payRef.id;
  },

  /** Agrega más comisiones a una factura existente (recalcula subtotal y total). */
  async addToInvoice(payment: CommissionPayment, commissions: AgentCommission[]): Promise<void> {
    if (!payment.id) throw new Error('Factura sin ID.');
    const valid = commissions.filter((c) => c.id);
    if (!valid.length) return;

    const added = valid.reduce((s, c) => s + (Number(c.totalCommission) || 0), 0);
    const subtotal = num(payment.subtotal) + added;
    const total = subtotal + num(payment.bonus) - num(payment.discount);

    await updateDoc(doc(db, PAYMENTS_COLLECTION, payment.id), {
      commissionIds: [...(payment.commissionIds || []), ...valid.map((c) => c.id!)],
      workOrderIds: [...(payment.workOrderIds || []), ...valid.map((c) => c.workOrderId || '').filter(Boolean)],
      subtotal,
      total,
      updatedAt: new Date().toISOString(),
    });

    const batch = writeBatch(db);
    valid.forEach((c) => {
      batch.update(doc(db, COLLECTION, c.id!), { paid: true, paymentId: payment.id, updatedAt: new Date().toISOString() });
    });
    await batch.commit();
  },

  /** Marca una factura como pagada / pendiente. */
  async setInvoicePaid(paymentId: string, paid: boolean): Promise<void> {
    await updateDoc(doc(db, PAYMENTS_COLLECTION, paymentId), { paid, updatedAt: new Date().toISOString() });
  },

  /**
   * Edita los datos de una factura (fecha, método, bono, descuento).
   * El subtotal no se toca (viene de las comisiones); el total se recalcula.
   * Si la factura no tiene consecutivo (creada antes de esta función), se le asigna el siguiente.
   */
  async updateInvoice(payment: CommissionPayment, changes: { date?: string; paymentMethod?: string; bonus?: number; discount?: number }): Promise<void> {
    if (!payment.id) throw new Error('Factura sin ID.');
    const bonus = num(changes.bonus ?? payment.bonus);
    const discount = num(changes.discount ?? payment.discount);
    const subtotal = num(payment.subtotal);

    const patch: Record<string, any> = {
      date: changes.date ?? payment.date ?? '',
      paymentMethod: (changes.paymentMethod ?? payment.paymentMethod ?? '').trim(),
      bonus,
      discount,
      total: subtotal + bonus - discount,
      updatedAt: new Date().toISOString(),
    };

    if (!payment.consecutivo) {
      const existing = await getDocs(collection(db, PAYMENTS_COLLECTION));
      let maxNum = 0;
      existing.docs.forEach((d) => {
        const m = String((d.data() as any).consecutivo || '').match(/(\d+)\s*$/);
        if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
      });
      patch.consecutivo = `Agent-${String(maxNum + 1).padStart(4, '0')}`;
    }

    await updateDoc(doc(db, PAYMENTS_COLLECTION, payment.id), patch);
  },

  /**
   * Elimina una factura y devuelve sus comisiones a Pendiente
   * (paid=false y sin referencia a la factura).
   */
  async deleteInvoice(paymentId: string, commissionsToRevert: AgentCommission[]): Promise<void> {
    if (!paymentId) throw new Error('Factura sin ID.');
    const batch = writeBatch(db);
    commissionsToRevert.filter((c) => c.id).forEach((c) => {
      batch.update(doc(db, COLLECTION, c.id!), { paid: false, paymentId: '', updatedAt: new Date().toISOString() });
    });
    batch.delete(doc(db, PAYMENTS_COLLECTION, paymentId));
    await batch.commit();
  },

  /** Historial de facturas (más recientes primero). */
  async listPayments(): Promise<CommissionPayment[]> {
    const qs = await getDocs(collection(db, PAYMENTS_COLLECTION));
    return qs.docs
      .map((d) => ({ id: d.id, ...(d.data() as CommissionPayment) }))
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  },
};