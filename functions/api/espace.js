// functions/api/espace.js — compagnon-sante — v7 — 29/09/2026 — Validé par Bernard : EN ATTENTE
// Espace client : vérifie le code dans CLIENTS_KV, puis envoie le contenu réservé et lit/écrit le suivi du client.
import { ESPACE_HTML } from './_espace.js';
const CLES = ['igbas_j2', 'igbas_journal2', 'igbas_rdv_day'];
export async function onRequestPost({ request, env }) {
  const rep = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  if (!env.CLIENTS_KV) return rep({ erreur: 'configuration' }, 500);
  let b;
  try { b = await request.json(); } catch (e) { return rep({ erreur: 'json' }, 400); }
  const kv = env.CLIENTS_KV;
  const code = String(b.code || '').trim().toUpperCase().replace(/\s+/g, '');
  const rl = 'rl:' + (request.headers.get('CF-Connecting-IP') || 'x');
  const essais = parseInt((await kv.get(rl)) || '0', 10);
  if (essais >= 10) return rep({ erreur: 'trop_essais' }, 429);
  const c = /^[A-Z0-9._-]{4,30}$/.test(code) ? await kv.get('code:' + code, 'json') : null;
  if (!c || !c.actif) { await kv.put(rl, String(essais + 1), { expirationTtl: 900 }); return rep({ erreur: 'code' }, 401); }
  if (essais) await kv.delete(rl);
  const cle = 'suivi:' + c.id;
  const d = (await kv.get(cle, 'json')) || {};
  if (b.action === 'ecrire') {
    if (!CLES.includes(b.cle)) return rep({ erreur: 'cle' }, 400);
    if (b.valeur === null) delete d[b.cle];
    else { if (typeof b.valeur !== 'string' || b.valeur.length > 100000) return rep({ erreur: 'taille' }, 400); d[b.cle] = b.valeur; }
    await kv.put(cle, JSON.stringify(d));
    return rep({ ok: true });
  }
  if (b.action === 'ouvrir') {
    d.igbas_access = 'ok_client';
    const init = JSON.stringify({ code, d }).replace(/</g, '\\u003c');
    return rep({ ok: true, prenom: c.prenom || '', html: ESPACE_HTML.replace('__INIT__', () => init) });
  }
  return rep({ ok: true, prenom: c.prenom || '' });
}
