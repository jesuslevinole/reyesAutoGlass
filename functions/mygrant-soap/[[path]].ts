// functions/mygrant-soap/[[path]].ts
// Proxy del lado del servidor para el API SOAP de Mygrant.
// Se ejecuta en el edge de Cloudflare, NO en el navegador.

export const onRequest: PagesFunction = async (context) => {
  const { request, params } = context;

  // Reconstruye la ruta capturada por [[path]] hacia el API real de Mygrant.
  const path = Array.isArray(params.path) ? params.path.join('/') : (params.path ?? '');
  const targetUrl = `https://webservice.mygrantglass.com/${path}`;

  // Solo reenviamos las cabeceras necesarias para SOAP.
  const forwardHeaders = new Headers();
  forwardHeaders.set('Content-Type', request.headers.get('Content-Type') || 'text/xml; charset=utf-8');
  const soapAction = request.headers.get('SOAPAction');
  if (soapAction) forwardHeaders.set('SOAPAction', soapAction);
  const authToken = request.headers.get('AuthToken');
  if (authToken) forwardHeaders.set('AuthToken', authToken);
  forwardHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : await request.text(),
    });

    // Devolvemos la respuesta tal cual al navegador.
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') || 'text/xml; charset=utf-8',
      },
    });
  } catch (error) {
    return new Response(
      `Error en el proxy de Mygrant: ${error instanceof Error ? error.message : 'desconocido'}`,
      { status: 502 }
    );
  }
};