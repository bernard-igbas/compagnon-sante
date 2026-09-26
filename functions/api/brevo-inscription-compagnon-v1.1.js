// ============================================================
// compagnon-sante (brevo-inscription-compagnon.js) — v1.1 — 25/09/2026 — Validé par Bernard : EN ATTENTE
// ------------------------------------------------------------
// CHANGELOG
//  v1.0 (23/09/2026) : nouveau fichier. Reçoit un prénom et un e-mail depuis le
//    bulletin d'inscription à Compagnon Santé (inscription.html), inscrit le
//    contact chez Brevo dans la liste id 8 ("Abonnés Compagnon"), ce qui
//    déclenche l'automation n°4 (mail de bienvenue avec le lien de l'appli).
//    Distinct de brevo-inscription.js (liste 7, recettes/IG) : bulletin
//    différent, liste différente, même mécanique.
//  v1.1 (25/09/2026) : DIAGNOSTIC — ajout d'une réponse à une simple visite
//    (GET), pour vérifier facilement que ce fichier est bien pris en compte
//    par Cloudflare, et un message d'erreur qui dit précisément ce qui a
//    échoué au lieu d'un message générique.
// ============================================================
// functions/api/brevo-inscription-compagnon.js
// Route : /api/brevo-inscription-compagnon
// POST { prenom, email } -> inscrit le contact chez Brevo (liste 8)
//
// Nécessite, côté Cloudflare Pages (projet compagnon-sante) :
//  - la variable d'environnement "BREVO_API_KEY" (déjà créée pour
//    brevo-inscription.js — la même clé sert pour les deux fichiers)

const ID_LISTE_BREVO = 8; // "Abonnés Compagnon"

// v1.1 — simple visite (GET) : confirme que ce fichier est bien en ligne,
// et si la variable BREVO_API_KEY est bien déclarée (sans jamais l'afficher).
export async function onRequestGet(context) {
  return reponseJson({
    ok: true,
    fichier: "brevo-inscription-compagnon.js v1.1",
    cle_brevo_presente: !!context.env.BREVO_API_KEY
  });
}

function reponseJson(objet, statut) {
  return new Response(JSON.stringify(objet), {
    status: statut || 200,
    headers: { "Content-Type": "application/json" }
  });
}

function emailValide(email) {
  return typeof email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const cle = env.BREVO_API_KEY;
  if (!cle) {
    return reponseJson({
      error: "Configuration incomplète",
      detail: "La variable BREVO_API_KEY est absente côté Cloudflare"
    }, 500);
  }

  let corps;
  try {
    corps = await request.json();
  } catch (e) {
    return reponseJson({ error: "Format invalide" }, 400);
  }

  const prenom = (corps.prenom || "").toString().trim();
  const email = (corps.email || "").toString().trim();
  const optin = corps.optin === true;

  if (!prenom) return reponseJson({ error: "Le prénom est obligatoire" }, 400);
  if (!emailValide(email)) return reponseJson({ error: "L'adresse e-mail n'est pas valide" }, 400);
  if (!optin) return reponseJson({ error: "La case d'accord est obligatoire" }, 400);

  try {
    const reponseBrevo = await fetch("https://api.brevo.com/v3/contacts", {
      method: "POST",
      headers: {
        "api-key": cle,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        email: email,
        attributes: { PRENOM: prenom },
        listIds: [ID_LISTE_BREVO],
        updateEnabled: true
      })
    });

    if (reponseBrevo.status === 201 || reponseBrevo.status === 204) {
      return reponseJson({ ok: true });
    }

    const detail = await reponseBrevo.text();
    return reponseJson({ error: "Brevo a refusé l'inscription", detail }, 502);
  } catch (e) {
    return reponseJson({ error: "Impossible de contacter Brevo pour le moment" }, 502);
  }
}     
