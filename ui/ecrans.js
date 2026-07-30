// Affichage et transitions entre écrans. Seul module autorisé à toucher le DOM.

import * as jeu from "../engine/app.js";
import { CLES_STATS, moyenneStats } from "../engine/etat.js";

const LABELS_STATS = {
  force: "Force",
  vitesse: "Vitesse",
  intelligence: "Intelligence",
  maitriseChakra: "Maîtrise du chakra",
  reputation: "Réputation",
  controleEmotionnel: "Contrôle émotionnel",
  loyaute: "Loyauté",
  sante: "Santé",
};

// Tonalité visuelle des étiquettes de choix (voir style.css : .etiquette-choix--*)
const TONS_ETIQUETTES = {
  Risqué: "chaude",
  Audacieux: "chaude",
  Impulsif: "chaude",
  Ambitieux: "chaude",
  Prudent: "froide",
  Discipliné: "froide",
  Calculé: "froide",
  Discret: "froide",
  Froid: "froide",
  Loyal: "loyal",
  Solitaire: "neutre",
};

let evenementCourant = null;
let runTermineeEnAttente = false;
let etapeEnAttente = null;
let voieEnAttente = false;
let statsVisibles = true;

function $(id) {
  return document.getElementById(id);
}

function afficherEcran(nomEcran) {
  document.querySelectorAll(".ecran").forEach((section) => {
    section.hidden = section.dataset.ecran !== nomEcran;
  });
  const ecranActif = document.querySelector(`.ecran[data-ecran="${nomEcran}"]`);
  ecranActif?.focus();
  window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
}

/* ---------- Thème ---------- */

function configurerTheme() {
  const racine = document.documentElement;
  const preferesClair = window.matchMedia?.("(prefers-color-scheme: light)").matches;
  racine.dataset.theme = preferesClair ? "light" : "dark";

  const bouton = $("bouton-theme");
  majBoutonTheme(bouton, racine.dataset.theme);

  bouton.addEventListener("click", () => {
    const nouveauTheme = racine.dataset.theme === "dark" ? "light" : "dark";
    racine.dataset.theme = nouveauTheme;
    majBoutonTheme(bouton, nouveauTheme);
  });
}

function majBoutonTheme(bouton, theme) {
  bouton.setAttribute("aria-pressed", String(theme === "light"));
  bouton.textContent = theme === "dark" ? "Thème clair" : "Thème sombre";
}

/* ---------- Création de personnage ---------- */

function creerGroupeOptions(nomChamp, items) {
  return items
    .map(
      (item, index) => `
      <label class="option-carte">
        <input type="radio" name="${nomChamp}" value="${item.id}" ${index === 0 ? "checked" : ""} required />
        <span class="option-carte__titre">${item.nom}</span>
        <span class="option-carte__desc">${item.description}</span>
      </label>`
    )
    .join("");
}

function rendreFormulaireCreation() {
  const origines = jeu.obtenirOrigines();

  $("groupe-village").querySelector(".grille-options").innerHTML = creerGroupeOptions("village", origines.villages);
  $("groupe-clan").querySelector(".grille-options").innerHTML = creerGroupeOptions("clan", origines.clans);
  $("groupe-affinite").querySelector(".grille-options").innerHTML = creerGroupeOptions(
    "affinite",
    origines.affinitesChakra
  );
  $("groupe-temperament").querySelector(".grille-options").innerHTML = creerGroupeOptions(
    "temperament",
    origines.temperaments
  );
  $("groupe-mentor").querySelector(".grille-options").innerHTML = creerGroupeOptions("mentor", origines.mentors);

  $("champ-nom").value = "";
}

// La création se déroule étape par étape (nom, village, clan, affinité,
// tempérament, mentor) plutôt que tout sur un seul écran à faire défiler.
const NB_ETAPES_CREATION = 6;
let etapeCreationCourante = 0;

function afficherEtapeCreation(index) {
  etapeCreationCourante = index;
  document.querySelectorAll(".etape-creation").forEach((el) => {
    el.hidden = Number(el.dataset.etape) !== index;
  });
  $("creation-progression").textContent = `Étape ${index + 1} / ${NB_ETAPES_CREATION}`;
  $("bouton-annuler-creation").hidden = index !== 0;
  $("bouton-etape-precedente").hidden = index === 0;
  $("bouton-etape-suivante").hidden = index === NB_ETAPES_CREATION - 1;
  $("bouton-valider-creation").hidden = index !== NB_ETAPES_CREATION - 1;
}

function gererEtapeSuivante() {
  if (etapeCreationCourante === 0 && !$("champ-nom").value.trim()) {
    $("champ-nom").reportValidity();
    return;
  }
  if (etapeCreationCourante < NB_ETAPES_CREATION - 1) afficherEtapeCreation(etapeCreationCourante + 1);
}

function gererEtapePrecedente() {
  if (etapeCreationCourante > 0) afficherEtapeCreation(etapeCreationCourante - 1);
}

function demarrerCreation() {
  rendreFormulaireCreation();
  afficherEtapeCreation(0);
  afficherEcran("creation");
}

function gererSoumissionCreation(evenement) {
  evenement.preventDefault();
  const donnees = new FormData(evenement.target);

  const selection = {
    nom: $("champ-nom").value,
    villageId: donnees.get("village"),
    clanId: donnees.get("clan"),
    affiniteId: donnees.get("affinite"),
    temperamentId: donnees.get("temperament"),
    mentorId: donnees.get("mentor"),
  };

  jeu.demarrerNouvellePartie(selection);
  afficherProchainEvenementOuFin();
}

/* ---------- Écran de jeu ---------- */

function rendreProgression() {
  const infos = jeu.obtenirInfosProgression();
  if (!infos) return;
  $("barre-progression").textContent = infos.rang ? `${infos.label} — Rang ${infos.rang}` : infos.label;
}

function basculerVisibiliteStats() {
  statsVisibles = !statsVisibles;
  rendreStats();
}

function rendreStats() {
  const etat = jeu.obtenirEtatCourant();
  const panneau = $("panneau-stats");
  panneau.innerHTML = "";

  const entete = document.createElement("div");
  entete.className = "panneau-stats__entete";

  const identite = document.createElement("div");
  const nom = document.createElement("h2");
  nom.className = "panneau-stats__nom";
  nom.textContent = etat.identite.nom;
  const sousTitre = document.createElement("p");
  sousTitre.className = "panneau-stats__sous-titre";
  sousTitre.textContent = `${etat.identite.village} · ${etat.identite.clan}`;
  identite.appendChild(nom);
  identite.appendChild(sousTitre);

  const boutonToggle = document.createElement("button");
  boutonToggle.type = "button";
  boutonToggle.className = "bouton-toggle-stats";
  boutonToggle.textContent = statsVisibles ? "Masquer" : "Détailler";
  boutonToggle.addEventListener("click", basculerVisibiliteStats);

  entete.appendChild(identite);
  entete.appendChild(boutonToggle);
  panneau.appendChild(entete);

  if (!statsVisibles) {
    const moyenne = Math.round(moyenneStats(etat));
    const boutonMoyenne = document.createElement("button");
    boutonMoyenne.type = "button";
    boutonMoyenne.className = "moyenne-stats";
    boutonMoyenne.innerHTML = `
      <span class="moyenne-stats__valeur">${moyenne}</span>
      <span class="moyenne-stats__label">Moyenne — appuie pour tout voir</span>
    `;
    boutonMoyenne.addEventListener("click", basculerVisibiliteStats);
    panneau.appendChild(boutonMoyenne);
    return;
  }

  for (const cle of CLES_STATS) {
    const valeur = etat.stats[cle];
    const ligne = document.createElement("div");
    ligne.className = "stat-ligne";
    ligne.innerHTML = `
      <div class="stat-ligne__entete">
        <span class="stat-ligne__label">${LABELS_STATS[cle]}</span>
        <span class="stat-ligne__valeur">${valeur}</span>
      </div>
      <span class="stat-barre" role="img" aria-label="${LABELS_STATS[cle]} : ${valeur} sur 100">
        <span class="stat-barre__remplissage" style="width:${valeur}%"></span>
      </span>
    `;
    panneau.appendChild(ligne);
  }
}

function rendreEcranJeu(evenement) {
  rendreProgression();
  rendreStats();

  $("texte-evenement").textContent = evenement.texte;
  $("badge-decisif").hidden = !evenement.decisif;

  $("zone-resultat").hidden = true;
  $("zone-etape").hidden = true;
  $("zone-voie").hidden = true;
  const liste = $("liste-choix");
  liste.hidden = false;
  liste.innerHTML = "";
  for (const choix of evenement.choix) {
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "bouton-choix";

    if (choix.tag) {
      const etiquette = document.createElement("span");
      const ton = TONS_ETIQUETTES[choix.tag] ?? "neutre";
      etiquette.className = `etiquette-choix etiquette-choix--${ton}`;
      etiquette.textContent = choix.tag;
      bouton.appendChild(etiquette);
    }

    const texte = document.createElement("span");
    texte.textContent = choix.texte;
    bouton.appendChild(texte);

    bouton.addEventListener("click", () => gererChoix(choix.id));
    liste.appendChild(bouton);
  }
}

function afficherProchainEvenementOuFin() {
  const evenement = jeu.obtenirEvenementCourant();
  if (!evenement) {
    conclureRun();
    return;
  }
  evenementCourant = evenement;
  rendreEcranJeu(evenement);
  afficherEcran("jeu");
}

function rendreBadgesEffets(effets = {}) {
  const conteneur = $("badges-effets");
  conteneur.innerHTML = "";

  for (const [cle, delta] of Object.entries(effets.stats ?? {})) {
    if (!delta) continue;
    const badge = document.createElement("span");
    const positif = delta > 0;
    badge.className = `badge-effet ${positif ? "badge-effet--positif" : "badge-effet--negatif"}`;
    badge.textContent = `${positif ? "+" : ""}${delta} ${LABELS_STATS[cle] ?? cle}`;
    conteneur.appendChild(badge);
  }
}

function gererChoix(choixId) {
  const { termine, etape, resultatChoix, voieProposee } = jeu.choisir(evenementCourant, choixId);
  runTermineeEnAttente = termine;
  etapeEnAttente = etape;
  voieEnAttente = voieProposee;

  rendreStats();
  $("liste-choix").hidden = true;

  const etiquetteIssue = $("etiquette-issue");
  etiquetteIssue.hidden = !resultatChoix.echec;

  $("texte-resultat").textContent = resultatChoix.resume
    ? `Ton personnage ${resultatChoix.resume}.`
    : resultatChoix.texte;
  rendreBadgesEffets(resultatChoix.effets);

  const zoneResultat = $("zone-resultat");
  zoneResultat.hidden = false;
  zoneResultat.focus?.();
}

function creerTuileEtape(valeur, label) {
  const tuile = document.createElement("div");
  tuile.className = "etape-tuile";
  tuile.innerHTML = `
    <span class="etape-tuile__valeur">${valeur}</span>
    <span class="etape-tuile__label">${label}</span>
  `;
  return tuile;
}

function rendreEtape(etape) {
  $("etape-badge").textContent = `Arc — ${etape.label}`;
  $("etape-titre-presse").textContent = etape.titrePresse ? `« ${etape.titrePresse} »` : "";
  $("etape-titre-presse").hidden = !etape.titrePresse;
  $("etape-citation").textContent = etape.citation ? `« ${etape.citation} »` : "";
  $("etape-citation").hidden = !etape.citation;

  const tuiles = $("etape-tuiles");
  tuiles.innerHTML = "";
  tuiles.appendChild(creerTuileEtape(etape.nbEvenements, "Événements"));
  tuiles.appendChild(
    creerTuileEtape(
      etape.meilleureStat ? `+${etape.meilleureStat.valeur}` : "—",
      etape.meilleureStat ? LABELS_STATS[etape.meilleureStat.cle] ?? etape.meilleureStat.cle : "Stat dominante"
    )
  );
  tuiles.appendChild(creerTuileEtape(etape.reputation, "Réputation"));
  tuiles.appendChild(creerTuileEtape(etape.sante, "Santé"));

  $("etape-jalon").textContent = etape.jalon;

  const moments = $("etape-moments");
  moments.innerHTML = "";
  for (const moment of etape.moments) {
    const p = document.createElement("p");
    p.textContent = `Ton personnage ${moment}.`;
    moments.appendChild(p);
  }

  $("etape-rival").textContent = etape.rival?.phrase ?? "";
  $("etape-rival").hidden = !etape.rival?.phrase;
}

function gererContinuer() {
  if (etapeEnAttente) {
    const etape = etapeEnAttente;
    etapeEnAttente = null;
    $("zone-resultat").hidden = true;
    rendreEtape(etape);
    const zoneEtape = $("zone-etape");
    zoneEtape.hidden = false;
    zoneEtape.focus?.();
    return;
  }
  if (voieEnAttente) {
    $("zone-resultat").hidden = true;
    afficherSelectionVoie();
    return;
  }
  if (runTermineeEnAttente) {
    conclureRun();
    return;
  }
  afficherProchainEvenementOuFin();
}

function gererContinuerEtape() {
  $("zone-etape").hidden = true;
  if (voieEnAttente) {
    afficherSelectionVoie();
    return;
  }
  if (runTermineeEnAttente) {
    conclureRun();
    return;
  }
  afficherProchainEvenementOuFin();
}

/* ---------- Voie ninja (choix unique, milieu de carrière) ---------- */

function afficherSelectionVoie() {
  const liste = $("liste-voies");
  liste.innerHTML = "";
  for (const voie of jeu.obtenirVoies()) {
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "carte-voie";
    bouton.innerHTML = `
      <span class="carte-voie__nom">${voie.nom}</span>
      <span class="carte-voie__desc">${voie.description}</span>
    `;
    bouton.addEventListener("click", () => gererChoixVoie(voie.id));
    liste.appendChild(bouton);
  }
  const zoneVoie = $("zone-voie");
  zoneVoie.hidden = false;
  zoneVoie.focus?.();
}

function gererChoixVoie(voieId) {
  jeu.choisirVoie(voieId);
  voieEnAttente = false;
  $("zone-voie").hidden = true;
  rendreStats();
  afficherProchainEvenementOuFin();
}

/* ---------- Fin de run ---------- */

function conclureRun() {
  const { score, titre, resume, badgesGagnes, surnom, rang } = jeu.terminerRun();

  const surnomEl = $("surnom-final");
  surnomEl.textContent = surnom ? `« ${surnom} »` : "";
  surnomEl.hidden = !surnom;

  $("rang-badge").innerHTML = `
    <span class="rang-badge__lettre">${rang.rang}</span>
    <span class="rang-badge__label">${rang.label}</span>
  `;

  $("titre-final").textContent = titre;
  $("score-final").textContent = `Score final : ${score} / 100`;
  $("resume-final").textContent = resume;

  const conteneurBadges = $("badges-nouveaux");
  conteneurBadges.innerHTML = "";
  if (badgesGagnes.length > 0) {
    const titreBadges = document.createElement("p");
    titreBadges.className = "badges-nouveaux__titre";
    titreBadges.textContent = "Nouveau(x) rouleau(x) débloqué(s) :";
    conteneurBadges.appendChild(titreBadges);

    for (const badge of badgesGagnes) {
      const ligne = document.createElement("p");
      ligne.className = "badge-ligne";
      ligne.textContent = `Rouleau — ${badge.nom} : ${badge.description}`;
      conteneurBadges.appendChild(ligne);
    }
  }

  afficherEcran("fin");
}

/* ---------- Badges & Panthéon ---------- */

function rendreBadges() {
  const catalogue = jeu.obtenirCatalogueBadges();
  const debloques = new Set(jeu.obtenirBadgesDebloques().map((b) => b.id));

  const liste = $("liste-badges");
  liste.innerHTML = "";

  for (const badge of catalogue) {
    const estDebloque = debloques.has(badge.id);
    const li = document.createElement("li");
    li.className = `badge-item ${estDebloque ? "badge-item--debloque" : "badge-item--verrouille"}`;
    li.innerHTML = `
      <span class="badge-item__nom">${badge.nom}</span>
      <span class="badge-item__desc">${estDebloque ? badge.description : "Rouleau encore verrouillé."}</span>
    `;
    liste.appendChild(li);
  }
}

function rendrePantheon() {
  const pantheon = jeu.obtenirPantheon();
  const liste = $("liste-pantheon");
  liste.innerHTML = "";

  if (pantheon.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Aucune carrière achevée pour l'instant durant cette session.";
    liste.appendChild(li);
    return;
  }

  for (const entree of pantheon) {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${entree.nom}</strong> (${entree.village}) — ${entree.titre} — ${entree.score}/100`;
    liste.appendChild(li);
  }
}

/* ---------- Erreur de chargement ---------- */

function afficherErreurChargement() {
  const accueil = $("ecran-accueil");
  accueil.innerHTML = `
    <h2>Impossible de charger le jeu</h2>
    <p>
      Les données du jeu n'ont pas pu être chargées. Si tu as ouvert ce fichier directement dans le
      navigateur (adresse commençant par <code>file://</code>), lance plutôt un petit serveur local
      (voir le README) puis recharge la page.
    </p>
  `;
}

/* ---------- Initialisation ---------- */

function configurerNavigation() {
  $("bouton-nouvelle-partie").addEventListener("click", demarrerCreation);
  $("bouton-rejouer").addEventListener("click", demarrerCreation);
  $("bouton-accueil-depuis-fin").addEventListener("click", () => afficherEcran("accueil"));

  $("bouton-voir-badges").addEventListener("click", () => {
    rendreBadges();
    afficherEcran("badges");
  });
  $("bouton-voir-pantheon").addEventListener("click", () => {
    rendrePantheon();
    afficherEcran("pantheon");
  });

  document.querySelectorAll("[data-retour]").forEach((bouton) => {
    bouton.addEventListener("click", () => afficherEcran(bouton.dataset.retour));
  });

  $("formulaire-creation").addEventListener("submit", gererSoumissionCreation);
  $("bouton-etape-suivante").addEventListener("click", gererEtapeSuivante);
  $("bouton-etape-precedente").addEventListener("click", gererEtapePrecedente);
  $("bouton-continuer").addEventListener("click", gererContinuer);
  $("bouton-continuer-etape").addEventListener("click", gererContinuerEtape);
}

export async function initialiser() {
  configurerTheme();
  configurerNavigation();

  try {
    await jeu.chargerDonnees();
  } catch (erreur) {
    console.error(erreur);
    afficherErreurChargement();
    return;
  }

  afficherEcran("accueil");
}
