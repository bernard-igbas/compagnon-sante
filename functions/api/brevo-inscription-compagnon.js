// ============================================================
// compagnon-sante (brevo-inscription-compagnon.js) — v1.8 — 12/10/2026 — Validé par Bernard : EN ATTENTE
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
//    par Cloudflare (a permis de découvrir la vraie clé Brevo invalide).
//  v1.2 (26/09/2026) : ménage — la réponse de diagnostic (GET) est retirée,
//    son rôle est terminé.
//  v1.3 (12/10/2026) : LIENS D'AMBASSADEURS. Reçoit en plus un code
//    "ambassadeur" (envoyé par inscription.html v1.3), le range dans l'attribut
//    Brevo AMBASSADEUR du contact. Règles : la 1re attribution gagne (un contact
//    déjà rattaché à un ambassadeur n'est jamais réattribué) ; si l'attribut
//    n'existe pas encore chez Brevo, l'inscription est faite quand même, sans
//    le code, pour ne jamais bloquer un visiteur.
//  v1.4 (12/10/2026) : si l'attribut AMBASSADEUR n'existe pas chez Brevo, le
//    fichier le crée lui-même (type texte) puis réessaie ; plus besoin de le
//    créer à la main dans Brevo. Si la création échoue, l'inscription se fait
//    quand même, sans le code.
//  v1.5 (12/10/2026) : CORRECTIF. Brevo n'envoie PAS d'erreur quand on lui donne
//    un attribut qui n'existe pas : il l'ignore en silence (constaté au test du
//    12/10/2026, AMBASSADEUR absent de la fiche). La v1.4 attendait cette erreur
//    pour créer l'attribut, donc ne le créait jamais. Désormais, quand un code
//    ambassadeur est reçu, le fichier VÉRIFIE d'abord que l'attribut existe
//    (liste des attributs de Brevo) et le crée au besoin, avant d'inscrire.
//  v1.6 et v1.7 (12/10/2026) : DIAGNOSTIC temporaire (visite de l'adresse +
//    bloc "diag" dans la réponse). Test réel du 12/10/2026 réussi : le code
//    ambassadeur TEST-003 est accepté par Brevo (réponse 201) et la fiche
//    Essai3 apparaît dans le filtre AMBASSADEUR.
//  v1.8 (12/10/2026) : le diagnostic est retiré. Même fonctionnement que la
//    v1.5, sans aucune page de test ouverte au public.
// ============================================================
// functions/api/brevo-inscription-compagnon.js
// Route : /api/brevo-inscription-compagnon
// POST { prenom, email } -> inscrit le contact chez Brevo (liste 8)
//
// Nécessite, côté Cloudflare Pages (projet compagnon-sante) :
//  - la variable d'environnement "BREVO_API_KEY" (déjà créée pour
//    brevo-inscription.js — la même clé sert pour les deux fichiers)

const ID_LISTE_BREVO = 8; // "Abonnés Compagnon"

function reponseJson(objet, statut) {
  return new Response(JSON.stringify(objet), {
    status: statut || 200,
    headers: { "Content-Type": "application/json" }
  });
}

function codeAmbassadeurValide(code) {
  return typeof code === "string" && /^[A-Z0-9-]{3,24}$/.test(code);
}

async function envoyerAChezBrevo(cle, email, attributs) {
  return fetch("https://api.brevo.com/v3/contacts", {
    method: "POST",
    headers: {
      "api-key": cle,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      email: email,
      attributes: attributs,
      listIds: [ID_LISTE_BREVO],
      updateEnabled: true
    })
  });
}

async function assurerAttributAmbassadeur(cle) {
  try {
    const liste = await fetch("https://api.brevo.com/v3/contacts/attributes", {
      headers: { "api-key": cle, "Accept": "application/json" }
    });
    if (liste.status === 200) {
      const donnees = await liste.json();
      const existe = (donnees.attributes || []).some(function (a) {
        return (a.name || "").toUpperCase() === "AMBASSADEUR";
      });
      if (existe) return true;
    }
    const creation = await fetch("https://api.brevo.com/v3/contacts/attributes/normal/AMBASSADEUR", {
      method: "POST",
      headers: {
        "api-key": cle,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({ type: "text" })
    });
    return creation.status === 201 || creation.status === 204;
  } catch (e) {
    return false;
  }
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
  const codeBrut = (corps.ambassadeur || "").toString().trim().toUpperCase();
  const codeAmb = codeAmbassadeurValide(codeBrut) ? codeBrut : "";

  if (!prenom) return reponseJson({ error: "Le prénom est obligatoire" }, 400);
  if (!emailValide(email)) return reponseJson({ error: "L'adresse e-mail n'est pas valide" }, 400);
  if (!optin) return reponseJson({ error: "La case d'accord est obligatoire" }, 400);

  try {
    const attributs = { PRENOM: prenom };
    let codeAjoute = false;

    // 1re attribution gagne : on ne réattribue pas un contact déjà rattaché
    if (codeAmb) {
      let dejaRattache = false;
      try {
        const existant = await fetch("https://api.brevo.com/v3/contacts/" + encodeURIComponent(email), {
          headers: { "api-key": cle, "Accept": "application/json" }
        });
        if (existant.status === 200) {
          const contact = await existant.json();
          dejaRattache = !!(contact.attributes && contact.attributes.AMBASSADEUR);
        }
      } catch (e) { /* on continue sans cette vérification */ }
      if (!dejaRattache && await assurerAttributAmbassadeur(cle)) {
        attributs.AMBASSADEUR = codeAmb;
        codeAjoute = true;
      }
    }

    let reponseBrevo = await envoyerAChezBrevo(cle, email, attributs);

    // L'attribut AMBASSADEUR n'existe pas encore chez Brevo : on le crée, puis on réessaie
    if (reponseBrevo.status === 400 && codeAjoute) {
      let creee = false;
      try {
        const rc = await fetch("https://api.brevo.com/v3/contacts/attributes/normal/AMBASSADEUR", {
          method: "POST",
          headers: {
            "api-key": cle,
            "Content-Type": "application/json",
            "Accept": "application/json"
          },
          body: JSON.stringify({ type: "text" })
        });
        creee = (rc.status === 201 || rc.status === 204);
      } catch (e) { /* on passe au plan de secours */ }
      if (creee) {
        reponseBrevo = await envoyerAChezBrevo(cle, email, attributs);
      }
      // Plan de secours : l'inscription se fait quand même, sans le code
      if (!creee || reponseBrevo.status === 400) {
        delete attributs.AMBASSADEUR;
        codeAjoute = false;
        reponseBrevo = await envoyerAChezBrevo(cle, email, attributs);
      }
    }

    if (reponseBrevo.status === 201 || reponseBrevo.status === 204) {
      return reponseJson({ ok: true, ambassadeur_enregistre: codeAjoute });
    }

    const detail = await reponseBrevo.text();
    return reponseJson({ error: "Brevo a refusé l'inscription", detail }, 502);
  } catch (e) {
    return reponseJson({ error: "Impossible de contacter Brevo pour le moment" }, 502);
  }
}
