// Función de Vercel: abre un enlace corto de Google Maps (maps.app.goo.gl) y devuelve
// la dirección larga, que trae el nombre del local y sus coordenadas.
// No lee el contenido de la página: solo sigue las redirecciones.
const PERMITIDOS = /^(maps\.app\.goo\.gl|goo\.gl|g\.co|maps\.google\.[a-z.]+|(www\.)?google\.[a-z.]+)$/i;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  let u;
  try { u = new URL(String((req.query && req.query.u) || '').trim()); } catch (e) { return res.status(400).json({ ok: false, error: 'Enlace no válido.' }); }
  if (u.protocol !== 'https:' || !PERMITIDOS.test(u.hostname)) return res.status(400).json({ ok: false, error: 'Solo enlaces de Google Maps.' });
  try {
    for (let i = 0; i < 6; i++) {
      if (/\/maps\/(place|search|@)/.test(u.pathname) || u.searchParams.get('q')) break;
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 5000);
      const r = await fetch(u, { redirect: 'manual', signal: ctrl.signal, headers: { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Cazaclientes/1.0' } }).finally(() => clearTimeout(t));
      try { await r.body?.cancel(); } catch (e) {}
      const loc = r.headers.get('location');
      if (!(r.status >= 300 && r.status < 400 && loc)) break;
      const sig = new URL(loc, u);
      if (sig.protocol !== 'https:' || !PERMITIDOS.test(sig.hostname)) break;
      u = sig;
    }
    return res.status(200).json({ ok: true, url: u.href });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'No se pudo abrir el enlace.' });
  }
};
