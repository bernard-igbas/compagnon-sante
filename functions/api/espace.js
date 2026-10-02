// functions/api/espace.js — compagnon-sante — v7.7 — 01/10/2026 — Validé par Bernard : EN ATTENTE
// Espace client : vérifie le code dans CLIENTS_KV, envoie le contenu réservé, lit/écrit le suivi et les menus du client.
// v7.7 : « nouveauxDocs » = documents de la formule ajoutés ou mis à jour depuis la dernière ouverture de Mes documents (igbas_docs_vu).
// v7.6 : action « docs » (liste des documents de la formule de la cliente, lien valable 1 h). v7.4 : signaux — todo:<id> (menu à corriger, côté Marie-Laure) et igbas_menu_vu (correction vue, côté cliente).
// v7.2 : page « Mes menus » (menu:<id>:<semaine> = menus du client ; menuval:<id>:<semaine> = correction de Marie-Laure).
import { ESPACE_HTML, MENU_HTML } from './_espace.js';
const CLES = ['igbas_j2', 'igbas_journal2', 'igbas_rdv_day', 'igbas_suivi_v3_data', 'igbas_suivi_v3_profile'];
const SEM = /^\d{4}-\d{2}-\d{2}$/;
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
  const init = (o) => JSON.stringify(o).replace(/</g, '\\u003c');
  if (b.action === 'ecrire') {
    if (!CLES.includes(b.cle)) return rep({ erreur: 'cle' }, 400);
    if (b.valeur === null) delete d[b.cle];
    else {
      if (typeof b.valeur !== 'string' || b.valeur.length > 100000) return rep({ erreur: 'taille' }, 400);
      d[b.cle] = b.valeur;
      if (b.cle === 'igbas_suivi_v3_data') { // historique : une entrée par semaine, lisible par Marie-Laure
        try { const m = JSON.parse(b.valeur); if (SEM.test(m.semDebut || '')) { await kv.put('menu:' + c.id + ':' + m.semDebut, b.valeur); const plein = Object.values(m.jours || {}).some((j) => Object.values((j && j.repas) || {}).some((r) => r && String(r.txt || '').trim())); if (plein) await kv.put('todo:' + c.id, JSON.stringify({ sem: m.semDebut, date: new Date().toISOString() })); } } catch (e) {}
      }
    }
    await kv.put(cle, JSON.stringify(d));
    return rep({ ok: true });
  }
  if (b.action === 'ouvrir') {
    d.igbas_access = 'ok_client';
    let s0 = ''; try { s0 = JSON.parse(d.igbas_suivi_v3_data || '{}').semDebut || ''; } catch (e) {}
    const v0 = SEM.test(s0) ? await kv.get('menuval:' + c.id + ':' + s0, 'json') : null;
    const alerte = !!(v0 && v0.date && v0.date !== d.igbas_menu_vu);
    const f0 = (await kv.get('fiche:' + c.id, 'json')) || {};
    const fid0 = (f0.champs || {})['#gest-formule'] || '';
    const nouveauxDocs = ((await kv.get('docs:index', 'json')) || []).filter((x) => (x.formules || []).includes(fid0) && (!d.igbas_docs_vu || (x.maj || '') > d.igbas_docs_vu)).length;
    return rep({ ok: true, prenom: c.prenom || '', html: ESPACE_HTML.replace('__INIT__', () => init({ code, d, alerte, nouveauxDocs })) });
  }
  if (b.action === 'docs') {
    const f = (await kv.get('fiche:' + c.id, 'json')) || {};
    const fid = (f.champs || {})['#gest-formule'] || '';
    const form = ((await kv.get('formules', 'json')) || []).find((o) => o.id === fid);
    const mine = ((await kv.get('docs:index', 'json')) || []).filter((x) => (x.formules || []).includes(fid)).sort((a, b2) => (a.ordre || 0) - (b2.ordre || 0));
    let t = '';
    if (mine.length) { t = crypto.randomUUID().replace(/-/g, ''); await kv.put('dt:' + t, JSON.stringify({ id: c.id }), { expirationTtl: 3600 }); }
    d.igbas_docs_vu = new Date().toISOString(); await kv.put(cle, JSON.stringify(d)); // documents vus : le signal s'éteint
    return rep({ ok: true, formule: form ? form.nom : '', docs: mine.map((x) => ({ titre: x.titre, url: '/api/doc?t=' + t + '&d=' + x.id })) });
  }
  if (b.action === 'menu') {
    const f = (await kv.get('fiche:' + c.id, 'json')) || {};
    const ch = f.champs || {};
    if (!d.igbas_suivi_v3_profile && (f.nom || f.prenom)) {
      d.igbas_suivi_v3_profile = JSON.stringify({ nom: ((f.prenom || '') + ' ' + (f.nom || '')).trim(), debut: '', poidsInit: ch['#poids-debut'] || '', poidsObj: ch['#poids-souhaite'] || '' });
    }
    let sem = ''; try { sem = JSON.parse(d.igbas_suivi_v3_data || '{}').semDebut || ''; } catch (e) {}
    const val = SEM.test(sem) ? await kv.get('menuval:' + c.id + ':' + sem, 'json') : null;
    if (val && val.date && val.date !== d.igbas_menu_vu) { d.igbas_menu_vu = val.date; await kv.put(cle, JSON.stringify(d)); } // correction vue : le signal s'éteint
    return rep({ ok: true, html: MENU_HTML.replace('__INIT__', () => init({ code, d, val })) });
  }
  return rep({ ok: true, prenom: c.prenom || '' });
}
