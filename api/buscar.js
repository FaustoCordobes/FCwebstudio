// Función de Vercel: busca locales en Google Places (Text Search, API nueva).
// La clave queda en el servidor (variable GOOGLE_PLACES_KEY), nunca en el navegador.
// Si definís ACCESS_CODE, solo quien conozca ese código puede usar la búsqueda.

const FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.location',
  'places.nationalPhoneNumber', 'places.internationalPhoneNumber', 'places.websiteUri',
  'places.googleMapsUri', 'places.rating', 'places.userRatingCount', 'places.primaryType',
  'places.primaryTypeDisplayName', 'places.businessStatus', 'places.regularOpeningHours',
  'places.photos', 'nextPageToken'
].join(',');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Usá POST.' });

  const code = process.env.ACCESS_CODE;
  if (code && req.headers['x-clave'] !== code) return res.status(401).json({ ok: false, error: 'Código de acceso incorrecto. Revisalo en Ajustes.' });

  const key = process.env.GOOGLE_PLACES_KEY;
  if (!key) return res.status(501).json({ ok: false, error: 'Falta la clave de Google (GOOGLE_PLACES_KEY) en Vercel. Mientras tanto se busca solo en OpenStreetMap.' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};
  const query = String(b.query || '').slice(0, 200).trim();
  if (!query) return res.status(400).json({ ok: false, error: 'Falta qué buscar.' });

  const body = { textQuery: query, languageCode: 'es', regionCode: 'AR', pageSize: 20 };
  const lat = Number(b.lat), lng = Number(b.lng), radius = Math.min(50000, Math.max(500, Number(b.radius) || 5000));
  if (Number.isFinite(lat) && Number.isFinite(lng)) body.locationBias = { circle: { center: { latitude: lat, longitude: lng }, radius } };
  if (b.pageToken) body.pageToken = String(b.pageToken).slice(0, 2000);

  try {
    const r = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': FIELDS },
      body: JSON.stringify(body)
    });
    const j = await r.json();
    if (!r.ok) return res.status(r.status).json({ ok: false, error: (j.error && j.error.message) || 'Google respondió con un error.' });
    const places = (j.places || []).map(p => ({
      id: p.id,
      nombre: p.displayName && p.displayName.text,
      direccion: p.formattedAddress,
      lat: p.location && p.location.latitude,
      lng: p.location && p.location.longitude,
      tel: p.nationalPhoneNumber || '',
      telInt: p.internationalPhoneNumber || '',
      web: p.websiteUri || '',
      maps: p.googleMapsUri || '',
      rating: p.rating || 0,
      resenas: p.userRatingCount || 0,
      tipo: p.primaryType || '',
      tipoNombre: (p.primaryTypeDisplayName && p.primaryTypeDisplayName.text) || '',
      estado: p.businessStatus || '',
      horarios: !!(p.regularOpeningHours && (p.regularOpeningHours.weekdayDescriptions || []).length),
      fotos: (p.photos || []).length
    }));
    return res.status(200).json({ ok: true, places, nextPageToken: j.nextPageToken || null });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'No se pudo conectar con Google.' });
  }
};
