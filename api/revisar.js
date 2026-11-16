// Función de Vercel: revisa la web pública de un local (estilo "profile" de Sellbird).
// Lee la portada y hasta 3 páginas de contacto y devuelve señales de venta, mails y redes.
// Uso: /api/revisar?url=https://sitio.com
const dns = require('dns').promises;
const net = require('net');

const MAX_FILE = 1500000;
const TIMEOUT = 7000;
const DEADLINE = 14000;

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
  }
  const l = ip.toLowerCase();
  return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:');
}

async function checkUrl(raw) {
  let url;
  try { url = new URL(raw); } catch (e) { throw new Error('El enlace no es válido.'); }
  if (!/^https?:$/.test(url.protocol)) throw new Error('Solo se aceptan enlaces http o https.');
  const h = url.hostname.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) throw new Error('Ese enlace no es un sitio público.');
  const addrs = net.isIP(h) ? [h] : (await dns.lookup(h, { all: true })).map(a => a.address);
  if (!addrs.length || addrs.some(isPrivateIp)) throw new Error('Ese enlace no es un sitio público.');
  return url;
}

async function readLimited(res, max) {
  const reader = res.body.getReader();
  const chunks = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) { chunks.push(value.slice(0, value.length - (size - max))); try { await reader.cancel(); } catch (e) {} break; }
    chunks.push(value);
  }
  return Buffer.concat(chunks.map(c => Buffer.from(c))).toString('utf8');
}

async function get(raw, hops = 0) {
  const url = await checkUrl(raw);
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const r = await fetch(url, {
      redirect: 'manual', signal: ctrl.signal,
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; Cazaclientes/1.0)', accept: 'text/html,application/xhtml+xml,*/*', 'accept-language': 'es-AR,es' }
    });
    const loc = r.headers.get('location');
    if (r.status >= 300 && r.status < 400 && loc) {
      if (hops >= 4) throw new Error('Demasiadas redirecciones.');
      return get(new URL(loc, url).href, hops + 1);
    }
    const type = r.headers.get('content-type') || '';
    if (!r.ok || !/html|text/i.test(type)) return { url: url.href, status: r.status, text: '' };
    return { url: url.href, status: r.status, text: await readLimited(r, MAX_FILE) };
  } finally { clearTimeout(t); }
}

const conTiempo = (p, ms, def) => Promise.race([p, new Promise(r => setTimeout(() => r(def), ms))]);
const uniq = a => [...new Set(a)];
function hrefs(html) { const out = []; const re = /href\s*=\s*["']([^"'#]+)["']/gi; let m; while ((m = re.exec(html))) out.push(m[1].trim()); return out; }
function texto(html) { return html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' '); }

const PLATAFORMAS = [
  [/wixstatic\.com|_wixCIDX|wix\.com\/website/i, 'Wix'], [/wp-content|wp-includes/i, 'WordPress'],
  [/tiendanube|nuvemshop/i, 'Tiendanube'], [/empretienda/i, 'Empretienda'], [/cdn\.shopify\.com/i, 'Shopify'],
  [/sites\.google\.com|gstatic\.com\/sites/i, 'Google Sites'], [/squarespace/i, 'Squarespace'],
  [/img1\.wsimg\.com|godaddy/i, 'GoDaddy'], [/blogger\.com|blogspot/i, 'Blogger'], [/webflow/i, 'Webflow'],
  [/jimdo/i, 'Jimdo'], [/carrd\.co/i, 'Carrd'], [/mitiendanube|mercadoshops/i, 'Mercado Shops']
];

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const t0 = Date.now();
  let input = String((req.query && req.query.url) || '').trim();
  if (!input) return res.status(400).json({ ok: false, error: 'Falta el enlace.' });
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input) && !/^https?:\/\//i.test(input)) return res.status(400).json({ ok: false, error: 'Solo se aceptan enlaces http o https.' });
  if (!/^https?:\/\//i.test(input)) input = 'https://' + input;

  let main;
  try { main = await get(input); }
  catch (e) {
    if (/no es|válido|http o https/.test(e.message)) return res.status(400).json({ ok: false, error: e.message });
    main = null;
  }
  const ms = Date.now() - t0;
  if (!main || !main.text) {
    return res.status(200).json({ ok: true, final: input, ms, caida: true, emails: [], whatsapp: [], tels: [], redes: [],
      senales: [{ k: 'caida', t: 'La web no carga' + (main && main.status ? ' (error ' + main.status + ')' : ''), hot: 1 }] });
  }

  const base = new URL(main.url);
  const enlaces = hrefs(main.text);
  // Páginas de contacto, reservas o "nosotros" del mismo sitio (hasta 3)
  const internas = uniq(enlaces.map(h => { try { return new URL(h, base); } catch (e) { return null; } })
    .filter(u => u && u.hostname === base.hostname && /contact|nosotros|about|reserv|turno|ubicaci|donde/i.test(u.pathname))
    .map(u => u.href.split('#')[0])).filter(u => u !== main.url).slice(0, 3);
  const extra = await conTiempo(Promise.all(internas.map(u => get(u).catch(() => null))), Math.max(1000, DEADLINE - (Date.now() - t0)), []);
  const paginas = [main].concat((extra || []).filter(p => p && p.text));
  const html = paginas.map(p => p.text).join('\n');
  const todos = paginas.flatMap(p => hrefs(p.text));
  const txt = texto(html);

  // Contacto
  const mails = uniq(todos.filter(h => /^mailto:/i.test(h)).map(h => decodeURIComponent(h.slice(7).split('?')[0]).trim().toLowerCase())
    .concat((txt.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || []).map(x => x.toLowerCase())))
    .filter(e => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(e) && !/\.(png|jpe?g|gif|webp|svg)$/i.test(e) && !/sentry|wixpress|example\.|ejemplo|tudominio|domain\.com/i.test(e))
    .slice(0, 5);
  const emails = await Promise.all(mails.map(async e => {
    const d = e.split('@')[1];
    const mx = await conTiempo(dns.resolveMx(d).then(r => r.length > 0).catch(() => false), 3000, null);
    return { email: e, mx };
  }));
  const whatsapp = uniq(todos.map(h => (h.match(/(?:wa\.me\/|api\.whatsapp\.com\/send\/?\?phone=|whatsapp:\/\/send\?phone=)\+?(\d{8,15})/i) || [])[1]).filter(Boolean)).slice(0, 3);
  const tels = uniq(todos.filter(h => /^tel:/i.test(h)).map(h => decodeURIComponent(h.slice(4)).trim())).slice(0, 3);
  const redes = uniq(todos.filter(h => /^https?:\/\/(www\.)?(instagram\.com|facebook\.com|fb\.com|tiktok\.com)\/[^/?]+/i.test(h) && !/sharer|share\.php|\/plugins\/|intent/i.test(h))
    .map(h => h.split('?')[0].replace(/\/$/, ''))).slice(0, 4);

  // Señales
  const s = [];
  const anio = new Date().getFullYear();
  if (base.protocol === 'http:') s.push({ k: 'sin_https', t: 'Sin candado de seguridad (http)', hot: 0 });
  if (!/<meta[^>]+name\s*=\s*["']viewport/i.test(main.text)) s.push({ k: 'sin_movil', t: 'No se adapta al celular', hot: 1 });
  const cr = [...html.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/gi)].map(m => +m[1]);
  if (cr.length && Math.max(...cr) < anio - 1) s.push({ k: 'desactualizada', t: 'Web desactualizada (© ' + Math.max(...cr) + ')', hot: 1, anio: Math.max(...cr) });
  if (!whatsapp.length && !/whatsapp/i.test(html)) s.push({ k: 'sin_whatsapp', t: 'Sin botón de WhatsApp', hot: 0 });
  const reservas = /reserv[aá]\s*(online|ahora|ya)|reservar|sac[aá]\s*turno|turnos?\s*online|ped[ií]\s*online|hac[eé]\s*tu\s*pedido|carrito|checkout|agregar al carrito|book now|calendly|simplybook|cloudbeds|agendapro|tuturno|reservo|motor de reservas|mercadopago|mercado pago/i.test(html);
  if (!reservas) s.push({ k: 'sin_reservas', t: 'No se puede reservar, pedir ni pagar online', hot: 0 });
  const pdfs = todos.filter(h => /\.pdf(\?|$)/i.test(h));
  if (pdfs.some(h => /carta|menu|men%c3%ba|precio|lista/i.test(h)) || (pdfs.length && /\b(carta|men[uú])\b/i.test(txt))) s.push({ k: 'carta_pdf', t: 'Carta o lista de precios en PDF', hot: 1 });
  const titulo = (main.text.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '';
  if (!titulo.trim() || !/<meta[^>]+name\s*=\s*["']description/i.test(main.text)) s.push({ k: 'sin_seo', t: 'Sin descripción para Google', hot: 0 });
  if (ms > 3500) s.push({ k: 'lenta', t: 'Tarda en cargar (' + (ms / 1000).toFixed(1) + ' s)', hot: 0 });
  if (/fbq\(|connect\.facebook\.net\/[^"']*fbevents|googleadservices|AW-\d{6,}/i.test(html)) s.push({ k: 'anuncios', t: 'Invierte en anuncios', ok: 1 });
  if (!/googletagmanager|gtag\(|google-analytics|analytics\.js|clarity\.ms/i.test(html)) s.push({ k: 'sin_medicion', t: 'No mide sus visitas', hot: 0 });
  const plataforma = (PLATAFORMAS.find(([re]) => re.test(html)) || [])[1] || '';
  const ag = main.text.match(/(?:dise[ñn]ad[oa]|desarrollad[oa]|hech[oa]|realizad[oa]|dise[ñn]o\s+web|sitio\s+web)\s+(?:por|by)\s*:?\s*(?:<[^>]*>\s*)*([^<]{2,60})/i);
  const agencia = ag ? ag[1].replace(/&amp;/g, '&').split(/[|·•\n]/)[0].trim().slice(0, 40) : '';
  if (agencia) s.push({ k: 'agencia', t: 'Hecha por ' + agencia, ok: 1 });

  return res.status(200).json({ ok: true, final: main.url, ms, titulo: titulo.trim().slice(0, 120), plataforma, agencia, emails, whatsapp, tels, redes, senales: s, paginas: paginas.length });
};
