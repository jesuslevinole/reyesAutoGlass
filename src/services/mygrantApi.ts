// ⚠️ ADVERTENCIA DE SEGURIDAD:
// Estas credenciales NO deben estar en el frontend. Cualquier visitante de tu
// sitio puede leerlas desde las DevTools del navegador. Muévelas a tu backend
// y haz que callMygrantSOAP se ejecute del lado del servidor.
const CUSTOMER_ID = 'C021034-001';
const WEB_USER_ID = 'nwalex@gmail.com';
const PASSWORD = 'PEDEGO24';
const API_KEY = 'ALoIRuYgFbGAVxffclz4pjnjBAmhD4KjgQXxSZCvhfc=';
const PROXY_URL = '/mygrant-soap/v2/CORE650WebService.asmx';

export interface MygrantPart {
  partNumber: string;
  nagsDescription: string;
  listPrice: string;
}

async function callMygrantSOAP(requestType: string, requestDetailXML: string): Promise<string> {
  const xmlPayload = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/"><soap:Body><InboundTraffic xmlns="http://tempuri.org/"><request><![CDATA[<MygrantXMLOrderingSystemRequest><RequestHeader><EnvironmentID>PROD</EnvironmentID><CustomerID>${CUSTOMER_ID}</CustomerID><WebUserID>${WEB_USER_ID}</WebUserID><Password>${PASSWORD}</Password><RequestType>${requestType}</RequestType><VersionNumber>1.0</VersionNumber></RequestHeader><RequestSet><RequestItem><RequestItemNo>1</RequestItemNo><RequestDetail>${requestDetailXML}</RequestDetail></RequestItem></RequestSet></MygrantXMLOrderingSystemRequest>]]></request></InboundTraffic></soap:Body></soap:Envelope>`;

  try {
    const response = await fetch(PROXY_URL, {
      method: 'POST',
      headers: {
        'AuthToken': API_KEY,
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '"http://tempuri.org/InboundTraffic"',
      },
      body: xmlPayload,
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('Cloudflare bloqueó la petición. Verifica que reiniciaste el servidor de Vite.');
      }
      throw new Error(`HTTP Error: ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    console.error('Falla de red con Mygrant:', error);
    throw error;
  }
}

/**
 * El servicio CORE650 devuelve la respuesta de Mygrant ENVUELTA dentro del
 * SOAP envelope, y a su vez escapada como texto (CDATA o entidades HTML).
 * Esta función extrae ese XML interno para poder parsearlo.
 */
function extractMygrantXML(soapResponse: string): Document {
  const parser = new DOMParser();
  const soapDoc = parser.parseFromString(soapResponse, 'text/xml');

  // El resultado suele venir en <InboundTrafficResult> dentro del envelope.
  const resultNode =
    soapDoc.getElementsByTagName('InboundTrafficResult')[0] ||
    soapDoc.getElementsByTagName('return')[0];

  let innerXML = resultNode?.textContent ?? '';

  // Si vino con entidades escapadas (&lt; &gt;), las decodificamos.
  if (innerXML.includes('&lt;')) {
    const txt = document.createElement('textarea');
    txt.innerHTML = innerXML;
    innerXML = txt.value;
  }

  // Útil mientras ajustas los nombres de etiquetas: revisa esto en la consola.
  console.log('XML interno de Mygrant:', innerXML);

  return parser.parseFromString(innerXML, 'text/xml');
}

function text(node: Element, tag: string): string {
  return node.getElementsByTagName(tag)[0]?.textContent?.trim() ?? '';
}

export const mygrantApi = {
  getPartsByVehicle: async (
    year: string,
    make: string,
    model: string,
  ): Promise<MygrantPart[]> => {
    try {
      const detail =
        `<RequestVehicleYear>${year}</RequestVehicleYear>` +
        `<RequestVehicleMake>${make.toUpperCase()}</RequestVehicleMake>` +
        `<RequestVehicleModel>${model.toUpperCase()}</RequestVehicleModel>`;

      const soapResponse = await callMygrantSOAP('Inquiry', detail);
      const doc = extractMygrantXML(soapResponse);

      // Verificación de errores devueltos por la propia API de Mygrant.
      const errorNode = doc.getElementsByTagName('ErrorMessage')[0];
      if (errorNode?.textContent?.trim()) {
        throw new Error(`Mygrant devolvió un error: ${errorNode.textContent.trim()}`);
      }

      // ⚠️ AJUSTA estos nombres de etiqueta según el XML real que veas en consola.
      // Posibles contenedores de cada parte: <ResponseItem>, <ResponseDetail>, <Part>.
      let items = Array.from(doc.getElementsByTagName('ResponseItem'));
      if (items.length === 0) items = Array.from(doc.getElementsByTagName('ResponseDetail'));
      if (items.length === 0) items = Array.from(doc.getElementsByTagName('Part'));

      const parts: MygrantPart[] = items
        .map((item) => ({
          // ⚠️ AJUSTA también estos nombres de campo.
          partNumber:
            text(item, 'PartNumber') ||
            text(item, 'NagsPartNumber') ||
            text(item, 'ItemNumber'),
          nagsDescription:
            text(item, 'NagsDescription') ||
            text(item, 'Description') ||
            text(item, 'PartDescription'),
          listPrice:
            text(item, 'ListPrice') ||
            text(item, 'Price') ||
            text(item, 'UnitPrice'),
        }))
        .filter((p) => p.partNumber !== '');

      return parts;
    } catch (e) {
      // No usamos alert(): dejamos que el componente muestre el error en la UI.
      console.error('Error en getPartsByVehicle:', e);
      throw e;
    }
  },
};