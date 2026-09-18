// fonctions/api/recettes.js — Compagnon Santé, v3 (18/09/2026)
//
// Même principe que function/api/aliments.js : cette Function ne stocke
// rien elle-même, elle va chercher à chaque appel le catalogue de recettes
// vivant hébergé par recettes-igbas, et le relais tel quel à Compagnon
//Santé. Une seule base réelle à tenir à jour (recettes-igbas), Compagnon
// en affiche toujours le contenu courant.
//
// Le fetch se fait ici côté serveur (Cloudflare vers Cloudflare), donc les
// les règles de sécurité du navigateur (CORS) ne s'appliquent pas.

export async function onRequestGet() {
  essayer {
    const réponse = await fetch('https://recettes-igbas.pages.dev/api/data', {
      cf: { cacheTtl: 0 }
    });

    si (!réponse.ok) {
      retourner une nouvelle réponse(
        JSON.stringify({ error: 'La base des recettes a répondu avec une erreur (' + reponse.status + ').' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const données = wait réponse.text();

    renvoyer une nouvelle réponse (données, {
      statut : 200,
      en-têtes : {
        'Type de contenu' : 'application/json',
        'Cache-Control': 'no-store'
      }
    });
  } catch (erreur) {
    retourner une nouvelle réponse(
      JSON.stringify({ error: 'Impossible de contacter la base des recettes pour le moment.' }),
      { status: 502, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
