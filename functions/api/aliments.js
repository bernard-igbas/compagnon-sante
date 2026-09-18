// functions/api/aliments.js — Compagnon Santé, v2 (17/09/2026)
//
// Cette Function ne stocke rien elle-même : elle va chercher, à chaque appel,
// la base d'aliments vivante hébergée par recettes-igbas (celle-là même que
// gestion-aliments-ig lit et écrit), et la relaie telle quelle à Compagnon
// Santé. Ainsi il n'y a qu'une seule base réelle à tenir à jour (dans
// gestion-aliments-ig), et Compagnon en affiche toujours le contenu courant.
//
// Le fetch se fait ici côté serveur (Cloudflare vers Cloudflare), donc les
// règles de sécurité du navigateur (CORS) ne s'appliquent pas — pas besoin
// de toucher au code de recettes-igbas pour que cela fonctionne.

export async function onRequestGet() {
  try {
    const reponse = await fetch('https://recettes-igbas.pages.dev/api/aliments', {
      cf: { cacheTtl: 0 }
    });

    if (!reponse.ok) {
      return new Response(
        JSON.stringify({ error: 'La base des aliments a répondu avec une erreur (' + reponse.status + ').' }),
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
      JSON.stringify({ error: 'Impossible de contacter la base des aliments pour le moment.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
