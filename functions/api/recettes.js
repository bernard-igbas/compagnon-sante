// functions/api/recettes.js — Compagnon Santé, v4 (22/09/2026)
//
// Même principe que functions/api/aliments.js : cette Function ne stocke
// rien elle-même, elle va chercher à chaque appel le catalogue de recettes
// vivant hébergé par recettes-igbas, et le relaie à Compagnon Santé. Une
// seule base réelle à tenir à jour (recettes-igbas), Compagnon en affiche
// toujours le contenu courant.
//
// v4 (22/09/2026) : depuis que les photos de recettes-igbas ont leur propre
// rangement, chaque recette porte une adresse de photo COURTE, du type
// "/api/photo?id=...", valable uniquement sur le site recettes-igbas. Sans
// correction, Compagnon Santé cherchait la photo sur son propre site et ne
// la trouvait pas. Cette version complète l'adresse avant de la transmettre.
//
// Le fetch se fait ici côté serveur (Cloudflare vers Cloudflare), donc les
// règles de sécurité du navigateur (CORS) ne s'appliquent pas.

const ORIGINE_RECETTES = 'https://recettes-igbas.pages.dev';

// Complète une adresse de photo courte ("/api/photo?id=...") en adresse
// complète. Ne touche pas aux adresses déjà complètes ni aux champs vides.
function completerAdressePhoto(photo) {
  if (typeof photo !== 'string' || !photo) return photo;
  if (photo.startsWith('/')) return ORIGINE_RECETTES + photo;
  return photo;
}

export async function onRequestGet() {
  try {
    const reponse = await fetch(ORIGINE_RECETTES + '/api/data', {
      cf: { cacheTtl: 0 }
    });

    if (!reponse.ok) {
      return new Response(
        JSON.stringify({ error: 'La base des recettes a répondu avec une erreur (' + reponse.status + ').' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const brut = await reponse.text();

    let donnees;
    try {
      donnees = JSON.parse(brut);
    } catch (e) {
      // Format inattendu : on relaie quand même tel quel plutôt que de bloquer
      // Compagnon Santé (comportement identique à la v3 en cas de souci).
      return new Response(brut, {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
      });
    }

    if (donnees && Array.isArray(donnees.recettes)) {
      for (const r of donnees.recettes) {
        r.photo = completerAdressePhoto(r.photo);
      }
    }

    return new Response(JSON.stringify(donnees), {
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
