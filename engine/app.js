// Orchestrateur : charge les données, connaît l'engine et pilote la progression.
// C'est le seul module qui connaît à la fois /data, /engine et (indirectement) /ui.

import { creerPersonnage, calculerScoreFinal, determinerTitre, construireResumeNarratif, creerEntreePantheon } from "./etat.js";
import { tirerProchainEvenement, appliquerChoix } from "./moteur.js";

const RANGS_MISSIONS = ["D", "C", "B", "A", "S"];

const CONFIG_ARCS = {
  academie: { seuil: 6, suivant: "examen_genin" },
  examen_genin: { seuil: 3, suivant: "missions" },
  missions: { seuilParRang: 2, suivant: "examen_chunin" },
  examen_chunin: { seuil: 3, suivant: "guerre" },
  guerre: { seuil: 8, suivant: "fin" },
};

const LABELS_ARCS = {
  academie: "Académie",
  examen_genin: "Examen Genin",
  missions: "Missions",
  examen_chunin: "Examen Chunin",
  guerre: "Guerre & Ombres",
  fin: "Fin de run",
};

const CATALOGUE_BADGES = [
  {
    id: "premiere_run",
    nom: "Premier Pas",
    description: "Terminer une première carrière, quelle que soit son issue.",
    condition: () => true,
  },
  {
    id: "score_eclatant",
    nom: "Parcours Éclatant",
    description: "Terminer une carrière avec un score de 90 ou plus.",
    condition: (etat, score) => score >= 90,
  },
  {
    id: "loyaute_inebranlable",
    nom: "Loyauté Inébranlable",
    description: "Terminer sans jamais trahir son équipe ni quitter le village.",
    condition: (etat) => !etat.drapeaux.a_trahi_son_equipe && !etat.drapeaux.a_quitte_le_village,
  },
  {
    id: "dans_lombre",
    nom: "Dans l'Ombre",
    description: "Rejoindre l'organisation secrète.",
    condition: (etat) => Boolean(etat.drapeaux.rejoint_organisation_secrete),
  },
  {
    id: "sauveur",
    nom: "Sauveur",
    description: "Sauver un village menacé durant une mission.",
    condition: (etat) => Boolean(etat.drapeaux.a_sauve_un_village),
  },
  {
    id: "lien_indefectible",
    nom: "Lien Indéfectible",
    description: "Tisser un lien fort avec son mentor et le préserver jusqu'au bout.",
    condition: (etat) => Boolean(etat.drapeaux.lien_fort_avec_mentor) && !etat.drapeaux.a_perdu_son_mentor,
  },
];

const DONNEES = { origines: null, academie: null, missions: null, examens: null, guerre: null };

let etatCourant = null;
let idsVus = new Set();

// État "meta" de session (mémoire uniquement, remis à zéro au rechargement de la page)
const pantheon = [];
const badgesDebloques = new Set();

async function chargerJson(chemin) {
  const reponse = await fetch(chemin);
  if (!reponse.ok) throw new Error(`Impossible de charger ${chemin} (${reponse.status})`);
  return reponse.json();
}

export async function chargerDonnees() {
  const [origines, academie, missions, examens, guerre] = await Promise.all([
    chargerJson("./data/origines.json"),
    chargerJson("./data/evenements-academie.json"),
    chargerJson("./data/evenements-missions.json"),
    chargerJson("./data/evenements-examens.json"),
    chargerJson("./data/evenements-guerre.json"),
  ]);
  Object.assign(DONNEES, { origines, academie, missions, examens, guerre });
  return DONNEES.origines;
}

export function obtenirOrigines() {
  return DONNEES.origines;
}

function datasetPourArc(arc) {
  switch (arc) {
    case "academie":
      return DONNEES.academie;
    case "examen_genin":
    case "examen_chunin":
      return DONNEES.examens;
    case "missions":
      return DONNEES.missions;
    case "guerre":
      return DONNEES.guerre;
    default:
      return [];
  }
}

function obtenirPool(etat) {
  const { arc, rangIndex } = etat.progression;
  const dataset = datasetPourArc(arc);
  if (arc === "missions") {
    const rang = RANGS_MISSIONS[rangIndex];
    return dataset.filter((ev) => ev.rang === rang);
  }
  return dataset.filter((ev) => ev.arc === arc);
}

function forcerProgressionSuivante(etat) {
  const p = etat.progression;
  if (p.arc === "missions") {
    p.rangIndex += 1;
    p.compteurRang = 0;
    if (p.rangIndex >= RANGS_MISSIONS.length) {
      p.arc = CONFIG_ARCS.missions.suivant;
      p.compteurArc = 0;
    }
  } else {
    p.arc = CONFIG_ARCS[p.arc]?.suivant ?? "fin";
    p.compteurArc = 0;
  }
}

function avancerProgression(etat) {
  const p = etat.progression;
  if (p.arc === "missions") {
    p.compteurRang += 1;
    if (p.compteurRang >= CONFIG_ARCS.missions.seuilParRang) {
      p.compteurRang = 0;
      p.rangIndex += 1;
      if (p.rangIndex >= RANGS_MISSIONS.length) {
        p.arc = CONFIG_ARCS.missions.suivant;
        p.compteurArc = 0;
      }
    }
  } else {
    p.compteurArc += 1;
    const config = CONFIG_ARCS[p.arc];
    if (config && p.compteurArc >= config.seuil) {
      p.arc = config.suivant;
      p.compteurArc = 0;
    }
  }
}

export function demarrerNouvellePartie(selection) {
  etatCourant = creerPersonnage(selection, DONNEES.origines);
  idsVus = new Set();
  return etatCourant;
}

export function obtenirEtatCourant() {
  return etatCourant;
}

export function obtenirLabelArc(arc) {
  return LABELS_ARCS[arc] ?? arc;
}

export function obtenirInfosProgression() {
  if (!etatCourant) return null;
  const { arc, rangIndex } = etatCourant.progression;
  return {
    arc,
    label: obtenirLabelArc(arc),
    rang: arc === "missions" ? RANGS_MISSIONS[rangIndex] : null,
  };
}

// Renvoie le prochain événement à afficher, ou null si la run est terminée.
export function obtenirEvenementCourant() {
  if (!etatCourant || etatCourant.progression.arc === "fin") return null;

  let garde = 0;
  while (garde < RANGS_MISSIONS.length + Object.keys(CONFIG_ARCS).length + 1) {
    const pool = obtenirPool(etatCourant);
    const evenement = tirerProchainEvenement(pool, etatCourant, idsVus);
    if (evenement) return evenement;

    // Filet de sécurité : si un pool venait à être épuisé, on avance quand même la progression
    forcerProgressionSuivante(etatCourant);
    if (etatCourant.progression.arc === "fin") return null;
    garde += 1;
  }
  return null;
}

export function choisir(evenement, choixId) {
  appliquerChoix(etatCourant, evenement, choixId);
  idsVus.add(evenement.id);
  avancerProgression(etatCourant);
  return {
    etat: etatCourant,
    termine: etatCourant.progression.arc === "fin",
  };
}

function evaluerBadges(etat, score, titre) {
  const nouveaux = [];
  for (const badge of CATALOGUE_BADGES) {
    if (badgesDebloques.has(badge.id)) continue;
    if (badge.condition(etat, score, titre)) {
      badgesDebloques.add(badge.id);
      nouveaux.push(badge);
    }
  }
  return nouveaux;
}

export function terminerRun() {
  const score = calculerScoreFinal(etatCourant);
  const titre = determinerTitre(etatCourant, score);
  const resume = construireResumeNarratif(etatCourant, score, titre);
  const entree = creerEntreePantheon(etatCourant, score, titre);

  pantheon.push(entree);
  pantheon.sort((a, b) => b.score - a.score);
  const badgesGagnes = evaluerBadges(etatCourant, score, titre);

  return { score, titre, resume, badgesGagnes };
}

export function obtenirPantheon() {
  return pantheon;
}

export function obtenirCatalogueBadges() {
  return CATALOGUE_BADGES;
}

export function obtenirBadgesDebloques() {
  return CATALOGUE_BADGES.filter((b) => badgesDebloques.has(b.id));
}
