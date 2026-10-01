// functions/api/doc.js — compagnon-sante — v1 — 01/10/2026 — Validé par Bernard : EN ATTENTE
// Envoie un PDF du programme à une cliente : lien temporaire (1 h) + code encore actif + document de SA formule uniquement.
export async function onRequestGet({ request, env }) {
  const non = (m, s) => new Response(m, { status: s, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' } });
  const u = new URL(request.url), t = u.searchParams.get('t') || '', d = u.searchParams.get('d') || '';
  if (!env.CLIENTS_KV) return non('Service indisponible', 500);
  if (!/^[a-f0-9]{32}$/.test(t) || !/^[a-z0-9_-]{1,40}$/.test(d)) return non('Lien invalide', 400);
  const kv = env.CLIENTS_KV;
  const s = await kv.get('dt:' + t, 'json');
  if (!s) return non("Ce lien a expiré. Rouvrez « Mes documents » depuis l'application.", 403);
  const f = (await kv.get('fiche:' + s.id, 'json')) || {};
  const c = f.code ? await kv.get('code:' + f.code, 'json') : null;
  if (!c || !c.actif || c.id !== s.id) return non('Accès terminé.', 403);
  const fid = (f.champs || {})['#gest-formule'] || '';
  const x = ((await kv.get('docs:index', 'json')) || []).find((y) => y.id === d && (y.formules || []).includes(fid));
  if (!x) return non("Ce document ne fait pas partie de votre formule.", 403);
  const buf = await kv.get('docs:file:' + d, 'arrayBuffer');
  if (!buf) return non('Document introuvable.', 404);
  return new Response(buf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="' + encodeURIComponent((x.titre || 'document') + '.pdf') + '"', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } });
}
