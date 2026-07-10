import React, { useEffect, useMemo, useState } from 'react';
import { agentCommissionService, type AgentCommission, type CommissionPayment } from '../services/agentCommissionService';
import { workOrderService } from '../services/workOrderService';
import type { WorkOrderData } from '../types/workOrder';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Loader2, CheckCircle2, Clock, Search, Wallet, Plus, Edit2, Trash2, X, Save, Receipt, History, FileText, PlusCircle } from 'lucide-react';

const money = (n: any) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);

const fmtDate = (iso?: string) => {
  if (!iso) return '—';
  try { return new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'short', day: 'numeric' }); }
  catch { return iso; }
};

type Tab = 'list' | 'payments';
const PAGE_SIZE = 50;

interface WoInfo { consecutivo?: string; agent?: string; company?: string }

const emptyForm = {
  id: '', workOrderId: '', agent: '', company: '',
  aftermarketCommission: '', recommendCommission: '', oemCommission: '',
  servicesCommission: '', insuranceCommission: '',
};

const emptyInvoiceForm = { date: new Date().toISOString().slice(0, 10), bonus: '', discount: '', paymentMethod: '', paid: false };

export const CommissionsPage: React.FC = () => {
  const [tab, setTab] = useState<Tab>('list');
  const [rows, setRows] = useState<AgentCommission[]>([]);
  const [woMap, setWoMap] = useState<Map<string, WoInfo>>(new Map());
  const [payMethodMap, setPayMethodMap] = useState<Map<string, string>>(new Map());
  const [payments, setPayments] = useState<CommissionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'pending' | 'paid' | 'all'>('pending'); // inicia en pendientes
  const [paySearch, setPaySearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [form, setForm] = useState<typeof emptyForm | null>(null);
  const [savingForm, setSavingForm] = useState(false);
  const [invoiceForm, setInvoiceForm] = useState<typeof emptyInvoiceForm | null>(null); // modal Facturar
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [viewPayment, setViewPayment] = useState<CommissionPayment | null>(null);       // modal detalle de factura
  const [invBonus, setInvBonus] = useState('');                                          // bono editable en el detalle
  const [invDiscount, setInvDiscount] = useState('');                                    // descuento editable en el detalle
  const [savingInvAmounts, setSavingInvAmounts] = useState(false);
  const [woDetail, setWoDetail] = useState<WorkOrderData | null>(null);                  // modal detalle de work order
  const [loadingWoDetail, setLoadingWoDetail] = useState(false);
  const [editInvoice, setEditInvoice] = useState<CommissionPayment | null>(null);       // modal editar factura
  const [editInvoiceForm, setEditInvoiceForm] = useState({ date: '', paymentMethod: '', bonus: '', discount: '' });
  const [savingEditInvoice, setSavingEditInvoice] = useState(false);
  const [addSelection, setAddSelection] = useState<Set<string>>(new Set());             // selección "agregar a factura"
  const [addingToInvoice, setAddingToInvoice] = useState(false);
  const [togglingInvoice, setTogglingInvoice] = useState<string | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [comms, orders, pays] = await Promise.all([
        agentCommissionService.listAll(),
        workOrderService.getAll(),
        agentCommissionService.listPayments(),
      ]);
      setRows(comms);
      setPayments(pays);
      const map = new Map<string, WoInfo>();
      orders.forEach((o: any) => {
        map.set(String(o.id), { consecutivo: o.consecutivo, agent: o.agent, company: o.company });
      });
      setWoMap(map);

      // Catálogo de métodos de pago (para mostrar el nombre en facturas históricas).
      try {
        const pmSnap = await getDocs(collection(db, 'catalog_payment_method'));
        const pm = new Map<string, string>();
        pmSnap.docs.forEach((d) => {
          const data: any = d.data();
          const name = data.name || data.label || data.value || data.description ||
            (Object.values(data).find((v) => typeof v === 'string' && v && String(v).length <= 40) as string) || d.id;
          pm.set(d.id, String(name));
        });
        setPayMethodMap(pm);
      } catch { /* si el catálogo no existe, se muestra el valor tal cual */ }
    } catch (e) {
      console.error('Error cargando comisiones:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  // ── Resolución de nombres ──
  const wo = (c: AgentCommission): WoInfo => woMap.get(String(c.workOrderId || '')) || {};
  const agentName = (c: AgentCommission) => (c.agent && c.agent.trim()) || wo(c).agent || c.agentId || '—';
  const companyName = (c: AgentCommission) => (c.company && c.company.trim()) || wo(c).company || '—';
  const woNumber = (c: AgentCommission) => wo(c).consecutivo || c.workOrderId || '—';

  // Mapa agentId → nombre (para mostrar facturas históricas con nombre).
  const agentIdName = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((c) => {
      if (c.agentId && !m.has(c.agentId)) {
        const n = (c.agent && c.agent.trim()) || wo(c).agent;
        if (n) m.set(c.agentId, n);
      }
    });
    return m;
  }, [rows, woMap]);

  const invoiceAgentName = (p: CommissionPayment) =>
    (p.agent && p.agent.trim()) || (p.agentId && agentIdName.get(p.agentId)) || p.agentId || '—';

  // Mapa companyId → nombre (resuelto vía las comisiones y sus work orders).
  const companyIdName = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((c) => {
      if ((c as any).companyId && !m.has((c as any).companyId)) {
        const n = (c.company && c.company.trim()) || wo(c).company;
        if (n) m.set((c as any).companyId, n);
      }
    });
    return m;
  }, [rows, woMap]);

  const invoiceCompanyName = (p: CommissionPayment) =>
    (p.company && p.company.trim()) || (p.companyId && companyIdName.get(p.companyId)) || '—';

  const invoiceMethod = (p: CommissionPayment) => {
    const v = String(p.paymentMethod || '').trim();
    if (!v) return '—';
    return payMethodMap.get(v) || v;
  };

  // Número para ordenar: extrae el sufijo numérico (Wo-3864 → 3864, Agent-0251 → 251).
  const numSuffix = (s: any): number => {
    const m = String(s || '').match(/(\d+)\s*$/);
    return m ? parseInt(m[1], 10) : -1;
  };

  // Comisiones que pertenecen a una factura (nuevas por ID, históricas por paymentAgentId/paymentId o por WO).
  const commissionsOfPayment = (p: CommissionPayment): AgentCommission[] => {
    const ids = new Set(p.commissionIds || []);
    const woIds = new Set(p.workOrderIds || []);
    return rows.filter((c) =>
      (c.id && ids.has(c.id)) ||
      (p.id && (c.paymentId === p.id || (c as any).paymentAgentId === p.id)) ||
      (c.workOrderId && woIds.has(c.workOrderId) && (!p.agentId || c.agentId === p.agentId))
    );
  };

  // Factura donde se pagó una comisión (para consulta desde la vista de comisiones).
  const paymentOfCommission = (c: AgentCommission): CommissionPayment | undefined => {
    const ref = c.paymentId || (c as any).paymentAgentId;
    if (ref) {
      const byRef = payments.find((p) => p.id === ref);
      if (byRef) return byRef;
    }
    if (c.id) {
      const byList = payments.find((p) => (p.commissionIds || []).includes(c.id!));
      if (byList) return byList;
    }
    if (c.workOrderId) {
      return payments.find((p) => (p.workOrderIds || []).includes(c.workOrderId!) && (!p.agentId || p.agentId === c.agentId));
    }
    return undefined;
  };

  // ── Filtro de comisiones (ordenadas por número de Work Order, desc) ──
  const searchFiltered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const base = !q ? rows : rows.filter((c) =>
      agentName(c).toLowerCase().includes(q) ||
      companyName(c).toLowerCase().includes(q) ||
      String(woNumber(c)).toLowerCase().includes(q) ||
      String(c.workOrderId || '').toLowerCase().includes(q)
    );
    return [...base].sort((a, b) => numSuffix(woNumber(b)) - numSuffix(woNumber(a)));
  }, [rows, search, woMap]);

  // La tabla muestra según el filtro de estado (por defecto: pendientes).
  const filtered = useMemo(() =>
    statusFilter === 'all' ? searchFiltered : searchFiltered.filter((c) => statusFilter === 'paid' ? !!c.paid : !c.paid),
  [searchFiltered, statusFilter]);

  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const totalAll = searchFiltered.reduce((s, c) => s + (Number(c.totalCommission) || 0), 0);
  const paidRows = searchFiltered.filter((c) => c.paid);
  const totalPaid = paidRows.reduce((s, c) => s + (Number(c.totalCommission) || 0), 0);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Selección (solo mismo agente) ──
  const selectedRows = rows.filter((c) => c.id && selected.has(c.id));
  const selectedAgent = selectedRows.length ? agentName(selectedRows[0]) : null;
  const selectedTotal = selectedRows.reduce((s, c) => s + (Number(c.totalCommission) || 0), 0);

  const canSelect = (c: AgentCommission) => !c.paid && (!selectedAgent || agentName(c) === selectedAgent);
  const toggleSelect = (c: AgentCommission) => {
    if (!c.id || !canSelect(c)) return;
    setSelected((prev) => { const n = new Set(prev); n.has(c.id!) ? n.delete(c.id!) : n.add(c.id!); return n; });
  };

  const pagePendingAgents = new Set(pageRows.filter((c) => !c.paid).map(agentName));
  const headerSelectEnabled = pagePendingAgents.size === 1 || !!selectedAgent;
  const headerTargetAgent = selectedAgent || (pagePendingAgents.size === 1 ? Array.from(pagePendingAgents)[0] : null);
  const headerTargetIds = headerTargetAgent ? pageRows.filter((c) => !c.paid && c.id && agentName(c) === headerTargetAgent).map((c) => c.id!) : [];
  const allHeaderSelected = headerTargetIds.length > 0 && headerTargetIds.every((id) => selected.has(id));
  const toggleSelectPage = () => {
    if (!headerTargetAgent) return;
    setSelected((prev) => {
      const n = new Set(prev);
      if (allHeaderSelected) headerTargetIds.forEach((id) => n.delete(id));
      else headerTargetIds.forEach((id) => n.add(id));
      return n;
    });
  };

  // ── Facturar ──
  const openInvoiceForm = () => setInvoiceForm({ ...emptyInvoiceForm });
  const invSubtotal = selectedTotal;
  const invTotal = invoiceForm ? invSubtotal + (Number(invoiceForm.bonus) || 0) - (Number(invoiceForm.discount) || 0) : 0;

  const saveInvoice = async () => {
    if (!invoiceForm || !selectedRows.length || !selectedAgent) return;
    setSavingInvoice(true);
    try {
      await agentCommissionService.createInvoice({
        agent: selectedAgent,
        agentId: selectedRows[0].agentId,
        company: companyName(selectedRows[0]) === '—' ? '' : companyName(selectedRows[0]),
        commissions: selectedRows,
        date: invoiceForm.date,
        bonus: Number(invoiceForm.bonus) || 0,
        discount: Number(invoiceForm.discount) || 0,
        paymentMethod: invoiceForm.paymentMethod.trim(),
        paid: invoiceForm.paid,
      });
      setInvoiceForm(null);
      setSelected(new Set());
      await loadAll();
      setTab('payments');
    } catch (e: any) {
      alert('No se pudo crear la factura: ' + (e?.message || e));
    } finally {
      setSavingInvoice(false);
    }
  };

  // ── Detalle de factura: pagada/pendiente + agregar registros ──
  const toggleInvoicePaid = async (p: CommissionPayment) => {
    if (!p.id) return;
    setTogglingInvoice(p.id);
    try {
      await agentCommissionService.setInvoicePaid(p.id, !p.paid);
      setPayments((prev) => prev.map((x) => (x.id === p.id ? { ...x, paid: !p.paid } : x)));
      setViewPayment((prev) => (prev && prev.id === p.id ? { ...prev, paid: !p.paid } : prev));
    } catch (e: any) {
      alert('No se pudo cambiar el estado de la factura: ' + (e?.message || e));
    } finally {
      setTogglingInvoice(null);
    }
  };

  const addablePending = viewPayment
    ? rows.filter((c) => !c.paid && c.id && agentName(c) === invoiceAgentName(viewPayment))
    : [];

  // Abre el detalle de una factura sincronizando el bono/descuento editables.
  const openViewPayment = (p: CommissionPayment) => {
    setAddSelection(new Set());
    setInvBonus(String(p.bonus ?? ''));
    setInvDiscount(String(p.discount ?? ''));
    setViewPayment(p);
  };

  const invAmountsChanged = !!viewPayment &&
    ((Number(invBonus) || 0) !== (Number(viewPayment.bonus) || 0) ||
     (Number(invDiscount) || 0) !== (Number(viewPayment.discount) || 0));
  const invLiveTotal = viewPayment
    ? (Number(viewPayment.subtotal) || 0) + (Number(invBonus) || 0) - (Number(invDiscount) || 0)
    : 0;

  const saveInvAmounts = async () => {
    if (!viewPayment || !invAmountsChanged) return;
    setSavingInvAmounts(true);
    try {
      await agentCommissionService.updateInvoice(viewPayment, {
        bonus: Number(invBonus) || 0,
        discount: Number(invDiscount) || 0,
      });
      const pays = await agentCommissionService.listPayments();
      setPayments(pays);
      const fresh = pays.find((p) => p.id === viewPayment.id);
      if (fresh) { setViewPayment(fresh); setInvBonus(String(fresh.bonus ?? '')); setInvDiscount(String(fresh.discount ?? '')); }
    } catch (e: any) {
      alert('No se pudo guardar: ' + (e?.message || e));
    } finally {
      setSavingInvAmounts(false);
    }
  };

  // Detalle de work order (clic en el número de WO).
  const openWoDetail = async (workOrderId?: string) => {
    const id = String(workOrderId || '').trim();
    if (!id) return;
    setLoadingWoDetail(true);
    try {
      const order = await workOrderService.getById(id);
      if (!order) { alert('No se encontró la work order ' + id); return; }
      setWoDetail(order);
    } catch (e: any) {
      alert('No se pudo cargar la work order: ' + (e?.message || e));
    } finally {
      setLoadingWoDetail(false);
    }
  };

  // Totales de la WO (mismas fórmulas del formulario).
  const woTotals = (o: WorkOrderData) => {
    const n = (v: any) => Number(v) || 0;
    const tax = (n(o.subtotalPart) + n(o.subtotalMolding)) * (n(o.taxPercent) / 100);
    const total = n(o.subtotalPart) + n(o.subtotalMolding) + n(o.subtotalServices) + n(o.totalLabor) + n((o as any).upsell) + n((o as any).kitFlatRate) + tax;
    return { tax, total, balance: total - n(o.paid) };
  };

  // ── Editar / eliminar factura ──
  const openEditInvoice = (p: CommissionPayment) => {
    setEditInvoice(p);
    setEditInvoiceForm({
      date: String(p.date || '').slice(0, 10),
      paymentMethod: invoiceMethod(p) === '—' ? '' : invoiceMethod(p),
      bonus: String(p.bonus ?? ''),
      discount: String(p.discount ?? ''),
    });
  };

  const editInvoiceTotal = editInvoice
    ? (Number(editInvoice.subtotal) || 0) + (Number(editInvoiceForm.bonus) || 0) - (Number(editInvoiceForm.discount) || 0)
    : 0;

  const saveEditInvoice = async () => {
    if (!editInvoice) return;
    setSavingEditInvoice(true);
    try {
      await agentCommissionService.updateInvoice(editInvoice, {
        date: editInvoiceForm.date,
        paymentMethod: editInvoiceForm.paymentMethod.trim(),
        bonus: Number(editInvoiceForm.bonus) || 0,
        discount: Number(editInvoiceForm.discount) || 0,
      });
      setEditInvoice(null);
      await loadAll();
    } catch (e: any) {
      alert('No se pudo actualizar la factura: ' + (e?.message || e));
    } finally {
      setSavingEditInvoice(false);
    }
  };

  const handleDeleteInvoice = async (p: CommissionPayment) => {
    if (!p.id) return;
    const included = commissionsOfPayment(p);
    if (!window.confirm(`¿Eliminar la factura ${p.consecutivo || fmtDate(p.date)} de ${invoiceAgentName(p)} por ${money(p.total)}?\n\nSus ${included.length} comisión(es) volverán a estado Pendiente.`)) return;
    try {
      await agentCommissionService.deleteInvoice(p.id, included);
      if (viewPayment?.id === p.id) setViewPayment(null);
      await loadAll();
    } catch (e: any) {
      alert('No se pudo eliminar la factura: ' + (e?.message || e));
    }
  };

  const handleAddToInvoice = async () => {
    if (!viewPayment || addSelection.size === 0) return;
    const toAdd = rows.filter((c) => c.id && addSelection.has(c.id));
    setAddingToInvoice(true);
    try {
      await agentCommissionService.addToInvoice(viewPayment, toAdd);
      setAddSelection(new Set());
      await loadAll();
      // refresca la factura abierta
      const fresh = (await agentCommissionService.listPayments()).find((p) => p.id === viewPayment.id);
      if (fresh) setViewPayment(fresh);
    } catch (e: any) {
      alert('No se pudieron agregar los registros: ' + (e?.message || e));
    } finally {
      setAddingToInvoice(false);
    }
  };

  // ── CRUD de comisión ──
  const openNew = () => setForm({ ...emptyForm });
  const openEdit = (c: AgentCommission) => setForm({
    id: c.id || '', workOrderId: c.workOrderId || '', agent: agentName(c) === '—' ? '' : agentName(c),
    company: companyName(c) === '—' ? '' : companyName(c),
    aftermarketCommission: String(c.aftermarketCommission ?? ''),
    recommendCommission: String(c.recommendCommission ?? ''),
    oemCommission: String(c.oemCommission ?? ''),
    servicesCommission: String(c.servicesCommission ?? ''),
    insuranceCommission: String(c.insuranceCommission ?? ''),
  });

  const formTotal = form
    ? ['aftermarketCommission', 'recommendCommission', 'oemCommission', 'servicesCommission', 'insuranceCommission']
        .reduce((s, k) => s + (Number((form as any)[k]) || 0), 0)
    : 0;

  const saveForm = async () => {
    if (!form) return;
    if (!form.workOrderId.trim() && !form.agent.trim()) { alert('Indica al menos el Work Order o el Agente.'); return; }
    setSavingForm(true);
    try {
      const payload = {
        workOrderId: form.workOrderId.trim(),
        agent: form.agent.trim(),
        company: form.company.trim(),
        aftermarketCommission: Number(form.aftermarketCommission) || 0,
        recommendCommission: Number(form.recommendCommission) || 0,
        oemCommission: Number(form.oemCommission) || 0,
        servicesCommission: Number(form.servicesCommission) || 0,
        insuranceCommission: Number(form.insuranceCommission) || 0,
      };
      if (form.id) await agentCommissionService.update(form.id, payload);
      else await agentCommissionService.create(payload);
      setForm(null);
      await loadAll();
    } catch (e: any) {
      alert('No se pudo guardar: ' + (e?.message || e));
    } finally {
      setSavingForm(false);
    }
  };

  const handleDelete = async (c: AgentCommission) => {
    if (!c.id) return;
    if (!window.confirm(`¿Eliminar la comisión de ${agentName(c)} (WO ${woNumber(c)}) por ${money(c.totalCommission)}?`)) return;
    try {
      await agentCommissionService.remove(c.id);
      setRows((prev) => prev.filter((r) => r.id !== c.id));
      setSelected((prev) => { const n = new Set(prev); n.delete(c.id!); return n; });
    } catch (e: any) {
      alert('No se pudo eliminar: ' + (e?.message || e));
    }
  };

  // ── Filtro de facturas (ordenadas por consecutivo, desc) ──
  const filteredPayments = useMemo(() => {
    const q = paySearch.toLowerCase().trim();
    const base = !q ? payments : payments.filter((p) =>
      invoiceAgentName(p).toLowerCase().includes(q) ||
      invoiceCompanyName(p).toLowerCase().includes(q) ||
      String(p.consecutivo || '').toLowerCase().includes(q) ||
      String(p.id || '').toLowerCase().includes(q) ||
      String(p.date || '').includes(q)
    );
    return [...base].sort((a, b) => {
      const diff = numSuffix(b.consecutivo) - numSuffix(a.consecutivo);
      return diff !== 0 ? diff : String(b.date || '').localeCompare(String(a.date || ''));
    });
  }, [payments, paySearch, agentIdName, companyIdName]);

  // ── Estilos ──
  const th: React.CSSProperties = { padding: '10px 12px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', borderBottom: '1px solid #E2E8F0', backgroundColor: '#F8FAFC', whiteSpace: 'nowrap' };
  const thR: React.CSSProperties = { ...th, textAlign: 'right' };
  const td: React.CSSProperties = { padding: '9px 12px', borderBottom: '1px solid #F1F5F9', fontSize: '0.82rem', color: '#0F172A', whiteSpace: 'nowrap' };
  const tdR: React.CSSProperties = { ...td, textAlign: 'right', color: '#334155' };
  const card: React.CSSProperties = { backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' };
  const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '0.55rem 0.75rem', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '0.875rem', color: '#0F172A', outline: 'none' };
  const label: React.CSSProperties = { display: 'block', fontSize: '0.72rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '0.3rem' };
  const iconBtn = (color: string, bg: string): React.CSSProperties => ({ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '30px', height: '30px', borderRadius: '7px', border: `1px solid ${bg}`, backgroundColor: bg, color, cursor: 'pointer' });
  const modalShell: React.CSSProperties = { position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(3px)', padding: '1rem' };
  const modalBox: React.CSSProperties = { backgroundColor: 'white', borderRadius: '14px', width: '100%', maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' };

  const paidPill = (paid?: boolean) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, border: `1px solid ${paid ? '#A7F3D0' : '#FDE68A'}`, backgroundColor: paid ? '#ECFDF5' : '#FFFBEB', color: paid ? '#047857' : '#92400E' }}>
      {paid ? <CheckCircle2 size={13} /> : <Clock size={13} />}
      {paid ? 'Pagada' : 'Pendiente'}
    </span>
  );

  const statCard = (key: 'all' | 'paid' | 'pending', labelTxt: string, count: number, amount: number, color: string) => {
    const active = statusFilter === key;
    return (
      <button
        type="button"
        onClick={() => setStatusFilter(key)}
        title={`Mostrar ${labelTxt.toLowerCase()}`}
        style={{
          flex: '1 1 160px', textAlign: 'left', cursor: 'pointer', padding: '1rem 1.2rem', borderRadius: '12px',
          border: `2px solid ${active ? color : '#E2E8F0'}`, backgroundColor: 'white',
          boxShadow: active ? `0 0 0 3px ${color}22` : '0 1px 3px rgba(0,0,0,0.03)', transition: 'all 0.15s',
        }}
      >
        <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: active ? color : '#64748B', marginBottom: '0.35rem' }}>{labelTxt} · {count}{active ? ' ✓' : ''}</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color }}>{money(amount)}</div>
      </button>
    );
  };

  const tabBtn = (id: Tab, labelTxt: string, icon: React.ReactNode) => (
    <button onClick={() => setTab(id)} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.55rem 1.2rem', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem', backgroundColor: tab === id ? 'white' : 'transparent', color: tab === id ? '#0F172A' : '#64748B', boxShadow: tab === id ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.2s' }}>
      {icon} {labelTxt}
    </button>
  );

  if (loading) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', height: '100%', width: '100%' }}>
        <style>{`@keyframes spin { 100% { transform: rotate(360deg); } }`}</style>
        <div style={{ textAlign: 'center' }}>
          <Loader2 size={44} color="#2563EB" style={{ animation: 'spin 1s linear infinite', margin: '0 auto' }} />
          <p style={{ marginTop: '1.2rem', fontWeight: 600, color: '#475569' }}>Cargando comisiones...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, width: '100%', height: '100%', overflowY: 'auto', backgroundColor: '#F1F5F9', boxSizing: 'border-box', padding: '2rem 2.5rem' }}>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .tabla-scroll { scrollbar-width: thin; scrollbar-color: #94A3B8 #F1F5F9; }
        .tabla-scroll::-webkit-scrollbar { width: 12px; height: 12px; }
        .tabla-scroll::-webkit-scrollbar-track { background: #F1F5F9; border-radius: 8px; }
        .tabla-scroll::-webkit-scrollbar-thumb { background: #94A3B8; border-radius: 8px; border: 2px solid #F1F5F9; }
        .tabla-scroll::-webkit-scrollbar-thumb:hover { background: #64748B; }
      `}</style>
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>

        {/* Encabezado + pestañas */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#DCFCE7', color: '#16A34A', borderRadius: '12px' }}>
              <Wallet size={24} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.7rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em' }}>Comisiones</h1>
              <p style={{ margin: '2px 0 0 0', color: '#64748B', fontSize: '0.9rem' }}>Comisiones de los agentes por work order</p>
            </div>
          </div>
          <div style={{ backgroundColor: '#E2E8F0', padding: '4px', borderRadius: '10px', display: 'flex', gap: '4px' }}>
            {tabBtn('list', 'Comisiones', <Wallet size={16} />)}
            {tabBtn('payments', 'Historial de Pagos', <History size={16} />)}
          </div>
        </div>

        {/* ════════ PESTAÑA: COMISIONES ════════ */}
        {tab === 'list' && (
          <>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
              {statCard('all', 'Todas', searchFiltered.length, totalAll, '#0F172A')}
              {statCard('paid', 'Pagadas', paidRows.length, totalPaid, '#16A34A')}
              {statCard('pending', 'Pendientes', searchFiltered.length - paidRows.length, totalAll - totalPaid, '#D97706')}
            </div>

            <div style={{ ...card, padding: '1rem 1.2rem', marginBottom: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ position: 'relative', flex: '1 1 300px', minWidth: '220px' }}>
                <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por agente, compañía o número de work order..." style={{ ...input, paddingLeft: '2.1rem' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {selected.size > 0 && (
                  <>
                    <span style={{ fontSize: '0.8rem', color: '#475569' }}>Agente: <strong>{selectedAgent}</strong></span>
                    <button onClick={openInvoiceForm} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1.1rem', borderRadius: '8px', border: 'none', backgroundColor: '#16A34A', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                      <Receipt size={16} /> Facturar {selected.size} · {money(selectedTotal)}
                    </button>
                  </>
                )}
                <button onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1.1rem', borderRadius: '8px', border: 'none', backgroundColor: '#0F172A', color: 'white', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>
                  <Plus size={16} /> Nueva Comisión
                </button>
              </div>
            </div>

            <div style={{ ...card, overflow: 'hidden' }}>
              <div className="tabla-scroll" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 460px)', minHeight: '340px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1240px' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                    <tr>
                      <th style={{ ...th, width: '36px', textAlign: 'center' }}>
                        <input type="checkbox" checked={allHeaderSelected} disabled={!headerSelectEnabled} onChange={toggleSelectPage}
                          title={headerSelectEnabled ? 'Seleccionar pendientes del agente' : 'Busca un agente para seleccionar en bloque'}
                          style={{ cursor: headerSelectEnabled ? 'pointer' : 'not-allowed', accentColor: '#16A34A' }} />
                      </th>
                      <th style={{ ...th, width: '80px' }}>Acciones</th>
                      <th style={th}>Agente</th>
                      <th style={th}>Compañía</th>
                      <th style={th}>Work Order</th>
                      <th style={thR}>Aftermarket</th>
                      <th style={thR}>Recommend</th>
                      <th style={thR}>OEM</th>
                      <th style={thR}>Servicios</th>
                      <th style={thR}>Seguro</th>
                      <th style={thR}>Total</th>
                      <th style={{ ...th, textAlign: 'center' }}>Estado</th>
                      <th style={th}>Pago</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr><td colSpan={13} style={{ ...td, textAlign: 'center', color: '#94A3B8', padding: '3rem', fontStyle: 'italic' }}>No hay comisiones con este filtro.</td></tr>
                    ) : pageRows.map((c) => {
                      const pay = c.paid ? paymentOfCommission(c) : undefined;
                      const selectable = canSelect(c);
                      return (
                        <tr key={c.id} style={{ backgroundColor: c.id && selected.has(c.id) ? '#F0FDF4' : 'transparent' }}>
                          <td style={{ ...td, textAlign: 'center' }}>
                            <input type="checkbox" disabled={!selectable} checked={!!c.id && selected.has(c.id)} onChange={() => toggleSelect(c)}
                              title={c.paid ? 'Ya pagada' : (!selectable ? `Solo registros de ${selectedAgent}` : 'Seleccionar para facturar')}
                              style={{ cursor: selectable ? 'pointer' : 'not-allowed', accentColor: '#16A34A', opacity: selectable ? 1 : 0.3 }} />
                          </td>
                          <td style={td}>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button onClick={() => openEdit(c)} title="Editar" style={iconBtn('#2563EB', '#EFF6FF')}><Edit2 size={14} /></button>
                              <button onClick={() => handleDelete(c)} title="Eliminar" style={iconBtn('#DC2626', '#FEF2F2')}><Trash2 size={14} /></button>
                            </div>
                          </td>
                          <td style={{ ...td, fontWeight: 600 }}>{agentName(c)}</td>
                          <td style={{ ...td, color: '#475569' }}>{companyName(c)}</td>
                          <td style={{ ...td }}><button onClick={() => openWoDetail(c.workOrderId)} title="Ver detalle de la work order" style={{ background: 'transparent', border: 'none', padding: 0, color: '#2563EB', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px' }}>{woNumber(c)}</button></td>
                          <td style={tdR}>{money(c.aftermarketCommission)}</td>
                          <td style={tdR}>{money(c.recommendCommission)}</td>
                          <td style={tdR}>{money(c.oemCommission)}</td>
                          <td style={tdR}>{money(c.servicesCommission)}</td>
                          <td style={tdR}>{money(c.insuranceCommission)}</td>
                          <td style={{ ...tdR, fontWeight: 800, color: '#0F172A' }}>{money(c.totalCommission)}</td>
                          <td style={{ ...td, textAlign: 'center' }}>{paidPill(c.paid)}</td>
                          <td style={td}>
                            {c.paid && pay ? (
                              <button onClick={() => openViewPayment(pay)} title="Ver la factura donde se pagó" style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
                                <span style={{ display: 'block', color: '#7C3AED', fontWeight: 700, fontSize: '0.8rem', textDecoration: 'underline', textUnderlineOffset: '3px' }}>{pay.consecutivo || 'Ver factura'}</span>
                                <span style={{ display: 'block', color: '#64748B', fontSize: '0.72rem', marginTop: '1px' }}>{fmtDate(pay.date)}</span>
                              </button>
                            ) : (
                              <span style={{ color: '#CBD5E1' }}>—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.9rem 1.2rem', borderTop: '1px solid #F1F5F9', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#64748B' }}>Mostrando {pageRows.length} de {filtered.length}{selected.size > 0 && <> · <strong style={{ color: '#16A34A' }}>{selected.size} de {selectedAgent} ({money(selectedTotal)})</strong></>}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <button type="button" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: '0.45rem 0.9rem', border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: 'white', cursor: page <= 1 ? 'not-allowed' : 'pointer', opacity: page <= 1 ? 0.5 : 1, fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Anterior</button>
                  <span style={{ fontSize: '0.82rem', color: '#475569', fontWeight: 600 }}>{page} / {pageCount}</span>
                  <button type="button" onClick={() => setPage(p => Math.min(pageCount, p + 1))} disabled={page >= pageCount} style={{ padding: '0.45rem 0.9rem', border: '1px solid #E2E8F0', borderRadius: '8px', backgroundColor: 'white', cursor: page >= pageCount ? 'not-allowed' : 'pointer', opacity: page >= pageCount ? 0.5 : 1, fontSize: '0.82rem', fontWeight: 600, color: '#475569' }}>Siguiente</button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ════════ PESTAÑA: HISTORIAL DE PAGOS (FACTURAS) ════════ */}
        {tab === 'payments' && (
          <>
            <div style={{ ...card, padding: '1rem 1.2rem', marginBottom: '1.25rem' }}>
              <div style={{ position: 'relative', maxWidth: '420px' }}>
                <Search size={16} color="#94A3B8" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }} />
                <input value={paySearch} onChange={(e) => setPaySearch(e.target.value)} placeholder="Buscar por número (Agent-0251), agente, compañía o fecha..." style={{ ...input, paddingLeft: '2.1rem' }} />
              </div>
            </div>

            <div style={{ ...card, overflow: 'hidden' }}>
              <div className="tabla-scroll" style={{ overflow: 'auto', maxHeight: 'calc(100vh - 320px)', minHeight: '340px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '1040px' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                    <tr>
                      <th style={{ ...th, width: '120px' }}>Acciones</th>
                      <th style={th}>#</th>
                      <th style={th}>Fecha de pago</th>
                      <th style={th}>Compañía</th>
                      <th style={th}>Agente</th>
                      <th style={thR}>Registros</th>
                      <th style={thR}>Subtotal</th>
                      <th style={thR}>Bono</th>
                      <th style={thR}>Descuento</th>
                      <th style={thR}>Total</th>
                      <th style={th}>Método de pago</th>
                      <th style={{ ...th, textAlign: 'center' }}>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments.length === 0 ? (
                      <tr><td colSpan={12} style={{ ...td, textAlign: 'center', color: '#94A3B8', padding: '3rem', fontStyle: 'italic' }}>No hay facturas. Selecciona comisiones pendientes de un agente y pulsa "Facturar".</td></tr>
                    ) : filteredPayments.map((p) => (
                      <tr key={p.id}>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => openViewPayment(p)} title="Ver detalle" style={iconBtn('#7C3AED', '#F5F3FF')}><FileText size={14} /></button>
                            <button onClick={() => openEditInvoice(p)} title="Editar factura" style={iconBtn('#2563EB', '#EFF6FF')}><Edit2 size={14} /></button>
                            <button onClick={() => handleDeleteInvoice(p)} title="Eliminar factura" style={iconBtn('#DC2626', '#FEF2F2')}><Trash2 size={14} /></button>
                          </div>
                        </td>
                        <td style={{ ...td, color: '#2563EB', fontWeight: 700 }}>{p.consecutivo || '—'}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{fmtDate(p.date)}</td>
                        <td style={{ ...td, color: '#475569' }}>{invoiceCompanyName(p)}</td>
                        <td style={{ ...td, fontWeight: 600 }}>{invoiceAgentName(p)}</td>
                        <td style={tdR}>{(p.commissionIds?.length || p.workOrderIds?.length || 0)}</td>
                        <td style={tdR}>{money(p.subtotal)}</td>
                        <td style={tdR}>{money(p.bonus)}</td>
                        <td style={{ ...tdR, color: (Number(p.discount) || 0) > 0 ? '#DC2626' : '#334155' }}>{(Number(p.discount) || 0) > 0 ? `-${money(p.discount)}` : money(0)}</td>
                        <td style={{ ...tdR, fontWeight: 800, color: '#16A34A' }}>{money(p.total)}</td>
                        <td style={{ ...td, color: '#475569' }}>{invoiceMethod(p)}</td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <button onClick={() => toggleInvoicePaid(p)} disabled={togglingInvoice === p.id} title="Clic para cambiar el estado de la factura" style={{ background: 'transparent', border: 'none', padding: 0, cursor: togglingInvoice === p.id ? 'wait' : 'pointer' }}>
                            {paidPill(p.paid)}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ════════ MODAL: NUEVA / EDITAR COMISIÓN ════════ */}
      {form && (
        <div style={modalShell}>
          <div style={{ ...modalBox, maxWidth: '620px' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A' }}>{form.id ? 'Editar Comisión' : 'Nueva Comisión'}</h3>
              <button onClick={() => setForm(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '0.3rem' }}><X size={22} /></button>
            </div>
            <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div>
                <label style={label}>Work Order (ID)</label>
                <input style={input} value={form.workOrderId} onChange={(e) => setForm({ ...form, workOrderId: e.target.value })} placeholder="ID del work order" />
                {form.workOrderId.trim() && woMap.get(form.workOrderId.trim()) && (
                  <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#16A34A' }}>✓ {woMap.get(form.workOrderId.trim())!.consecutivo || 'WO encontrada'} · {woMap.get(form.workOrderId.trim())!.agent || 'sin agente'}</p>
                )}
              </div>
              <div>
                <label style={label}>Agente</label>
                <input style={input} value={form.agent} onChange={(e) => setForm({ ...form, agent: e.target.value })} placeholder="Nombre del agente" />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={label}>Compañía</label>
                <input style={input} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Compañía" />
              </div>
              {([['aftermarketCommission', 'Aftermarket'], ['recommendCommission', 'Recommend'], ['oemCommission', 'OEM'], ['servicesCommission', 'Servicios'], ['insuranceCommission', 'Seguro']] as [keyof typeof emptyForm, string][]).map(([k, lbl]) => (
                <div key={k}>
                  <label style={label}>{lbl}</label>
                  <input type="number" step="any" style={input} value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} placeholder="$ 0.00" />
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Total</span>
                <span style={{ fontSize: '1.3rem', fontWeight: 900, color: '#15803D' }}>{money(formTotal)}</span>
              </div>
            </div>
            <div style={{ padding: '1.1rem 1.5rem', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', backgroundColor: '#F8FAFC' }}>
              <button onClick={() => setForm(null)} disabled={savingForm} style={{ padding: '0.6rem 1.1rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#334155', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={saveForm} disabled={savingForm} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', backgroundColor: '#0F172A', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: savingForm ? 'wait' : 'pointer' }}>
                {savingForm ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />} Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ MODAL: FACTURAR SELECCIONADOS ════════ */}
      {invoiceForm && (
        <div style={modalShell}>
          <div style={{ ...modalBox, maxWidth: '560px' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Receipt size={20} color="#16A34A" /> Facturar comisiones</h3>
              <button onClick={() => setInvoiceForm(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '0.3rem' }}><X size={22} /></button>
            </div>
            <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div style={{ gridColumn: '1 / -1', padding: '0.8rem 1rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '0.85rem', color: '#334155' }}>
                Agente: <strong>{selectedAgent}</strong> · {selectedRows.length} registro(s) · Subtotal <strong>{money(invSubtotal)}</strong>
              </div>
              <div>
                <label style={label}>Fecha de pago</label>
                <input type="date" style={input} value={invoiceForm.date} onChange={(e) => setInvoiceForm({ ...invoiceForm, date: e.target.value })} />
              </div>
              <div>
                <label style={label}>Método de pago</label>
                <input style={input} value={invoiceForm.paymentMethod} onChange={(e) => setInvoiceForm({ ...invoiceForm, paymentMethod: e.target.value })} placeholder="Transferencia, cheque..." />
              </div>
              <div>
                <label style={label}>Bono (+)</label>
                <input type="number" step="any" style={input} value={invoiceForm.bonus} onChange={(e) => setInvoiceForm({ ...invoiceForm, bonus: e.target.value })} placeholder="$ 0.00" />
              </div>
              <div>
                <label style={label}>Descuento (−)</label>
                <input type="number" step="any" style={input} value={invoiceForm.discount} onChange={(e) => setInvoiceForm({ ...invoiceForm, discount: e.target.value })} placeholder="$ 0.00" />
              </div>
              <label style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer', fontSize: '0.85rem', color: '#334155' }}>
                <input type="checkbox" checked={invoiceForm.paid} onChange={(e) => setInvoiceForm({ ...invoiceForm, paid: e.target.checked })} style={{ width: '17px', height: '17px', accentColor: '#16A34A', cursor: 'pointer' }} />
                Marcar la factura como <strong>pagada</strong> de inmediato
              </label>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Total a pagar</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#15803D' }}>{money(invTotal)}</span>
              </div>
            </div>
            <div style={{ padding: '1.1rem 1.5rem', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', backgroundColor: '#F8FAFC' }}>
              <button onClick={() => setInvoiceForm(null)} disabled={savingInvoice} style={{ padding: '0.6rem 1.1rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#334155', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={saveInvoice} disabled={savingInvoice} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', backgroundColor: '#16A34A', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: savingInvoice ? 'wait' : 'pointer' }}>
                {savingInvoice ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Receipt size={16} />} Crear factura
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ MODAL: EDITAR FACTURA ════════ */}
      {editInvoice && (
        <div style={modalShell}>
          <div style={{ ...modalBox, maxWidth: '560px' }}>
            <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Edit2 size={19} color="#2563EB" /> Editar factura {editInvoice.consecutivo || ''}
              </h3>
              <button onClick={() => setEditInvoice(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '0.3rem' }}><X size={22} /></button>
            </div>
            <div style={{ padding: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
              <div style={{ gridColumn: '1 / -1', padding: '0.8rem 1rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', fontSize: '0.85rem', color: '#334155' }}>
                Agente: <strong>{invoiceAgentName(editInvoice)}</strong> · Subtotal (de las comisiones): <strong>{money(editInvoice.subtotal)}</strong>
              </div>
              <div>
                <label style={label}>Fecha de pago</label>
                <input type="date" style={input} value={editInvoiceForm.date} onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, date: e.target.value })} />
              </div>
              <div>
                <label style={label}>Método de pago</label>
                <input style={input} value={editInvoiceForm.paymentMethod} onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, paymentMethod: e.target.value })} placeholder="Transferencia, cheque..." />
              </div>
              <div>
                <label style={label}>Bono (+)</label>
                <input type="number" step="any" style={input} value={editInvoiceForm.bonus} onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, bonus: e.target.value })} placeholder="$ 0.00" />
              </div>
              <div>
                <label style={label}>Descuento (−)</label>
                <input type="number" step="any" style={input} value={editInvoiceForm.discount} onChange={(e) => setEditInvoiceForm({ ...editInvoiceForm, discount: e.target.value })} placeholder="$ 0.00" />
              </div>
              <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.85rem 1rem', backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#166534', textTransform: 'uppercase' }}>Nuevo total</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 900, color: '#15803D' }}>{money(editInvoiceTotal)}</span>
              </div>
            </div>
            <div style={{ padding: '1.1rem 1.5rem', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', backgroundColor: '#F8FAFC' }}>
              <button onClick={() => setEditInvoice(null)} disabled={savingEditInvoice} style={{ padding: '0.6rem 1.1rem', borderRadius: '8px', border: '1px solid #CBD5E1', backgroundColor: 'white', color: '#334155', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}>Cancelar</button>
              <button onClick={saveEditInvoice} disabled={savingEditInvoice} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1.2rem', borderRadius: '8px', border: 'none', backgroundColor: '#0F172A', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: savingEditInvoice ? 'wait' : 'pointer' }}>
                {savingEditInvoice ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />} Guardar cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ MODAL: DETALLE DE FACTURA (pantalla completa) ════════ */}
      {viewPayment && (
        <div style={{ ...modalShell, padding: '1.5rem' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '16px', width: '96vw', maxWidth: '1400px', height: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>

            {/* Encabezado */}
            <div style={{ padding: '1.35rem 2rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', flexShrink: 0 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.45rem', fontWeight: 800, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '0.6rem', letterSpacing: '-0.01em' }}>
                  <FileText size={26} color="#7C3AED" /> Factura {viewPayment.consecutivo || ''} · {invoiceAgentName(viewPayment)}
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.92rem', color: '#64748B' }}>{fmtDate(viewPayment.date)} · {invoiceCompanyName(viewPayment)}{viewPayment.paymentMethod ? ` · ${invoiceMethod(viewPayment)}` : ''}</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button onClick={() => toggleInvoicePaid(viewPayment)} disabled={togglingInvoice === viewPayment.id} title="Clic para cambiar el estado de la factura" style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', transform: 'scale(1.25)', transformOrigin: 'right center' }}>
                  {paidPill(viewPayment.paid)}
                </button>
                <button onClick={() => setViewPayment(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '0.3rem' }}><X size={26} /></button>
              </div>
            </div>

            {/* Totales (bono y descuento editables) */}
            <div style={{ padding: '1.25rem 2rem 0', flexShrink: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
                <div style={{ padding: '1rem 1.25rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Subtotal</div>
                  <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{money(viewPayment.subtotal)}</div>
                </div>
                <div style={{ padding: '1rem 1.25rem', backgroundColor: '#F8FAFC', border: '1px solid #BFDBFE', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Bono (+)</div>
                  <input type="number" step="any" value={invBonus} onChange={(e) => setInvBonus(e.target.value)} placeholder="0.00"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.35rem 0.5rem', border: '1px solid #BFDBFE', borderRadius: '8px', fontSize: '1.25rem', fontWeight: 800, color: '#2563EB', outline: 'none', backgroundColor: 'white' }} />
                </div>
                <div style={{ padding: '1rem 1.25rem', backgroundColor: '#F8FAFC', border: '1px solid #FECACA', borderRadius: '12px' }}>
                  <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.35rem' }}>Descuento (−)</div>
                  <input type="number" step="any" value={invDiscount} onChange={(e) => setInvDiscount(e.target.value)} placeholder="0.00"
                    style={{ width: '100%', boxSizing: 'border-box', padding: '0.35rem 0.5rem', border: '1px solid #FECACA', borderRadius: '8px', fontSize: '1.25rem', fontWeight: 800, color: '#DC2626', outline: 'none', backgroundColor: 'white' }} />
                </div>
                <div style={{ padding: '1rem 1.25rem', backgroundColor: invAmountsChanged ? '#F0FDF4' : '#F8FAFC', border: `1px solid ${invAmountsChanged ? '#BBF7D0' : '#E2E8F0'}`, borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.25rem' }}>Total</div>
                    <div style={{ fontSize: '1.55rem', fontWeight: 800, color: '#16A34A', lineHeight: 1 }}>{money(invLiveTotal)}</div>
                  </div>
                  {invAmountsChanged && (
                    <button onClick={saveInvAmounts} disabled={savingInvAmounts} style={{ marginTop: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.45rem 0.8rem', borderRadius: '8px', border: 'none', backgroundColor: '#16A34A', color: 'white', fontWeight: 700, fontSize: '0.8rem', cursor: savingInvAmounts ? 'wait' : 'pointer' }}>
                      {savingInvAmounts ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />} Guardar cambios
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Cuerpo: dos columnas que ocupan el resto de la pantalla */}
            <div style={{ flex: 1, minHeight: 0, padding: '1.25rem 2rem 1.5rem', display: 'grid', gridTemplateColumns: 'minmax(420px, 1.25fr) minmax(380px, 1fr)', gap: '1.5rem' }}>

              {/* Columna izquierda: registros incluidos */}
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <h4 style={{ margin: '0 0 0.7rem', fontSize: '0.85rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Registros incluidos · {commissionsOfPayment(viewPayment).length}
                </h4>
                <div style={{ flex: 1, minHeight: 0, border: '1px solid #E2E8F0', borderRadius: '12px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}><tr>
                      <th style={{ ...th, fontSize: '0.72rem', padding: '11px 14px' }}>Work Order</th>
                      <th style={{ ...th, fontSize: '0.72rem', padding: '11px 14px' }}>Compañía</th>
                      <th style={{ ...thR, fontSize: '0.72rem', padding: '11px 14px' }}>Comisión</th>
                    </tr></thead>
                    <tbody>
                      {commissionsOfPayment(viewPayment).length === 0 ? (
                        <tr><td colSpan={3} style={{ ...td, textAlign: 'center', color: '#94A3B8', padding: '2rem', fontStyle: 'italic' }}>No se encontraron los registros de esta factura.</td></tr>
                      ) : commissionsOfPayment(viewPayment).map((c) => (
                        <tr key={c.id}>
                          <td style={{ ...td, padding: '11px 14px' }}><button onClick={(e) => { e.stopPropagation(); openWoDetail(c.workOrderId); }} title="Ver detalle de la work order" style={{ background: 'transparent', border: 'none', padding: 0, color: '#2563EB', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px' }}>{woNumber(c)}</button></td>
                          <td style={{ ...td, color: '#475569', fontSize: '0.9rem', padding: '11px 14px' }}>{companyName(c)}</td>
                          <td style={{ ...tdR, fontWeight: 700, fontSize: '0.9rem', padding: '11px 14px' }}>{money(c.totalCommission)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Columna derecha: agregar pendientes */}
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <h4 style={{ margin: '0 0 0.7rem', fontSize: '0.85rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <PlusCircle size={17} color="#16A34A" /> Agregar pendientes de {invoiceAgentName(viewPayment)} · {addablePending.length}
                </h4>
                {addablePending.length === 0 ? (
                  <div style={{ flex: 1, border: '1px dashed #E2E8F0', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#94A3B8', fontStyle: 'italic' }}>Este agente no tiene comisiones pendientes.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ flex: 1, minHeight: 0, border: '1px solid #E2E8F0', borderRadius: '12px', overflowY: 'auto', marginBottom: '0.9rem' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}><tr>
                          <th style={{ ...th, width: '40px', textAlign: 'center', padding: '11px 10px' }}>
                            <input type="checkbox"
                              checked={addablePending.every((c) => c.id && addSelection.has(c.id)) && addablePending.length > 0}
                              onChange={() => {
                                const all = addablePending.every((c) => c.id && addSelection.has(c.id));
                                setAddSelection(all ? new Set() : new Set(addablePending.map((c) => c.id!)));
                              }}
                              title="Seleccionar todos" style={{ cursor: 'pointer', accentColor: '#16A34A', width: '16px', height: '16px' }} />
                          </th>
                          <th style={{ ...th, fontSize: '0.72rem', padding: '11px 14px' }}>Work Order</th>
                          <th style={{ ...th, fontSize: '0.72rem', padding: '11px 14px' }}>Compañía</th>
                          <th style={{ ...thR, fontSize: '0.72rem', padding: '11px 14px' }}>Comisión</th>
                        </tr></thead>
                        <tbody>
                          {addablePending.map((c) => (
                            <tr key={c.id} onClick={() => setAddSelection((prev) => { const n = new Set(prev); n.has(c.id!) ? n.delete(c.id!) : n.add(c.id!); return n; })} style={{ backgroundColor: c.id && addSelection.has(c.id) ? '#F0FDF4' : 'transparent', cursor: 'pointer' }}>
                              <td style={{ ...td, width: '40px', textAlign: 'center', padding: '11px 10px' }}>
                                <input type="checkbox" checked={!!c.id && addSelection.has(c.id)} onChange={() => {}} style={{ cursor: 'pointer', accentColor: '#16A34A', width: '16px', height: '16px', pointerEvents: 'none' }} />
                              </td>
                              <td style={{ ...td, padding: '11px 14px' }}><button onClick={(e) => { e.stopPropagation(); openWoDetail(c.workOrderId); }} title="Ver detalle de la work order" style={{ background: 'transparent', border: 'none', padding: 0, color: '#2563EB', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '3px' }}>{woNumber(c)}</button></td>
                              <td style={{ ...td, color: '#475569', fontSize: '0.9rem', padding: '11px 14px' }}>{companyName(c)}</td>
                              <td style={{ ...tdR, fontWeight: 700, fontSize: '0.9rem', padding: '11px 14px' }}>{money(c.totalCommission)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                      <span style={{ fontSize: '0.85rem', color: '#475569' }}>
                        {addSelection.size > 0 && <>Seleccionados: <strong style={{ color: '#16A34A' }}>{addSelection.size} · {money(rows.filter((c) => c.id && addSelection.has(c.id)).reduce((s, c) => s + (Number(c.totalCommission) || 0), 0))}</strong></>}
                      </span>
                      <button onClick={handleAddToInvoice} disabled={addSelection.size === 0 || addingToInvoice} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.7rem 1.4rem', borderRadius: '10px', border: 'none', backgroundColor: addSelection.size ? '#16A34A' : '#94A3B8', color: 'white', fontWeight: 700, fontSize: '0.92rem', cursor: addSelection.size && !addingToInvoice ? 'pointer' : 'not-allowed' }}>
                        {addingToInvoice ? <Loader2 size={17} style={{ animation: 'spin 1s linear infinite' }} /> : <PlusCircle size={17} />} Agregar {addSelection.size || ''} a la factura
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ════════ OVERLAY: CARGANDO WORK ORDER ════════ */}
      {loadingWoDetail && (
        <div style={{ ...modalShell, zIndex: 1200 }}>
          <div style={{ backgroundColor: 'white', borderRadius: '14px', padding: '2rem 3rem', textAlign: 'center', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
            <Loader2 size={34} color="#2563EB" style={{ animation: 'spin 1s linear infinite', margin: '0 auto 0.8rem' }} />
            <p style={{ margin: 0, fontWeight: 600, color: '#475569', fontSize: '0.9rem' }}>Cargando work order...</p>
          </div>
        </div>
      )}

      {/* ════════ MODAL: DETALLE DE WORK ORDER ════════ */}
      {woDetail && (() => {
        const t = woTotals(woDetail);
        const n = (v: any) => Number(v) || 0;
        const cliente = woDetail.customerType === 'Existing' ? woDetail.customer : `${woDetail.firstName || ''} ${woDetail.lastName || ''}`.trim();
        const vehiculo = [woDetail.year, woDetail.mark, woDetail.model].filter(Boolean).join(' ');
        const infoRow = (lbl: string, val?: React.ReactNode) => (val || val === 0) ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', fontSize: '0.88rem', padding: '0.35rem 0' }}>
            <span style={{ color: '#64748B' }}>{lbl}</span><span style={{ color: '#0F172A', fontWeight: 600, textAlign: 'right' }}>{val}</span>
          </div>
        ) : null;
        return (
          <div style={{ ...modalShell, zIndex: 1150 }}>
            <div style={{ ...modalBox, maxWidth: '860px', maxHeight: '92vh' }}>
              <div style={{ padding: '1.25rem 1.75rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 800, color: '#0F172A' }}>
                    {(woDetail as any).consecutivo || woDetail.id} <span style={{ fontWeight: 500, color: '#64748B', fontSize: '0.95rem' }}>· {woDetail.documentType === 'Quote' ? 'Cotización' : 'Work Order'}</span>
                  </h3>
                  <p style={{ margin: '3px 0 0', fontSize: '0.82rem', color: '#64748B' }}>{woDetail.appointmentDate || 'Sin fecha'} · {woDetail.type || 'Personal'} · Estado: <strong>{woDetail.status || '—'}</strong></p>
                </div>
                <button onClick={() => setWoDetail(null)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '0.3rem' }}><X size={24} /></button>
              </div>

              <div style={{ padding: '1.5rem 1.75rem' }}>
                {/* Info principal en dos columnas */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.5rem' }}>
                  <div style={{ padding: '1rem 1.2rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cliente</h4>
                    {infoRow('Nombre', cliente || '—')}
                    {infoRow('Teléfono', woDetail.phone)}
                    {infoRow('Compañía', woDetail.company)}
                    {infoRow('Agente', woDetail.agent)}
                    {woDetail.type === 'Insurance' && infoRow('Aseguradora', woDetail.insuranceCarrier)}
                    {woDetail.type === 'Insurance' && infoRow('Póliza', woDetail.policyId)}
                  </div>
                  <div style={{ padding: '1rem 1.2rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '12px' }}>
                    <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.72rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vehículo</h4>
                    {infoRow('Vehículo', vehiculo || '—')}
                    {infoRow('VIN', woDetail.vinNumber && <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', textTransform: 'uppercase' }}>{woDetail.vinNumber}</span>)}
                    {infoRow('Placa', woDetail.plate && <span style={{ textTransform: 'uppercase' }}>{woDetail.plate}</span>)}
                    {infoRow('Hora', woDetail.timeStart ? `${woDetail.timeStart}${woDetail.timeEnd ? ' - ' + woDetail.timeEnd : ''}` : undefined)}
                  </div>
                </div>

                {/* Partes y servicios */}
                <h4 style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Partes y servicios · {(woDetail.parts || []).length}</h4>
                <div style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden', marginBottom: '1.5rem', maxHeight: '220px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ position: 'sticky', top: 0 }}><tr>
                      <th style={th}>Tipo</th><th style={th}>Job Type</th><th style={th}>Parte / Descripción</th><th style={thR}>Monto</th>
                    </tr></thead>
                    <tbody>
                      {(woDetail.parts || []).length === 0 ? (
                        <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: '#94A3B8', padding: '1.5rem', fontStyle: 'italic' }}>Sin partes registradas.</td></tr>
                      ) : (woDetail.parts || []).map((p: any, i: number) => (
                        <tr key={i}>
                          <td style={td}>{p.type === 'Services' ? 'Servicio' : 'Parte'}</td>
                          <td style={{ ...td, color: '#475569' }}>{p.jobtype || '—'}</td>
                          <td style={{ ...td, whiteSpace: 'normal', color: '#475569' }}>{p.partNumber || p.description || '—'}{p.nagsDescription ? ` · ${p.nagsDescription}` : ''}</td>
                          <td style={{ ...tdR, fontWeight: 700 }}>{money(n(p.amount) || n(p.glassCost))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totales de la orden (mismas fórmulas del formulario) */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                  {[
                    ['Partes', n(woDetail.subtotalPart) + n(woDetail.subtotalMolding), '#0F172A'],
                    ['Servicios', n(woDetail.subtotalServices), '#0F172A'],
                    ['Labor', n(woDetail.totalLabor), '#0F172A'],
                    [`Impuestos (${n(woDetail.taxPercent)}%)`, t.tax, '#0F172A'],
                    ['Total', t.total, '#16A34A'],
                    ['Abonado', n(woDetail.paid), '#2563EB'],
                    ['Balance', t.balance, t.balance > 0.005 ? '#DC2626' : '#16A34A'],
                  ].map(([lbl, val, color]) => (
                    <div key={String(lbl)} style={{ padding: '0.7rem 0.9rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px' }}>
                      <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>{String(lbl)}</div>
                      <div style={{ fontSize: '1rem', fontWeight: 800, color: String(color) }}>{money(val)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};