// functions/api/recettes.js — Compagnon Santé, v3 (18/09/2026)
//
// Même principe que functions/api/aliments.js : cette Function ne stocke
// rien elle-même, elle va chercher à chaque appel le catalogue de recettes
// vivant hébergé par recettes-igbas, et le relaie tel quel à Compagnon
// Santé. Une seule base réelle à tenir à jour (recettes-igbas), Compagnon
// en affiche toujours le contenu courant.
//
// Le fetch se fait ici côté serveur (Cloudflare vers Cloudflare), donc les
// règles de sécurité du navigateur (CORS) ne s'appliquent pas.

export async function onRequestGet() {
  try {
    const reponse = await fetch('https://recettes-igbas.pages.dev/api/data', {
      cf: { cacheTtl: 0 }
    });

    if (!reponse.ok) {
      return new Response(
        JSON.stringify({ error: 'La base des recettes a répondu avec une erreur (' + reponse.status + ').' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const donnees = await reponse.text();

    return new Response(donnees, {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (erreur) {
    return new Response(
      JSON.stringify({ error: 'Impossible de contacter la base des recettes pour le moment.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
