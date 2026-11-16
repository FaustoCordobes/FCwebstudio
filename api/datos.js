// Función de Vercel: guarda los datos de Cazaclientes en la nube (Upstash Redis de Vercel)
// para usarlos desde el celular, la PC o cualquier dispositivo.
// Variables en Vercel: KV_REST_API_URL y KV_REST_API_TOKEN (las pone Vercel al conectar Upstash)
// y CC_CLAVE (la clave que elegís vos).
const crypto = require('crypto');

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const CLAVE = process.env.CC_CLAVE || '';
const K = { leads: 'cc:leads', borrados: 'cc:borrados', ajustes: 'cc:ajustes', bajas: 'cc:bajas' };

function igual(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
async function redis(cmds) {
  const r = await fetch(URL_ + '/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmds) });
  if (!r.ok) throw new Error('La base respondió ' + r.status);
  const j = await r.json();
  const err = j.find(x => x.error); if (err) throw new Error(err.error);
  return j.map(x => x.result);
}
const parear = arr => { const o = {}; for (let i = 0; i < (arr || []).length; i += 2) o[arr[i]] = arr[i + 1]; return o; };

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(501).json({ ok: false, error: 'Falta conectar el almacenamiento (Upstash) en Vercel.' });
  if (!CLAVE) return res.status(501).json({ ok: false, error: 'Falta la variable CC_CLAVE en Vercel.' });
  const dada = req.headers['x-sync'] || '';
  if (!dada || !igual(dada, CLAVE)) { await new Promise(r => setTimeout(r, 800)); return res.status(401).json({ ok: false, error: 'Clave incorrecta.' }); }

  try {
    if (req.method === 'GET') {
      const [leads, borrados, ajustes, bajas] = await redis([['HGETALL', K.leads], ['HGETALL', K.borrados], ['GET', K.ajustes], ['SMEMBERS', K.bajas]]);
      const L = Object.values(parear(leads)).map(s => { try { return JSON.parse(s); } catch (e) { return null; } }).filter(Boolean);
      const B = Object.fromEntries(Object.entries(parear(borrados)).map(([k, v]) => [k, +v]));
      return res.status(200).json({ ok: true, leads: L, borrados: B, ajustes: ajustes ? JSON.parse(ajustes) : null, bajas: bajas || [], t: Date.now() });
    }
    if (req.method === 'POST') {
      let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } } b = b || {};
      const cmds = [];
      const leads = Array.isArray(b.leads) ? b.leads.filter(l => l && typeof l.id === 'string').slice(0, 2000) : [];
      if (leads.length) {
        const hset = ['HSET', K.leads]; leads.forEach(l => hset.push(l.id, JSON.stringify(l)));
        cmds.push(hset, ['HDEL', K.borrados, ...leads.map(l => l.id)]);
      }
      const borr = Array.isArray(b.borrados) ? b.borrados.filter(x => typeof x === 'string').slice(0, 2000) : [];
      if (borr.length) {
        cmds.push(['HDEL', K.leads, ...borr]);
        const hb = ['HSET', K.borrados]; borr.forEach(id => hb.push(id, String(Date.now()))); cmds.push(hb);
      }
      if (b.ajustes && typeof b.ajustes === 'object') cmds.push(['SET', K.ajustes, JSON.stringify(b.ajustes)]);
      const bajas = Array.isArray(b.bajas) ? b.bajas.filter(x => typeof x === 'string').slice(0, 5000) : [];
      if (bajas.length) cmds.push(['SADD', K.bajas, ...bajas]);
      if (cmds.length) await redis(cmds);
      return res.status(200).json({ ok: true, t: Date.now() });
    }
    return res.status(405).json({ ok: false, error: 'Método no permitido.' });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'No se pudo guardar en la nube: ' + e.message });
  }
};
