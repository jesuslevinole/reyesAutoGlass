import React, { useState, useEffect, useMemo } from 'react';
import type { WorkOrderData } from '../../types/workOrder';
import { ClipboardList, Car, Plus, Layers, UserCog, CalendarClock, Shield, Settings, Receipt, Trash2, Edit2, X, PhoneCall } from 'lucide-react';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { mygrantApi, type MygrantPart } from '../../services/mygrantApi';
import { vehicleApi } from '../../services/vehicleApi';
import { SearchableInput } from './SearchableInput';

interface Props {
  data: WorkOrderData;
  requiredFields?: Record<string, boolean>;
  onChange: (field: keyof WorkOrderData, value: any) => void;
  onOpenSettings: () => void;
}

export const WorkOrderForm: React.FC<Props> = ({ data, requiredFields = {}, onChange, onOpenSettings }) => {

  const [isAddingPart, setIsAddingPart] = useState(false);
  const [editingPartIndex, setEditingPartIndex] = useState<number | null>(null);

  const [statusOptions, setStatusOptions] = useState<string[]>([]);

  // --- Estados para las colecciones dinámicas (Formulario Principal) ---
  const [companyOptions, setCompanyOptions] = useState<string[]>([]);
  const [agentOptions, setAgentOptions] = useState<string[]>([]);
  const [insuranceOptions, setInsuranceOptions] = useState<string[]>([]);
  const [zipcodeData, setZipcodeData] = useState<{ zipcode: string, longTrip: number }[]>([]);
  const [customerOptions, setCustomerOptions] = useState<string[]>([]);

  // --- Estados para las colecciones dinámicas (Modal de Partes) ---
  const [jobtypeOptions, setJobtypeOptions] = useState<string[]>([]);
  const [partNumberData, setPartNumberData] = useState<{ partNumber: string, nagsDescription: string }[]>([]);
  const [priceTierData, setPriceTierData] = useState<{ priceTier: string, amount: number }[]>([]);
  const [calibrationData, setCalibrationData] = useState<{ name: string, amount: number }[]>([]);

  // --- Estados para Mygrant ---
  const [mygrantParts, setMygrantParts] = useState<MygrantPart[]>([]);
  const [isLoadingParts, setIsLoadingParts] = useState(false);
  const [mygrantError, setMygrantError] = useState<string | null>(null);

  // --- Estados para API de vehículos (NHTSA vPIC) ---
  const [vehicleMakes, setVehicleMakes] = useState<string[]>([]);
  const [vehicleModels, setVehicleModels] = useState<string[]>([]);
  const [vehicleBodyClasses, setVehicleBodyClasses] = useState<string[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [isDecodingVin, setIsDecodingVin] = useState(false);

  // Años disponibles (generados localmente, no requieren API).
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from(
    { length: currentYear + 1 - 1990 + 1 },
    (_, i) => String(currentYear + 1 - i)
  );

  // Banderas de dependencia en cascada: año -> marca -> modelo -> body.
  const yearSelected = !!(data.year && data.year.trim());
  const makeSelected = !!(data.mark && data.mark.trim());
  const modelSelected = !!(data.model && data.model.trim());

  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');

  const [phoneError, setPhoneError] = useState<string>('');

  const initialDraftPart = {
    type: 'Parts' as 'Parts' | 'Services',
    jobtype: '',
    partNumber: '',
    nagsDescription: '',
    glassCost: '',
    hasPriceTier: false,
    priceTierName: '',
    priceTierAmount: '',
    hasCalibration: false,
    calibrationName: '',
    calibrationAmount: '',
    description: '',
    amount: '',
    note: '',
    listPrice: '',
    nagsDiscountRate: '',
    nagsLaborHour: '',
    pricePerHour: ''
  };

  const [draftPart, setDraftPart] = useState<any>(initialDraftPart);

  // 1. Obtener estados (Status)
  useEffect(() => {
    const loadStatuses = async () => {
      try {
        const q = query(collection(db, 'catalog_tag'), where('type', '==', data.documentType));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const options = snapshot.docs.map(doc => doc.data().name || doc.data().value || doc.id);
          setStatusOptions(options);

          if (!options.includes(data.status)) {
            onChange('status', options[0]);
          }
        } else {
          setStatusOptions([]);
          if (data.status !== '') {
            onChange('status', '');
          }
        }
      } catch (error) {
        console.error("Error al cargar los Status desde catalog_tag:", error);
        setStatusOptions([]);
        onChange('status', '');
      }
    };

    if (data.documentType) {
      loadStatuses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.documentType]);

  // 2. Obtener Compañías
  useEffect(() => {
    const loadCompanies = async () => {
      try {
        const q = query(collection(db, 'catalog_company'));
        const snapshot = await getDocs(q);
        const options = snapshot.docs.map(doc => doc.data().name || doc.data().value || doc.id);
        setCompanyOptions(options);
      } catch (error) {
        console.error("Error al cargar catalog_company:", error);
      }
    };
    loadCompanies();
  }, []);

  // 3. Obtener Agentes
  useEffect(() => {
    const loadAgents = async () => {
      if (!data.company || data.company.trim() === '') {
        setAgentOptions([]);
        return;
      }
      try {
        const q = query(
          collection(db, 'team'),
          where('type', '==', 'Agent'),
          where('company', '==', data.company)
        );
        const snapshot = await getDocs(q);
        const agents = snapshot.docs.map(doc => {
          const d = doc.data();
          return `${d.firstName || ''} ${d.lastName || ''}`.trim();
        });
        setAgentOptions(agents.filter(Boolean));
      } catch (error) {
        console.error("Error al cargar agentes de la colección team:", error);
      }
    };

    loadAgents();
  }, [data.company]);

  // 4. Obtener Aseguradoras (Insurance Carriers)
  useEffect(() => {
    const loadInsurances = async () => {
      try {
        const q = query(collection(db, 'catalog_insurance'));
        const snapshot = await getDocs(q);
        const insurances = snapshot.docs.map(doc => doc.data().insurance_carrier);
        setInsuranceOptions(insurances.filter(Boolean));
      } catch (error) {
        console.error("Error al cargar catalog_insurance:", error);
      }
    };
    loadInsurances();
  }, []);

  // 5. Obtener Zipcodes y sus Long Trips
  useEffect(() => {
    const loadZipcodes = async () => {
      try {
        const q = query(collection(db, 'catalog_zipcode'));
        const snapshot = await getDocs(q);
        const zips = snapshot.docs.map(doc => ({
          zipcode: doc.data().zipcode || '',
          longTrip: Number(doc.data().long_trip) || 0
        }));
        setZipcodeData(zips);
      } catch (error) {
        console.error("Error al cargar catalog_zipcode:", error);
      }
    };
    loadZipcodes();
  }, []);

  // 6. Obtener Clientes para el buscador
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        const q = query(collection(db, 'customers'));
        const snapshot = await getDocs(q);
        const customers = snapshot.docs.map(doc => {
          const d = doc.data();
          return `${d.firstName || ''} ${d.lastName || ''}`.trim();
        });
        setCustomerOptions(customers.filter(Boolean));
      } catch (error) {
        console.error("Error al cargar clientes:", error);
      }
    };
    loadCustomers();
  }, []);

  // --- CONSULTAS PARA EL MODAL DE PARTES ---

  // 7. Obtener Jobtypes dependientes del tipo de Work Order (Personal o Insurance)
  useEffect(() => {
    const loadJobtypes = async () => {
      if (!data.type) {
        setJobtypeOptions([]);
        return;
      }
      try {
        const q = query(collection(db, 'catalog_jobtype'), where('type', '==', data.type));
        const snapshot = await getDocs(q);
        const types = snapshot.docs.map(doc => doc.data().name);
        setJobtypeOptions(types.filter(Boolean));
      } catch (error) {
        console.error("Error al cargar catalog_jobtype:", error);
      }
    };
    loadJobtypes();
  }, [data.type]);

  // 8. Obtener Part Numbers y sus Nags Descriptions
  useEffect(() => {
    const loadParts = async () => {
      try {
        const q = query(collection(db, 'catalog_part_number'));
        const snapshot = await getDocs(q);
        const parts = snapshot.docs.map(doc => ({
          partNumber: doc.data().part_number || '',
          nagsDescription: doc.data().nags_description || ''
        }));
        setPartNumberData(parts.filter(p => p.partNumber));
      } catch (error) {
        console.error("Error al cargar catalog_part_number:", error);
      }
    };
    loadParts();
  }, []);

  // 9. Obtener Price Tiers
  useEffect(() => {
    const loadPriceTiers = async () => {
      try {
        const q = query(collection(db, 'catalog_price_tier'));
        const snapshot = await getDocs(q);
        const tiers = snapshot.docs.map(doc => ({
          priceTier: doc.data().price_tier || '',
          amount: Number(doc.data().amount) || 0
        }));
        setPriceTierData(tiers.filter(t => t.priceTier));
      } catch (error) {
        console.error("Error al cargar catalog_price_tier:", error);
      }
    };
    loadPriceTiers();
  }, []);

  // 10. Obtener Calibraciones
  useEffect(() => {
    const loadCalibrations = async () => {
      try {
        const q = query(collection(db, 'catalog_calibration_type'));
        const snapshot = await getDocs(q);
        const calibs = snapshot.docs.map(doc => ({
          name: doc.data().name || '',
          amount: Number(doc.data().amount) || 0
        }));
        setCalibrationData(calibs.filter(c => c.name));
      } catch (error) {
        console.error("Error al cargar catalog_calibration_type:", error);
      }
    };
    loadCalibrations();
  }, []);

  // 11. Cargar partes desde la API de Mygrant según el vehículo
  useEffect(() => {
    const fetchMygrantParts = async () => {
      if (
        data.year && data.mark && data.model &&
        data.year.trim() !== '' && data.mark.trim() !== '' && data.model.trim() !== ''
      ) {
        setIsLoadingParts(true);
        setMygrantError(null);

        try {
          const partsResult = await mygrantApi.getPartsByVehicle(
            data.year,
            data.mark,
            data.model
          );

          setMygrantParts(partsResult);

          setPartNumberData((prevData) => {
            const existingPartNumbers = new Set(prevData.map(p => p.partNumber));
            const newPartsFromMygrant = partsResult
              .filter(p => !existingPartNumbers.has(p.partNumber))
              .map(p => ({
                partNumber: p.partNumber,
                nagsDescription: p.nagsDescription
              }));
            return [...prevData, ...newPartsFromMygrant];
          });
        } catch (error) {
          console.error('Error fetching Mygrant parts:', error);
          setMygrantError('No se pudieron cargar las partes de Mygrant para este vehículo.');
        } finally {
          setIsLoadingParts(false);
        }
      }
    };

    fetchMygrantParts();
  }, [data.year, data.mark, data.model]);

  // 12. Cargar marcas y body classes desde la API (NHTSA vPIC) al iniciar.
  useEffect(() => {
    vehicleApi.getMakes().then(setVehicleMakes).catch(() => setVehicleMakes([]));
    vehicleApi.getBodyClasses().then(setVehicleBodyClasses).catch(() => setVehicleBodyClasses([]));
  }, []);

  // 13. Cargar modelos (filtrados por marca + año) para la búsqueda de Modelo.
  useEffect(() => {
    if (data.mark && data.mark.trim()) {
      setIsLoadingModels(true);
      vehicleApi.getModels(data.mark, data.year)
        .then(setVehicleModels)
        .catch(() => setVehicleModels([]))
        .finally(() => setIsLoadingModels(false));
    } else {
      setVehicleModels([]);
    }
  }, [data.mark, data.year]);

  useEffect(() => {
    if (!data.date) {
      const today = new Date().toISOString().split('T')[0];
      onChange('date', today);
    }
  }, [data.date, onChange]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onChange(name as keyof WorkOrderData, value);
  };

  // --- LÓGICAS DE DEPENDENCIA EN CASCADA DEL VEHÍCULO ---
  // Año -> Marca -> Modelo -> Body. Al cambiar un nivel se limpian los inferiores.
  const handleYearChange = (val: string) => {
    onChange('year', val);
    onChange('mark', '');
    onChange('model', '');
    onChange('body', '');
  };

  const handleMakeChange = (val: string) => {
    onChange('mark', val);
    onChange('model', '');
    onChange('body', '');
  };

  const handleModelChange = (val: string) => {
    onChange('model', val);
    onChange('body', '');
  };

  // --- LÓGICAS DEL FORMULARIO PRINCIPAL ---
  const handleCustomerTypeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const type = e.target.value;
    onChange('customerType', type);
    onChange('customer', '');
    onChange('firstName', '');
    onChange('lastName', '');
    onChange('phone', '');
    onChange('altPhone', '');
    onChange('email', '');
    onChange('address', '');
    setPhoneError('');
  };

  const handleCustomerBlur = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val && !customerOptions.includes(val)) {
      alert("Por favor, seleccione un cliente válido de la lista sugerida. No se permiten nombres inventados.");
      onChange('customer', '');
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;

    if (cleaned.length > 0) {
      if (cleaned.length < 4) {
        formatted = `(${cleaned}`;
      } else if (cleaned.length < 7) {
        formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
      } else {
        formatted = `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
      }
    }

    onChange(name as keyof WorkOrderData, formatted);
    if (name === 'phone') setPhoneError('');
  };

  const handlePhoneBlur = async () => {
    if (data.customerType === 'New' && data.phone && data.phone.replace(/\D/g, '').length >= 10) {
      try {
        const q = query(collection(db, 'customers'), where('phone', '==', data.phone));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
          setPhoneError('Este teléfono ya pertenece a un cliente registrado.');
        }
      } catch (error) {
        console.error("Error al validar teléfono:", error);
      }
    }
  };

  const handleZipcodeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedZip = e.target.value;
    onChange('zipcode', selectedZip);
    const found = zipcodeData.find(z => z.zipcode === selectedZip);
    onChange('longTrip', found ? found.longTrip : 0);
  };

  // Al salir del campo VIN, decodifica y autocompleta año/marca/modelo/carrocería.
  const handleVinBlur = async () => {
    const vin = (data.vinNumber || '').trim();
    if (vin.length !== 17) return;
    setIsDecodingVin(true);
    try {
      const info = await vehicleApi.decodeVin(vin);
      if (info.year) onChange('year', info.year);
      if (info.make) onChange('mark', info.make);
      if (info.model) onChange('model', info.model);
      if (info.body) onChange('body', info.body);
    } catch (error) {
      console.error('Error decodificando el VIN:', error);
    } finally {
      setIsDecodingVin(false);
    }
  };

  // --- LÓGICAS DEL MODAL DE PARTES Y SERVICIOS ---
  const handleDraftChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setDraftPart((prev: any) => ({ ...prev, [name]: value }));
  };

  const handlePartNumberChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const local = partNumberData.find(p => p.partNumber === val);
    const mygrant = mygrantParts.find(p => p.partNumber === val);

    setDraftPart((prev: any) => ({
      ...prev,
      partNumber: val,
      nagsDescription: local?.nagsDescription || mygrant?.nagsDescription || '',
      listPrice: mygrant?.listPrice || prev.listPrice || '',
      glassCost: mygrant?.listPrice || prev.glassCost || ''
    }));
  };

  const handlePriceTierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const found = priceTierData.find(p => p.priceTier === val);
    setDraftPart((prev: any) => ({
      ...prev,
      priceTierName: val,
      priceTierAmount: found ? found.amount : ''
    }));
  };

  const handleCalibrationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    const found = calibrationData.find(c => c.name === val);
    setDraftPart((prev: any) => ({
      ...prev,
      calibrationName: val,
      calibrationAmount: found ? found.amount : ''
    }));
  };

  const toggleDraftBoolean = (field: 'hasPriceTier' | 'hasCalibration', value: boolean) => {
    setDraftPart((prev: any) => ({ ...prev, [field]: value }));
  };

  const updatePartsAndTotals = (newParts: any[]) => {
    const newSubtotalParts = newParts.reduce((sum: number, p: any) => p.type === 'Parts' ? sum + (Number(p.glassCost) || 0) : sum, 0);
    const newSubtotalServices = newParts.reduce((sum: number, p: any) => p.type === 'Services' ? sum + (Number(p.amount) || 0) : sum, 0);
    const newTotalLabor = newParts.reduce((sum: number, p: any) => {
      if (p.type === 'Parts') {
        return sum + (p.hasPriceTier ? (Number(p.priceTierAmount) || 0) : 0) + (p.hasCalibration ? (Number(p.calibrationAmount) || 0) : 0);
      }
      return sum;
    }, 0);

    onChange('parts', newParts);
    onChange('subtotalPart', newSubtotalParts);
    onChange('subtotalServices', newSubtotalServices);
    onChange('totalLabor', newTotalLabor);
  };

  const savePart = () => {
    const currentParts = data.parts || [];
    let newParts;

    if (editingPartIndex !== null) {
      newParts = [...currentParts];
      newParts[editingPartIndex] = draftPart;
    } else {
      newParts = [...currentParts, draftPart];
    }

    updatePartsAndTotals(newParts);
    setIsAddingPart(false);
    setEditingPartIndex(null);
    setDraftPart(initialDraftPart);
  };

  const removePart = (index: number) => {
    const currentParts = data.parts || [];
    const newParts = currentParts.filter((_: any, i: number) => i !== index);
    updatePartsAndTotals(newParts);
  };

  const editPart = (index: number) => {
    setDraftPart(data.parts![index] as any);
    setEditingPartIndex(index);
    setIsAddingPart(true);
  };

  const cancelPart = () => {
    setIsAddingPart(false);
    setEditingPartIndex(null);
    setDraftPart(initialDraftPart);
  };

  const saveNewCompany = async () => {
    if (!newCompanyName.trim()) return;
    try {
      await addDoc(collection(db, 'catalog_company'), { name: newCompanyName.trim() });
      setCompanyOptions(prev => [...prev, newCompanyName.trim()]);
      onChange('company', newCompanyName.trim());
      setIsAddingCompany(false);
      setNewCompanyName('');
    } catch (error) {
      console.error("Error al guardar la compañía:", error);
      alert("Hubo un error al guardar la compañía.");
    }
  };

  const FieldLabel = ({ text, fieldKey }: { text: string, fieldKey: string }) => (
    <label className="form-label" style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.3rem' }}>
      {text} {requiredFields?.[fieldKey] && <span style={{ color: '#EF4444', marginLeft: '2px' }}>*</span>}
    </label>
  );

  const subPart = Number(data.subtotalPart) || 0;
  const subMolding = Number(data.subtotalMolding) || 0;
  const subServices = Number(data.subtotalServices) || 0;
  const totLabor = Number(data.totalLabor) || 0;
  const taxPct = Number(data.taxPercent) || 0;
  const upsell = Number(data.upsell) || 0;
  const kitFlat = Number(data.kitFlatRate) || 0;
  const paidAmt = Number(data.paid) || 0;

  const calculatedTax = (subPart + subMolding) * (taxPct / 100);
  const calculatedTotal = subPart + subMolding + subServices + totLabor + upsell + kitFlat + calculatedTax;
  const calculatedBalance = calculatedTotal - paidAmt;

  const draftTotalLabor = (draftPart.hasPriceTier ? (Number(draftPart.priceTierAmount) || 0) : 0) + (draftPart.hasCalibration ? (Number(draftPart.calibrationAmount) || 0) : 0);
  const draftListPrice = Number(draftPart.listPrice) || 0;
  const draftNagsDiscountRate = Number(draftPart.nagsDiscountRate) || 0;
  const draftPricePartInsurance = draftListPrice - (draftListPrice * (draftNagsDiscountRate / 100));
  const draftNagsLaborHour = Number(draftPart.nagsLaborHour) || 0;
  const draftPricePerHour = Number(draftPart.pricePerHour) || 0;
  const draftTotalLaborHour = draftNagsLaborHour * draftPricePerHour;

  const fechaReporte = useMemo(() => {
    const opciones: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('es-ES', opciones);
  }, []);

  return (
    <>
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 15mm; }
          body, .animate-in { background-color: #ffffff !important; color: #000000 !important; font-size: 10pt !important; display: block !important; overflow: visible !important; }
          .no-print { display: none !important; }
          .print-only { display: flex !important; }
          .form-grid { display: grid !important; grid-template-columns: repeat(2, 1fr) !important; gap: 15px !important; }
          .card { border: none !important; box-shadow: none !important; padding: 0 !important; margin-bottom: 2rem !important; page-break-inside: avoid !important; break-inside: avoid !important; }
          .lucide { display: none !important; }
          .print-header-report { display: flex !important; justify-content: space-between !important; align-items: flex-end !important; border-bottom: 3px solid #1d8cf8 !important; padding-bottom: 15px !important; margin-bottom: 25px !important; }
          .print-header-report h1 { margin: 0 !important; font-size: 22pt !important; color: #0f172a !important; }
          .print-header-report p { margin: 5px 0 0 0 !important; color: #64748b !important; font-size: 11pt !important; }
          .form-input, .form-select, .input-addon-btn, .segmented-control { border: none !important; background: transparent !important; padding: 0 !important; font-weight: 600 !important; color: #000 !important; box-shadow: none !important; -webkit-appearance: none; -moz-appearance: none; appearance: none; }
          .form-label { font-weight: bold !important; color: #475569 !important; border-bottom: 1px solid #e2e8f0; display: block; padding-bottom: 2px; }
          .input-group { border: none !important; display: flex !important; gap: 4px !important; }
          .segmented-item { display: none !important; }
          .segmented-item.active { display: block !important; padding: 0 !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th { border-bottom: 2px solid #000 !important; text-align: left !important; padding: 8px 0 !important; color: #000 !important; }
          td { border-bottom: 1px solid #e2e8f0 !important; padding: 8px 0 !important; }
          .print-section-title { font-size: 14pt !important; font-weight: bold !important; color: #000 !important; border-bottom: 1px solid #000 !important; margin-bottom: 15px !important; text-transform: uppercase !important; }
          .print-hide-container { display: none !important; }
        }
        .print-only { display: none; }
      `}</style>

      <div className="animate-in fade-in" style={{ flex: 1, overflowY: 'auto', padding: '3rem 1.5rem', backgroundColor: '#F8FAFC' }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>

          <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3rem' }}>
            <div>
              <h2 style={{ fontSize: '2rem', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.03em', margin: 0 }}>
                {data.id
                  ? `${data.documentType === 'Quote' ? 'Quote' : 'Work Order'} #${data.id}`
                  : `Nueva ${data.documentType === 'Quote' ? 'Quote' : 'Work Order'}`
                }
              </h2>
              <p style={{ color: '#64748B', marginTop: '0.4rem', fontSize: '1rem' }}>
                Complete la información del servicio con precisión.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                type="button"
                onClick={onOpenSettings}
                title="Configurar Campos"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1rem', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '8px', color: '#475569', fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s' }}
                onMouseOver={e => e.currentTarget.style.backgroundColor = '#F1F5F9'}
                onMouseOut={e => e.currentTarget.style.backgroundColor = 'white'}
              >
                <Settings size={18} /> Ajustes
              </button>
            </div>
          </div>

          <div className="print-only print-header-report">
            <div>
              <h1>{data.documentType === 'Quote' ? 'Quote' : 'Work Order'}</h1>
              <p>Referencia: #{data.id || 'N/A'} | Tipo: {data.type || 'N/A'}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p>Maracaibo, Zulia</p>
              <p>{fechaReporte}</p>
            </div>
          </div>

          <div className="card" style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: '2rem', marginBottom: '2.5rem' }}>
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '2px solid #F1F5F9' }}>
              <div style={{ padding: '0.5rem', backgroundColor: '#EFF6FF', borderRadius: '8px', color: '#2563EB' }}>
                <ClipboardList size={22} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#1E293B' }}>Configuración Inicial</h3>
            </div>

            <div className="form-grid">
              <div className="form-group print-hide-container" style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '1.5rem', backgroundColor: '#F8FAFC', padding: '1.5rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <div style={{ display: 'flex', gap: '2rem' }}>
                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Documento</label>
                    <div className="segmented-control" style={{ width: '100%' }}>
                      <label className={`segmented-item ${data.documentType === 'Quote' ? 'active' : ''}`} style={{ flex: 1, textAlign: 'center' }}><input type="radio" name="documentType" value="Quote" checked={data.documentType === 'Quote'} onChange={handleChange} style={{ display: 'none' }} />Quote</label>
                      <label className={`segmented-item ${data.documentType === 'Work Order' ? 'active' : ''}`} style={{ flex: 1, textAlign: 'center' }}><input type="radio" name="documentType" value="Work Order" checked={data.documentType === 'Work Order'} onChange={handleChange} style={{ display: 'none' }} />Work Order</label>
                    </div>
                  </div>

                  <div style={{ flex: 1 }}>
                    <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Tipo de Pago</label>
                    <div className="segmented-control" style={{ width: '100%' }}>
                      <label className={`segmented-item ${data.type === 'Personal' ? 'active' : ''}`} style={{ flex: 1, textAlign: 'center' }}><input type="radio" name="type" value="Personal" checked={data.type === 'Personal'} onChange={handleChange} style={{ display: 'none' }} />Personal</label>
                      <label className={`segmented-item ${data.type === 'Insurance' ? 'active' : ''}`} style={{ flex: 1, textAlign: 'center' }}><input type="radio" name="type" value="Insurance" checked={data.type === 'Insurance'} onChange={handleChange} style={{ display: 'none' }} />Insurance</label>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>
                    <PhoneCall size={14} /> Dirección Llamada
                  </label>
                  <div className="segmented-control" style={{ width: '100%', maxWidth: '400px' }}>
                    <label className={`segmented-item ${data.callDirection === 'IN' ? 'active' : ''}`} style={{ flex: 1, textAlign: 'center' }}><input type="radio" name="callDirection" value="IN" checked={data.callDirection === 'IN'} onChange={handleChange} style={{ display: 'none' }} />IN</label>
                    <label className={`segmented-item ${data.callDirection === 'OUT' ? 'active' : ''}`} style={{ flex: 1, textAlign: 'center' }}><input type="radio" name="callDirection" value="OUT" checked={data.callDirection === 'OUT'} onChange={handleChange} style={{ display: 'none' }} />OUT</label>
                  </div>
                </div>
              </div>

              <div className="form-group">
                <FieldLabel text="Fecha de Creación" fieldKey="date" />
                <input type="date" className="form-input" name="date" value={data.date} onChange={handleChange} required={requiredFields?.date} />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.3rem' }}>Estado (Status)</label>
                <select
                  className="form-select"
                  name="status"
                  value={data.status || ''}
                  onChange={handleChange}
                  required
                  style={{ fontWeight: 500 }}
                  disabled={statusOptions.length === 0}
                >
                  {statusOptions.length === 0 ? (
                    <option value="">Sin estados configurados</option>
                  ) : (
                    statusOptions.map((statusName: string, idx: number) => (
                      <option key={idx} value={statusName}>{statusName}</option>
                    ))
                  )}
                </select>
              </div>

              <div className="form-group">
                <FieldLabel text="Compañía" fieldKey="company" />
                <div className="input-group">
                  <select
                    className="form-select"
                    name="company"
                    value={data.company || ''}
                    onChange={handleChange}
                    required={requiredFields?.company}
                  >
                    <option value="">Seleccione compañía...</option>
                    {companyOptions.map((comp: string, idx: number) => (
                      <option key={idx} value={comp}>{comp}</option>
                    ))}
                  </select>
                  <button type="button" className="input-addon-btn no-print" onClick={() => setIsAddingCompany(true)} title="Agregar Compañía Nueva">
                    <Plus size={18} />
                  </button>
                </div>
              </div>

              {data.company && data.company.trim() !== '' && (
                <div className="form-group">
                  <FieldLabel text="Agente" fieldKey="agent" />
                  <div className="input-group">
                    <select
                      className="form-select"
                      name="agent"
                      value={data.agent || ''}
                      onChange={handleChange}
                      required={requiredFields?.agent}
                    >
                      <option value="">Seleccione agente...</option>
                      {agentOptions.map((ag, idx) => (
                        <option key={idx} value={ag}>{ag}</option>
                      ))}
                    </select>
                    <button type="button" className="input-addon-btn no-print"><Plus size={18} /></button>
                  </div>
                </div>
              )}

              <div className="form-group">
                <FieldLabel text="Código Postal (Zip Code)" fieldKey="zipcode" />
                <div className="input-group">
                  <select
                    className="form-select"
                    name="zipcode"
                    value={data.zipcode || ''}
                    onChange={handleZipcodeChange}
                    required={requiredFields?.zipcode}
                  >
                    <option value="">Seleccione...</option>
                    {zipcodeData.map((z, idx) => (
                      <option key={idx} value={z.zipcode}>{z.zipcode}</option>
                    ))}
                  </select>
                  <button type="button" className="input-addon-btn no-print"><Plus size={18} /></button>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ color: '#475569', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.02em', marginBottom: '0.3rem' }}>Viaje Largo (Long Trip)</label>
                <input type="number" step="any" className="form-input" name="longTrip" value={data.longTrip || ''} onChange={handleChange} placeholder="Calculado automáticamente" />
              </div>
            </div>
          </div>

          {data.type === 'Insurance' && (
            <div className="card" style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', borderLeft: '4px solid #8B5CF6', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: '2rem', marginBottom: '2.5rem' }}>
              <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '2px solid #F1F5F9' }}>
                <div style={{ padding: '0.5rem', backgroundColor: '#F5F3FF', borderRadius: '8px', color: '#8B5CF6' }}>
                  <Shield size={22} />
                </div>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#1E293B' }}>Detalles del Seguro</h3>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <FieldLabel text="Aseguradora (Carrier)" fieldKey="insuranceCarrier" />
                  <select
                    className="form-select"
                    name="insuranceCarrier"
                    value={data.insuranceCarrier || ''}
                    onChange={handleChange}
                    required={requiredFields?.insuranceCarrier}
                  >
                    <option value="">Seleccione aseguradora...</option>
                    {insuranceOptions.map((ins, idx) => (
                      <option key={idx} value={ins}>{ins}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group"><FieldLabel text="Número de Póliza" fieldKey="policyId" /><input type="text" className="form-input" name="policyId" value={data.policyId} onChange={handleChange} required={requiredFields?.policyId} /></div>
                <div className="form-group"><FieldLabel text="Referencia (Referral)" fieldKey="referral" /><input type="text" className="form-input" name="referral" value={data.referral} onChange={handleChange} required={requiredFields?.referral} /></div>
                <div className="form-group"><FieldLabel text="Titular de la Póliza" fieldKey="policyHolder" /><input type="text" className="form-input" name="policyHolder" value={data.policyHolder} onChange={handleChange} required={requiredFields?.policyHolder} /></div>
                <div className="form-group form-grid-full"><FieldLabel text="Dirección de la Póliza" fieldKey="policyAddress" /><input type="text" className="form-input" name="policyAddress" value={data.policyAddress} onChange={handleChange} required={requiredFields?.policyAddress} /></div>
              </div>
            </div>
          )}

          <div className="card" style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: '2rem', marginBottom: '2.5rem' }}>
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '2px solid #F1F5F9' }}>
              <div style={{ padding: '0.5rem', backgroundColor: '#ECFCCB', borderRadius: '8px', color: '#CA8A04' }}>
                <UserCog size={22} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#1E293B' }}>Información del Cliente</h3>
            </div>

            <div className="no-print" style={{ marginBottom: '2rem', backgroundColor: '#F8FAFC', padding: '1.5rem', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
              <label className="form-label" style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem', fontWeight: 600, color: '#475569', textTransform: 'uppercase' }}>Tipo de Cliente</label>
              <div className="segmented-control">
                <label className={`segmented-item ${data.customerType === 'Existing' ? 'active' : ''}`}><input type="radio" name="customerType" value="Existing" checked={data.customerType === 'Existing'} onChange={handleCustomerTypeChange} style={{ display: 'none' }} /> Cliente Existente</label>
                <label className={`segmented-item ${data.customerType === 'New' ? 'active' : ''}`}><input type="radio" name="customerType" value="New" checked={data.customerType === 'New'} onChange={handleCustomerTypeChange} style={{ display: 'none' }} /> Cliente Nuevo</label>
              </div>
            </div>

            {data.customerType === 'Existing' ? (
              <div className="form-group form-grid-full" style={{ marginBottom: '2rem' }}>
                <FieldLabel text="Buscar Cliente" fieldKey="customer" />
                <div className="input-group">
                  <input
                    type="text"
                    list="customer-options"
                    className="form-input"
                    name="customer"
                    value={data.customer || ''}
                    onChange={handleChange}
                    onBlur={handleCustomerBlur}
                    placeholder="Escriba para buscar un cliente..."
                    required={requiredFields?.customer}
                    style={{ padding: '0.8rem' }}
                  />
                  <datalist id="customer-options">
                    {customerOptions.map((cust, idx) => (
                      <option key={idx} value={cust} />
                    ))}
                  </datalist>
                </div>
              </div>
            ) : (
              <div className="form-grid" style={{ marginBottom: '2rem' }}>
                <div className="form-group"><FieldLabel text="Nombre (First Name)" fieldKey="firstName" /><input type="text" className="form-input" name="firstName" value={data.firstName} onChange={handleChange} required={requiredFields?.firstName} /></div>
                <div className="form-group"><FieldLabel text="Apellido (Last Name)" fieldKey="lastName" /><input type="text" className="form-input" name="lastName" value={data.lastName} onChange={handleChange} required={requiredFields?.lastName} /></div>
                <div className="form-group">
                  <FieldLabel text="Teléfono Principal" fieldKey="phone" />
                  <input type="tel" className="form-input" name="phone" value={data.phone} onChange={handlePhoneChange} onBlur={handlePhoneBlur} placeholder="(XXX) XXX-XXXX" maxLength={14} required={requiredFields?.phone} />
                  {phoneError && <span style={{ color: '#EF4444', fontSize: '0.75rem', marginTop: '0.3rem', display: 'block', fontWeight: 500 }}>{phoneError}</span>}
                </div>
                <div className="form-group"><FieldLabel text="Teléfono Alternativo" fieldKey="altPhone" /><input type="tel" className="form-input" name="altPhone" value={data.altPhone} onChange={handlePhoneChange} placeholder="(XXX) XXX-XXXX" maxLength={14} /></div>
                <div className="form-group form-grid-full"><FieldLabel text="Correo Electrónico" fieldKey="email" /><input type="email" className="form-input" name="email" value={data.email} onChange={handleChange} /></div>
                <div className="form-group form-grid-full"><FieldLabel text="Dirección Completa" fieldKey="address" /><input type="text" className="form-input" name="address" value={data.address} onChange={handleChange} /></div>
              </div>
            )}

            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem', paddingTop: '1.5rem', borderTop: '2px solid #F1F5F9' }}>
              <CalendarClock size={20} color="#64748B" />
              <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#334155' }}>Agendamiento</h4>
            </div>

            <div className="form-grid">
              <div className="form-group form-grid-full"><FieldLabel text="Fecha de Cita" fieldKey="appointmentDate" /><input type="date" className="form-input" name="appointmentDate" value={data.appointmentDate} onChange={handleChange} required={requiredFields?.appointmentDate} /></div>
              <div className="form-group"><FieldLabel text="Hora de Inicio" fieldKey="timeStart" /><input type="time" className="form-input" name="timeStart" value={data.timeStart} onChange={handleChange} required={requiredFields?.timeStart} /></div>
              <div className="form-group"><FieldLabel text="Hora de Fin" fieldKey="timeEnd" /><input type="time" className="form-input" name="timeEnd" value={data.timeEnd} onChange={handleChange} required={requiredFields?.timeEnd} /></div>
            </div>
          </div>

          <div className="card" style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: '2rem', marginBottom: '2.5rem' }}>
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '2px solid #F1F5F9' }}>
              <div style={{ padding: '0.5rem', backgroundColor: '#FEF2F2', borderRadius: '8px', color: '#EF4444' }}>
                <Car size={22} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#1E293B' }}>Vehículo y Trabajos</h3>
            </div>

            <div className="form-grid" style={{ marginBottom: '2rem' }}>
              <div className="form-group">
                <FieldLabel text="Año" fieldKey="year" />
                <SearchableInput
                  value={data.year || ''}
                  onChange={handleYearChange}
                  options={yearOptions}
                  placeholder="Buscar año..."
                  required={requiredFields?.year}
                />
              </div>

              <div className="form-group">
                <FieldLabel text="Marca" fieldKey="mark" />
                <SearchableInput
                  value={data.mark || ''}
                  onChange={handleMakeChange}
                  options={vehicleMakes}
                  placeholder="Buscar marca..."
                  disabled={!yearSelected}
                  disabledMessage="Seleccione primero el año"
                  required={requiredFields?.mark}
                />
              </div>

              <div className="form-group">
                <FieldLabel text="Modelo" fieldKey="model" />
                <SearchableInput
                  value={data.model || ''}
                  onChange={handleModelChange}
                  options={vehicleModels}
                  placeholder="Buscar modelo..."
                  disabled={!makeSelected}
                  disabledMessage="Seleccione primero la marca"
                  loading={isLoadingModels}
                  required={requiredFields?.model}
                />
              </div>

              <div className="form-group">
                <FieldLabel text="Carrocería (Body)" fieldKey="body" />
                <SearchableInput
                  value={data.body || ''}
                  onChange={(v) => onChange('body', v)}
                  options={vehicleBodyClasses}
                  placeholder="Buscar carrocería..."
                  disabled={!modelSelected}
                  disabledMessage="Seleccione primero el modelo"
                  required={requiredFields?.body}
                />
              </div>

              <div className="form-group form-grid-full">
                <FieldLabel text="Número VIN" fieldKey="vinNumber" />
                <input type="text" className="form-input" name="vinNumber" value={data.vinNumber} onChange={handleChange} onBlur={handleVinBlur} style={{ textTransform: 'uppercase', fontFamily: 'monospace', letterSpacing: '1px' }} placeholder="17 caracteres (autocompleta el vehículo)" maxLength={17} required={requiredFields?.vinNumber} />
                {isDecodingVin && (
                  <span style={{ color: '#3B82F6', fontSize: '0.75rem', marginTop: '0.3rem', display: 'block', fontWeight: 500 }}>
                    Decodificando VIN...
                  </span>
                )}
              </div>

              <div className="form-group form-grid-full"><FieldLabel text="Matrícula (Plate)" fieldKey="plate" /><input type="text" className="form-input" name="plate" value={data.plate} onChange={handleChange} style={{ textTransform: 'uppercase' }} placeholder="ABC-1234" required={requiredFields?.plate} /></div>
            </div>

            <div className="no-print">
              {isLoadingParts && (
                <p style={{ color: '#3B82F6', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 500 }}>
                  Buscando catálogo de partes en Mygrant para este vehículo...
                </p>
              )}
              {mygrantError && (
                <p style={{ color: '#EF4444', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 500 }}>
                  {mygrantError}
                </p>
              )}
              {!isLoadingParts && !mygrantError && mygrantParts.length > 0 && (
                <p style={{ color: '#059669', marginBottom: '1rem', fontSize: '0.85rem', fontWeight: 500 }}>
                  {mygrantParts.length} parte(s) cargada(s) desde Mygrant. Disponibles en el selector de Part Number.
                </p>
              )}
            </div>

            <div className="no-print" style={{ padding: '1.5rem', border: '1px dashed #CBD5E1', borderRadius: '12px', backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Layers size={18} color="#64748B" /> Partes y Servicios
                  </h4>
                  <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: '#94A3B8' }}>Agregue los vidrios o trabajos requeridos para este vehículo.</p>
                </div>
                {data.parts && data.parts.length > 0 && (
                  <button type="button" className="btn btn-primary" style={{ padding: '0.5rem 1rem' }} onClick={() => setIsAddingPart(true)}>
                    <Plus size={16} /> Añadir Ítem
                  </button>
                )}
              </div>

              {data.parts && data.parts.length > 0 ? (
                <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid #E2E8F0', backgroundColor: 'white' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead style={{ backgroundColor: '#F1F5F9', borderBottom: '2px solid #E2E8F0' }}>
                      <tr>
                        <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Tipo</th>
                        <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Detalle / Referencia</th>
                        <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Monto Base</th>
                        <th style={{ padding: '1rem', color: '#475569', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase' }}>Labor Extra</th>
                        <th style={{ padding: '1rem', textAlign: 'right' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.parts.map((p: any, idx: number) => {
                        const isPart = p.type === 'Parts';
                        const costAmount = isPart ? Number(p.glassCost) : Number(p.amount);
                        const laborTotal = isPart ? ((p.hasPriceTier ? Number(p.priceTierAmount) || 0 : 0) + (p.hasCalibration ? Number(p.calibrationAmount) || 0 : 0)) : null;

                        const detailText = isPart
                          ? `${p.partNumber || '-'} / ${p.nagsDescription || '-'}`
                          : p.description || '-';

                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '1rem', fontWeight: 600, color: '#1E293B', fontSize: '0.85rem' }}>{p.type}</td>
                            <td style={{ padding: '1rem', color: '#475569', fontSize: '0.85rem' }}>{detailText}</td>
                            <td style={{ padding: '1rem', fontWeight: 600, color: '#1E293B', fontSize: '0.9rem' }}>${(costAmount || 0).toFixed(2)}</td>
                            <td style={{ padding: '1rem', fontWeight: 600, color: '#2563EB', fontSize: '0.9rem' }}>
                              {laborTotal !== null ? `$${laborTotal.toFixed(2)}` : '-'}
                            </td>
                            <td style={{ padding: '0.8rem 1rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button type="button" onClick={() => editPart(idx)} style={{ background: 'white', border: '1px solid #E2E8F0', color: '#475569', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px', marginRight: '0.5rem', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} title="Editar">
                                <Edit2 size={16} />
                              </button>
                              <button type="button" onClick={() => removePart(idx)} style={{ background: '#FEF2F2', border: '1px solid #FEE2E2', color: '#DC2626', cursor: 'pointer', padding: '0.4rem', borderRadius: '6px' }} title="Eliminar">
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem 2rem', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                  <Layers size={40} color="#CBD5E1" style={{ marginBottom: '1rem' }} />
                  <p style={{ fontSize: '0.95rem', color: '#475569', fontWeight: 500, marginBottom: '1.5rem' }}>No hay partes o servicios registrados en esta orden.</p>
                  <button type="button" className="btn btn-primary" onClick={() => setIsAddingPart(true)}>
                    <Plus size={16} /> Añadir Parte o Servicio
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ backgroundColor: 'white', borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)', padding: '2rem', marginBottom: '2.5rem' }}>
            <div className="no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '2px solid #F1F5F9' }}>
              <div style={{ padding: '0.5rem', backgroundColor: '#ECFCCB', borderRadius: '8px', color: '#65A30D' }}>
                <Receipt size={22} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#1E293B' }}>Facturación y Totales</h3>
            </div>

            <div className="form-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px dashed #E2E8F0' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Subtotal Partes</span>
                  <span style={{ fontWeight: 600, color: '#1E293B' }}>${subPart.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px dashed #E2E8F0' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Subtotal Servicios</span>
                  <span style={{ fontWeight: 600, color: '#1E293B' }}>${subServices.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px dashed #E2E8F0' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Labor Total (Partes)</span>
                  <span style={{ fontWeight: 600, color: '#1E293B' }}>${totLabor.toFixed(2)}</span>
                </div>

                {data.type === 'Insurance' && (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px dashed #E2E8F0', marginTop: '0.5rem' }}>
                      <span style={{ color: '#64748B', fontWeight: 500 }}>Deducible Aseguranza</span>
                      <input type="number" step="any" className="form-input" name="deductible" value={data.deductible || ''} onChange={handleChange} style={{ width: '120px', padding: '0.4rem', textAlign: 'right' }} placeholder="$ 0.00" />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px dashed #E2E8F0' }}>
                      <span style={{ color: '#64748B', fontWeight: 500 }}>Kit Flat Rate</span>
                      <input type="number" step="any" className="form-input" name="kitFlatRate" value={data.kitFlatRate || ''} onChange={handleChange} style={{ width: '120px', padding: '0.4rem', textAlign: 'right' }} placeholder="$ 0.00" />
                    </div>
                  </>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px dashed #E2E8F0', marginTop: '0.5rem' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Impuestos (Tax %)</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="number" step="any" className="form-input" name="taxPercent" value={data.taxPercent || ''} onChange={handleChange} style={{ width: '80px', padding: '0.4rem', textAlign: 'right' }} placeholder="0" />
                    <span style={{ fontWeight: 600, color: '#94A3B8' }}>= ${calculatedTax.toFixed(2)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px dashed #E2E8F0' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Venta Adicional (Upsold)</span>
                  <input type="number" step="any" className="form-input" name="upsold" value={data.upsold || ''} onChange={handleChange} style={{ width: '120px', padding: '0.4rem', textAlign: 'right' }} placeholder="$ 0.00" />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.5rem', borderBottom: '1px dashed #E2E8F0' }}>
                  <span style={{ color: '#64748B', fontWeight: 500 }}>Comisión Extra (Upsell)</span>
                  <input type="number" step="any" className="form-input" name="upsell" value={data.upsell || ''} onChange={handleChange} style={{ width: '120px', padding: '0.4rem', textAlign: 'right' }} placeholder="$ 0.00" />
                </div>
              </div>

              <div style={{ backgroundColor: '#F8FAFC', borderRadius: '12px', padding: '2rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', border: '1px solid #E2E8F0' }}>
                <div style={{ marginBottom: '1.5rem', textAlign: 'right' }}>
                  <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Monto Total</span>
                  <span style={{ display: 'block', fontSize: '2.5rem', fontWeight: 900, color: '#0F172A', lineHeight: 1 }}>${calculatedTotal.toFixed(2)}</span>
                </div>

                <div style={{ marginBottom: '1.5rem', textAlign: 'right' }}>
                  <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>Abonado (Paid)</span>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <div className="input-group" style={{ width: '180px' }}>
                      <span className="input-addon-btn" style={{ backgroundColor: 'white', borderRight: 'none' }}>$</span>
                      <input type="number" step="any" className="form-input" name="paid" value={data.paid || ''} onChange={handleChange} style={{ borderLeft: 'none', paddingLeft: 0, fontWeight: 700, fontSize: '1.1rem' }} />
                    </div>
                  </div>
                </div>

                <div style={{ paddingTop: '1.5rem', borderTop: '2px solid #E2E8F0', textAlign: 'right' }}>
                  <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: calculatedBalance > 0 ? '#DC2626' : '#059669', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
                    Balance Restante
                  </span>
                  <span style={{ display: 'block', fontSize: '2rem', fontWeight: 800, color: calculatedBalance > 0 ? '#DC2626' : '#059669', lineHeight: 1 }}>
                    ${calculatedBalance.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="no-print" style={{ marginTop: '2rem', padding: '1rem 1.5rem', backgroundColor: '#FEFCE8', borderRadius: '8px', border: '1px dashed #CA8A04', display: 'flex', alignItems: 'center', gap: '1rem', width: 'fit-content' }}>
              <span style={{ color: '#854D0E', fontWeight: 600, fontSize: '0.9rem' }}>Cash Comeback (Opcional):</span>
              <div className="input-group" style={{ width: '150px' }}>
                <span className="input-addon-btn" style={{ backgroundColor: 'white' }}>$</span>
                <input type="number" step="any" className="form-input" name="cashComeback" value={data.cashComeback || ''} onChange={handleChange} />
              </div>
            </div>

          </div>

        </div>
      </div>

      {/* MODAL DE NUEVA COMPAÑÍA */}
      {isAddingCompany && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ width: '90%', maxWidth: '400px', backgroundColor: 'white', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>

            <div style={{ padding: '1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#0F172A' }}>Nueva Compañía</h3>
              <button onClick={() => setIsAddingCompany(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '2rem 1.5rem' }}>
              <label className="form-label" style={{ fontSize: '0.85rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', display: 'block' }}>Nombre de la Compañía</label>
              <input type="text" className="form-input" value={newCompanyName} onChange={e => setNewCompanyName(e.target.value)} placeholder="Ej. Geico" autoFocus />
            </div>

            <div style={{ padding: '1.5rem', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: '#F8FAFC' }}>
              <button type="button" onClick={() => setIsAddingCompany(false)} style={{ padding: '0.5rem 1rem', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button type="button" onClick={saveNewCompany} style={{ padding: '0.5rem 1rem', backgroundColor: '#0F172A', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Guardar Compañía</button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL DE SUBFORMULARIO A 2 COLUMNAS (NO IMPRIMIBLE) */}
      {isAddingPart && (
        <div className="no-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.65)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
          <div style={{ width: '90%', maxWidth: '700px', maxHeight: '90vh', backgroundColor: 'white', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', borderRadius: '12px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>

            <div style={{ padding: '1.5rem', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Layers size={22} color="#0F172A" />
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0F172A' }}>
                  {editingPartIndex !== null ? 'Editar Registro' : 'Nueva Parte / Servicio'}
                </h3>
              </div>
              <button onClick={cancelPart} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: '0.4rem', borderRadius: '50%', transition: 'background-color 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = '#E2E8F0'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                <X size={24} />
              </button>
            </div>

            <div style={{ padding: '2rem 1.5rem', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.2rem', alignItems: 'start' }}>

                <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ fontSize: '0.9rem', color: '#64748B', fontWeight: 600 }}>Tipo de Registro</label>
                  <div className="segmented-control" style={{ maxWidth: '400px' }}>
                    <label className={`segmented-item ${draftPart.type === 'Parts' ? 'active' : ''}`}><input type="radio" name="type" value="Parts" checked={draftPart.type === 'Parts'} onChange={handleDraftChange} style={{ display: 'none' }} />Parts</label>
                    <label className={`segmented-item ${draftPart.type === 'Services' ? 'active' : ''}`}><input type="radio" name="type" value="Services" checked={draftPart.type === 'Services'} onChange={handleDraftChange} style={{ display: 'none' }} />Services</label>
                  </div>
                </div>

                {draftPart.type === 'Parts' && data.type === 'Insurance' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">Jobtype</label>
                      <select className="form-select" name="jobtype" value={draftPart.jobtype || ''} onChange={handleDraftChange}>
                        <option value="">Seleccione...</option>
                        {jobtypeOptions.map((jt, idx) => (
                          <option key={idx} value={jt}>{jt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Part Number</label>
                      <select className="form-select" name="partNumber" value={draftPart.partNumber || ''} onChange={handlePartNumberChange}>
                        <option value="">Seleccione...</option>
                        {partNumberData.map((p, idx) => (
                          <option key={idx} value={p.partNumber}>{p.partNumber}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Nags Description</label>
                      <input type="text" className="form-input" name="nagsDescription" value={draftPart.nagsDescription || ''} onChange={handleDraftChange} placeholder="Escribe o edita la descripción..." />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Glass Cost</label>
                      <div className="input-group">
                        <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>$</span>
                        <input type="number" step="any" className="form-input" name="glassCost" value={draftPart.glassCost || ''} onChange={handleDraftChange} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">List Price</label>
                      <div className="input-group">
                        <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>$</span>
                        <input type="number" step="any" className="form-input" name="listPrice" value={draftPart.listPrice || ''} onChange={handleDraftChange} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Nags Discount Rate</label>
                      <div className="input-group">
                        <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>%</span>
                        <input type="number" step="any" className="form-input" name="nagsDiscountRate" value={draftPart.nagsDiscountRate || ''} onChange={handleDraftChange} />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Price Part Insurance</label>
                      <div className="input-group">
                        <span className="input-addon-btn" style={{ backgroundColor: '#F1F5F9' }}>$</span>
                        <input type="text" className="form-input" value={draftPricePartInsurance.toFixed(4)} disabled style={{ backgroundColor: '#F1F5F9', color: '#64748B', cursor: 'not-allowed' }} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Nags Labor Hour</label>
                      <input type="number" step="any" className="form-input" name="nagsLaborHour" value={draftPart.nagsLaborHour || ''} onChange={handleDraftChange} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Price For Hour</label>
                      <div className="input-group">
                        <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>$</span>
                        <input type="number" step="any" className="form-input" name="pricePerHour" value={draftPart.pricePerHour || ''} onChange={handleDraftChange} />
                      </div>
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Total Labor Hour</label>
                      <div className="input-group">
                        <span className="input-addon-btn" style={{ backgroundColor: '#F1F5F9' }}>$</span>
                        <input type="text" className="form-input" value={draftTotalLaborHour.toFixed(4)} disabled style={{ backgroundColor: '#F1F5F9', color: '#64748B', cursor: 'not-allowed' }} />
                      </div>
                    </div>
                  </>
                ) : draftPart.type === 'Parts' && data.type === 'Personal' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">Jobtype</label>
                      <select className="form-select" name="jobtype" value={draftPart.jobtype || ''} onChange={handleDraftChange}>
                        <option value="">Seleccione...</option>
                        {jobtypeOptions.map((jt, idx) => (
                          <option key={idx} value={jt}>{jt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Part Number</label>
                      <select className="form-select" name="partNumber" value={draftPart.partNumber || ''} onChange={handlePartNumberChange}>
                        <option value="">Seleccione...</option>
                        {partNumberData.map((p, idx) => (
                          <option key={idx} value={p.partNumber}>{p.partNumber}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Nags Description</label>
                      <input type="text" className="form-input" name="nagsDescription" value={draftPart.nagsDescription || ''} onChange={handleDraftChange} placeholder="Escribe o edita la descripción..." />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Glass Cost</label>
                      <div className="input-group">
                        <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>$</span>
                        <input type="number" step="any" className="form-input" name="glassCost" value={draftPart.glassCost || ''} onChange={handleDraftChange} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label" style={{ color: '#0F172A', fontWeight: 700 }}>Total Labor (Calculado)</label>
                      <div className="input-group">
                        <span className="input-addon-btn" style={{ backgroundColor: '#F1F5F9', color: '#0F172A', fontWeight: 'bold', border: 'none' }}>$</span>
                        <input type="text" className="form-input" value={draftTotalLabor.toFixed(2)} disabled style={{ backgroundColor: '#F1F5F9', color: '#0F172A', fontWeight: 'bold', border: 'none', cursor: 'not-allowed' }} />
                      </div>
                    </div>

                    <div className="form-group" style={{ gridColumn: '1 / -1', padding: '1.5rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', margin: '0.5rem 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: draftPart.hasPriceTier ? '1.5rem' : '0' }}>
                        <label className="form-label" style={{ margin: 0, fontWeight: 700, color: '#334155' }}>Añadir Price Tier</label>
                        <div className="segmented-control" style={{ margin: 0, width: '160px' }}>
                          <label className={`segmented-item ${draftPart.hasPriceTier ? 'active' : ''}`} style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}><input type="radio" checked={draftPart.hasPriceTier} onChange={() => toggleDraftBoolean('hasPriceTier', true)} style={{ display: 'none' }} />Sí</label>
                          <label className={`segmented-item ${!draftPart.hasPriceTier ? 'active' : ''}`} style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}><input type="radio" checked={!draftPart.hasPriceTier} onChange={() => toggleDraftBoolean('hasPriceTier', false)} style={{ display: 'none' }} />No</label>
                        </div>
                      </div>

                      {draftPart.hasPriceTier && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', borderTop: '1px solid #E2E8F0', paddingTop: '1.5rem' }}>
                          <div className="form-group">
                            <label className="form-label">Nombre del Price Tier</label>
                            <select className="form-select" name="priceTierName" value={draftPart.priceTierName || ''} onChange={handlePriceTierChange}>
                              <option value="">Seleccione...</option>
                              {priceTierData.map((pt, idx) => (
                                <option key={idx} value={pt.priceTier}>{pt.priceTier}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Monto Price Tier</label>
                            <div className="input-group">
                              <span className="input-addon-btn" style={{ backgroundColor: 'white' }}>$</span>
                              <input type="number" step="any" className="form-input" name="priceTierAmount" value={draftPart.priceTierAmount || ''} onChange={handleDraftChange} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="form-group" style={{ gridColumn: '1 / -1', padding: '1.5rem', backgroundColor: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: draftPart.hasCalibration ? '1.5rem' : '0' }}>
                        <label className="form-label" style={{ margin: 0, fontWeight: 700, color: '#334155' }}>Añadir Calibración</label>
                        <div className="segmented-control" style={{ margin: 0, width: '160px' }}>
                          <label className={`segmented-item ${draftPart.hasCalibration ? 'active' : ''}`} style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}><input type="radio" checked={draftPart.hasCalibration} onChange={() => toggleDraftBoolean('hasCalibration', true)} style={{ display: 'none' }} />Sí</label>
                          <label className={`segmented-item ${!draftPart.hasCalibration ? 'active' : ''}`} style={{ padding: '0.3rem 0.5rem', fontSize: '0.85rem' }}><input type="radio" checked={!draftPart.hasCalibration} onChange={() => toggleDraftBoolean('hasCalibration', false)} style={{ display: 'none' }} />No</label>
                        </div>
                      </div>

                      {draftPart.hasCalibration && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1.5rem', borderTop: '1px solid #E2E8F0', paddingTop: '1.5rem' }}>
                          <div className="form-group">
                            <label className="form-label">Nombre de Calibración</label>
                            <select className="form-select" name="calibrationName" value={draftPart.calibrationName || ''} onChange={handleCalibrationChange}>
                              <option value="">Seleccione...</option>
                              {calibrationData.map((c, idx) => (
                                <option key={idx} value={c.name}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="form-group">
                            <label className="form-label">Monto Calibración</label>
                            <div className="input-group">
                              <span className="input-addon-btn" style={{ backgroundColor: 'white' }}>$</span>
                              <input type="number" step="any" className="form-input" name="calibrationAmount" value={draftPart.calibrationAmount || ''} onChange={handleDraftChange} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                ) : draftPart.type === 'Services' && data.type === 'Personal' ? (
                  <>
                    <div className="form-group">
                      <label className="form-label">Jobtype</label>
                      <select className="form-select" name="jobtype" value={draftPart.jobtype || ''} onChange={handleDraftChange}>
                        <option value="">Seleccione...</option>
                        {jobtypeOptions.map((jt, idx) => (
                          <option key={idx} value={jt}>{jt}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Amount</label>
                      <div className="input-group">
                        <span className="input-addon-btn" style={{ backgroundColor: '#F8FAFC' }}>$</span>
                        <input type="number" step="any" className="form-input" name="amount" value={draftPart.amount || ''} onChange={handleDraftChange} />
                      </div>
                    </div>

                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Description</label>
                      <input type="text" className="form-input" name="description" value={draftPart.description || ''} onChange={handleDraftChange} />
                    </div>

                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Note</label>
                      <input type="text" className="form-input" name="note" value={draftPart.note || ''} onChange={handleDraftChange} placeholder="Notas adicionales..." />
                    </div>
                  </>
                ) : (
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <p style={{ fontSize: '0.9rem', color: '#64748B', fontStyle: 'italic', padding: '1.5rem', backgroundColor: '#F8FAFC', borderRadius: '8px', border: '1px solid #E2E8F0', textAlign: 'center' }}>
                      Asegúrese de haber seleccionado el tipo de documento adecuado.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div style={{ padding: '1.5rem 2rem', borderTop: '1px solid #E2E8F0', display: 'flex', justifyContent: 'flex-end', gap: '1rem', backgroundColor: '#F8FAFC' }}>
              <button type="button" onClick={cancelPart} style={{ padding: '0.6rem 1.5rem', backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>Cancelar</button>
              <button type="button" onClick={savePart} style={{ padding: '0.6rem 1.5rem', backgroundColor: '#0F172A', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}>
                Guardar {draftPart.type === 'Parts' ? 'Parte' : 'Servicio'}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
};