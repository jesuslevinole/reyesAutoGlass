# GlassWorks · App para taller de instalación de vidrios

React 18 + TypeScript + Vite + Firebase/Firestore. UI responsive basada en la referencia visual aprobada (sidebar navy, lienzo lavanda, tarjetas con gradiente). Arquitectura config-driven: los módulos del diagrama ER se definen una sola vez en `src/config/modules.ts` y la vista genérica renderiza tabla, formulario, exportación e importación.

## Puesta en marcha

```bash
npm install
cp .env.example .env.local   # llenar con credenciales de Firebase
npm run dev
```

En Firebase Console: crear proyecto → agregar app web → copiar credenciales a `.env.local` → habilitar Cloud Firestore.

Scripts disponibles: `npm run dev` (desarrollo), `npm run build` (tsc + build de producción), `npm run lint` (ESLint), `npm run preview` (probar el build).

## Estructura

```
public/favicon.svg           ← ícono de la app
src/
  config/modules.ts          ← definición declarativa de los 19 módulos (campos, tipos, FKs, showIf)
  types/index.ts             ← tipos canónicos del dominio (única fuente)
  services/firestore.ts      ← CRUD genérico + importación por batch
  utils/csv.ts               ← export template CSV (BOM Excel) + parser CSV
  utils/relations.ts         ← resolver FKs a etiquetas, moneda, fechas
  components/
    Sidebar.tsx / .css       ← navegación por grupos, responsive con overlay
    ImportExportBar.tsx/.css ← botones de template Excel e importar CSV
  views/
    DashboardView.tsx / .css       ← dashboard gerencial (KPIs, gráficas SVG sin dependencias)
    GenericModuleView.tsx / .css   ← vista config-driven de todos los módulos
    WorkOrderDetailView.tsx / .css ← ficha de una orden: vehículo, cliente, líneas, pagos, totales
```

## Exportar template / importar CSV

Cada módulo tiene dos botones en su cabecera:

- **Exportar template Excel**: descarga `BD_XXXX_template.csv` con la fila de encabezados (nombres de columna del modelo) más los datos actuales de Firestore. Se abre directo en Excel (BOM UTF-8). Sirve como template para llenar desde el SQL actual.
- **Importar CSV**: sube un CSV con esos mismos encabezados y crea los registros en Firestore por batch (respetando el límite de 500 escrituras). Los tipos se convierten según la definición del campo (números, booleanos, ENUMLIST separado por comas). La columna `id` se ignora — Firestore asigna IDs propios.

Orden recomendado de importación (por dependencias de FK): catálogos primero (CAT_*), luego contactos (customers, agents, techs, distributors, insurances), luego workorders, y al final servicesdetail y pagos. Tras importar, los campos FK del CSV traen los IDs del SQL viejo; hay que mapearlos a los IDs nuevos de Firestore — se puede automatizar con un script si el volumen lo amerita.

## Caminos Personal / Insurance

`BD_WORKORDER` es una sola colección con `insuranceType`. Los campos exclusivos de cada camino están declarados con `showIf` en la config: el formulario solo muestra (y solo persiste) los campos del camino elegido — `idInsurance`, `deductible`, `kitFlatRate` para INSURANCE; `upsold` para PERSONAL. La vista de detalle de la orden también adapta sus columnas y su resumen financiero al camino.

## Nota de seguridad — pagos

`BD_PAYMENT` **no** almacena número de tarjeta completo, fecha de expiración ni CVV. PCI-DSS prohíbe guardar el CVV post-autorización, y guardar el PAN completo impone requisitos de cumplimiento que no queremos cargar. El modelo guarda `cardLast4`, `cardBrand` y el `idAutorization` que devuelve el procesador de pagos — suficiente para recibos, conciliación y disputas.

## Convenciones de código (CLAUDE.md)

- Sin `style={{...}}` para valores fijos — todo en clases CSS en archivo hermano. Inline solo variables CSS de runtime (`'--chip-color' as CSSProperties` para colores de status configurables, `--bar-w` en gráficas).
- Hover solo con `:hover` de CSS.
- Íconos con `lucide-react`.
- Componentes `export default function` (no `React.FC`).
- Sin `any`: filas genéricas tipadas como `Record<string, unknown>` con cast al tipo canónico donde se consume.
- Listas con `<ul>/<li>`, pares etiqueta/valor con `<dl>/<dt>/<dd>`, keys por `id`.
- Datos en tiempo real con `onSnapshot` (colección principal de cada vista y todo el dashboard).
- Verificación: `npx tsc --noEmit -p tsconfig.app.json`, `npm run lint`, `grep "style={{"`.
