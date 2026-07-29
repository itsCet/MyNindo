// Orchestrateur : charge les données, connaît l'engine et pilote la progression.
// C'est le seul module qui connaît à la fois /data, /engine et (indirectement) /ui.

import {
  creerPersonnage,
  calculerScoreFinal,
  determinerResolutionFinale,
  construireResumeNarratif,
  creerEntreePantheon,
  determinerSurnom,
  determinerVerdictRival,
  appliquerEffets,
  clamp,
} from "./etat.js";
import { tirerProchainEvenement, appliquerChoix } from "./moteur.js";

const RANGS_MISSIONS = ["D", "C", "B", "A", "S"];

const CONFIG_ARCS = {
  enfance: { seuil: 4, suivant: "academie" },
  academie: { seuil: 6, suivant: "examen_genin" },
  examen_genin: { seuil: 3, suivant: "missions" },
  missions: { seuilParRang: 2, suivant: "examen_chunin" },
  examen_chunin: { seuil: 3, suivant: "guerre" },
  guerre: { seuil: 8, suivant: "ascension" },
  ascension: { seuil: 4, suivant: "fin" },
};

const LABELS_ARCS = {
  enfance: "Enfance",
  academie: "Académie",
  examen_genin: "Examen Genin",
  missions: "Missions",
  examen_chunin: "Examen Chunin",
  guerre: "Guerre & Ombres",
  ascension: "Ascension",
  fin: "Fin de run",
};

const JALONS_ARCS = {
  enfance: "Premiers pas d'une future légende.",
  academie: "Académie achevée.",
  examen_genin: "Examen Genin réussi.",
  missions: "Missions accomplies, du rang D au rang S.",
  examen_chunin: "Examen Chunin réussi.",
  guerre: "Guerre traversée.",
  ascension: "Ton destin est scellé.",
};

// Voies ninja : choix unique proposé à l'entrée dans l'arc Guerre, qui octroie
// un bonus de stats marqué et détermine le surnom affiché à l'écran de fin.
const VOIES = [
  {
    id: "lame",
    nom: "Voie de la Lame Silencieuse",
    description: "Frapper vite et disparaître avant que l'adversaire ne comprenne ce qui s'est passé.",
    effets: { stats: { vitesse: 5, maitriseChakra: 5, reputation: -2 } },
  },
  {
    id: "rempart",
    nom: "Voie du Rempart",
    description: "Tenir la ligne, coûte que coûte, pour que les autres n'aient pas à le faire.",
    effets: { stats: { force: 5, sante: 5, loyaute: 2 } },
  },
  {
    id: "eclat",
    nom: "Voie de l'Éclat Stratège",
    description: "Gagner le combat avant même qu'il ne commence.",
    effets: { stats: { intelligence: 5, controleEmotionnel: 5 } },
  },
  {
    id: "coeur",
    nom: "Voie du Cœur Ardent",
    description: "Porter les autres par la seule force de sa conviction.",
    effets: { stats: { reputation: 5, loyaute: 5, controleEmotionnel: -2 } },
  },
];

const PHRASES_RIVAL_HAUSSE = [
  (nom) => `Pendant ce temps, ${nom} enchaîne les bons résultats.`,
  (nom) => `${nom} progresse aussi, saison après saison.`,
];

const PHRASES_RIVAL_BAISSE = [
  (nom) => `${nom}, de son côté, traverse une passe difficile.`,
  (nom) => `On raconte que ${nom} peine à confirmer, ces derniers temps.`,
];

function construirePhraseRival(nomRival, delta) {
  const banque = delta >= 0 ? PHRASES_RIVAL_HAUSSE : PHRASES_RIVAL_BAISSE;
  return banque[Math.floor(Math.random() * banque.length)](nomRival);
}

// Titres de presse dynamiques pour l'écran de bilan d'arc, choisis selon la
// tendance de réputation de la période écoulée (hausse / baisse / neutre).
const TITRES_PRESSE = {
  enfance: {
    hausse: (nom) => `Les premiers pas de ${nom} font déjà parler`,
    baisse: (nom) => `Une enfance discrète pour ${nom}`,
    neutre: (nom) => `${nom}, une enfance comme tant d'autres… pour l'instant`,
  },
  academie: {
    hausse: (nom) => `${nom} impressionne déjà à l'Académie`,
    baisse: (nom) => `Des débuts difficiles pour ${nom} à l'Académie`,
    neutre: (nom) => `${nom} trace sa route à l'Académie, sans éclat ni fausse note`,
  },
  examen_genin: {
    hausse: (nom) => `${nom} brille à l'examen Genin`,
    baisse: (nom) => `${nom} arrache son diplôme Genin dans la douleur`,
    neutre: (nom) => `${nom}, Genin comme les autres`,
  },
  missions: {
    hausse: (nom) => `De D à S : l'ascension fulgurante de ${nom}`,
    baisse: (nom) => `Missions difficiles : ${nom} traverse une zone de turbulences`,
    neutre: (nom) => `${nom} enchaîne les missions, sans surprise`,
  },
  examen_chunin: {
    hausse: (nom) => `${nom} impose sa loi à l'examen Chunin`,
    baisse: (nom) => `L'examen Chunin laisse des traces chez ${nom}`,
    neutre: (nom) => `${nom} décroche son grade de Chunin`,
  },
  guerre: {
    hausse: (nom) => `${nom} sort grandi du chaos de la guerre`,
    baisse: (nom) => `La guerre a laissé des cicatrices profondes chez ${nom}`,
    neutre: (nom) => `${nom} survit à la guerre, comme tant d'autres`,
  },
  ascension: {
    hausse: (nom) => `Le destin de ${nom} se dessine enfin`,
    baisse: (nom) => `${nom} entre dans le dernier chapitre, incertain`,
    neutre: (nom) => `${nom} approche du dénouement de son histoire`,
  },
};

function determinerTitrePresse(arc, nom, deltaReputation) {
  const banque = TITRES_PRESSE[arc];
  if (!banque) return null;
  const tendance = deltaReputation > 1 ? "hausse" : deltaReputation < -1 ? "baisse" : "neutre";
  return banque[tendance](nom);
}

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
  {
    id: "couronne_du_kage",
    nom: "La Couronne",
    description: "Devenir le Kage de son village.",
    condition: (etat, score, resolution) => resolution.categorie === "kage",
  },
  {
    id: "main_de_lombre",
    nom: "La Main de l'Ombre",
    description: "Devenir le bras droit du Kage.",
    condition: (etat, score, resolution) => resolution.categorie === "brasDroit",
  },
  {
    id: "cendres",
    nom: "Cendres",
    description: "Provoquer la chute de son propre village.",
    condition: (etat, score, resolution) => resolution.categorie === "villageEnCendres",
  },
];

const DONNEES = {
  origines: null,
  personnages: null,
  enfance: null,
  academie: null,
  missions: null,
  examens: null,
  guerre: null,
  ascension: null,
};

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
  const [origines, personnages, enfance, academie, missions, examens, guerre, ascension] = await Promise.all([
    chargerJson("./data/origines.json"),
    chargerJson("./data/personnages.json"),
    chargerJson("./data/evenements-enfance.json"),
    chargerJson("./data/evenements-academie.json"),
    chargerJson("./data/evenements-missions.json"),
    chargerJson("./data/evenements-examens.json"),
    chargerJson("./data/evenements-guerre.json"),
    chargerJson("./data/evenements-ascension.json"),
  ]);
  Object.assign(DONNEES, { origines, personnages, enfance, academie, missions, examens, guerre, ascension });
  return DONNEES.origines;
}

export function obtenirOrigines() {
  return DONNEES.origines;
}

function datasetPourArc(arc) {
  switch (arc) {
    case "enfance":
      return DONNEES.enfance;
    case "academie":
      return DONNEES.academie;
    case "examen_genin":
    case "examen_chunin":
      return DONNEES.examens;
    case "missions":
      return DONNEES.missions;
    case "guerre":
      return DONNEES.guerre;
    case "ascension":
      return DONNEES.ascension;
    default:
      return [];
  }
}

// Drapeau dérivé : calculé à la volée (idempotent) plutôt que stocké lors d'un
// événement précis, car il dépend de l'état cumulé de plusieurs arcs précédents.
function mettreAJourDrapeauxDerives(etat) {
  etat.drapeaux.exclu_du_conseil = Boolean(etat.drapeaux.a_trahi_son_equipe || etat.drapeaux.a_quitte_le_village);
}

function obtenirPool(etat) {
  const { arc, rangIndex } = etat.progression;
  const dataset = datasetPourArc(arc);
  if (arc === "missions") {
    const rang = RANGS_MISSIONS[rangIndex];
    return dataset.filter((ev) => ev.rang === rang);
  }
  if (arc === "ascension") {
    mettreAJourDrapeauxDerives(etat);
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

// Tire des noms de PNJ distincts, sans remise, pour cette run.
function tirerNomsAleatoires(nombre) {
  const pool = [...(DONNEES.personnages?.noms ?? [])];
  const tires = [];
  for (let i = 0; i < nombre && pool.length > 0; i++) {
    const index = Math.floor(Math.random() * pool.length);
    const personnage = pool.splice(index, 1)[0];
    tires.push(`${personnage.prenom} ${personnage.nom}`);
  }
  return tires;
}

export function demarrerNouvellePartie(selection) {
  etatCourant = creerPersonnage(selection, DONNEES.origines);
  const [coequipier, ami, instructeur, adversaire] = tirerNomsAleatoires(4);
  etatCourant.pnj = { coequipier, ami, instructeur, adversaire };
  // Le rival de génération suit sa propre trajectoire simulée tout au long de la run.
  etatCourant.rival = { nom: adversaire, score: 50 };
  idsVus = new Set();
  return etatCourant;
}

// Remplace les jetons {{role}} d'un texte par le nom de PNJ tiré pour cette run.
function substituerPnj(texte, etat) {
  if (!texte) return texte;
  const pnj = etat.pnj ?? {};
  return texte
    .replaceAll("{{coequipier}}", pnj.coequipier ?? "ton équipier")
    .replaceAll("{{ami}}", pnj.ami ?? "ta camarade")
    .replaceAll("{{instructeur}}", pnj.instructeur ?? "un instructeur")
    .replaceAll("{{adversaire}}", pnj.adversaire ?? "un adversaire");
}

function substituerEvenement(evenement, etat) {
  return {
    ...evenement,
    texte: substituerPnj(evenement.texte, etat),
    choix: evenement.choix.map((choix) => ({
      ...choix,
      texte: substituerPnj(choix.texte, etat),
      resume: substituerPnj(choix.resume, etat),
    })),
  };
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
    if (evenement) return substituerEvenement(evenement, etatCourant);

    // Filet de sécurité : si un pool venait à être épuisé, on avance quand même la progression
    forcerProgressionSuivante(etatCourant);
    if (etatCourant.progression.arc === "fin") return null;
    garde += 1;
  }
  return null;
}

function obtenirTailleArc(arc) {
  if (arc === "missions") return CONFIG_ARCS.missions.seuilParRang * RANGS_MISSIONS.length;
  return CONFIG_ARCS[arc]?.seuil ?? 0;
}

// Bilan affiché une fois qu'un arc entier vient d'être bouclé (pas à chaque choix).
function construireBilanArc(etat, arcTermine, tailleArc) {
  const entrees = etat.historique.slice(-tailleArc);

  const totaux = {};
  for (const entree of entrees) {
    for (const [cle, delta] of Object.entries(entree.effets?.stats ?? {})) {
      totaux[cle] = (totaux[cle] ?? 0) + delta;
    }
  }

  // Réputation et santé ont déjà leur propre tuile dédiée : on cherche la
  // meilleure progression parmi les autres statistiques pour éviter les doublons.
  let meilleureStat = null;
  for (const [cle, valeur] of Object.entries(totaux)) {
    if (cle === "reputation" || cle === "sante") continue;
    if (valeur > 0 && (!meilleureStat || valeur > meilleureStat.valeur)) {
      meilleureStat = { cle, valeur };
    }
  }

  const entreeTaguee = [...entrees].reverse().find((e) => e.tag);
  const entreeCitation = entreeTaguee ?? entrees[entrees.length - 1] ?? null;

  const momentsRecents = entrees
    .filter((e) => e.resume && e.resume !== entreeCitation?.resume)
    .map((e) => e.resume)
    .slice(-2);

  const deltaRival = Math.round(Math.random() * 12) - 3; // -3 à +8 : le rival progresse un peu plus souvent qu'il ne recule
  etat.rival.score = clamp(etat.rival.score + deltaRival, 0, 100);

  return {
    arc: arcTermine,
    label: obtenirLabelArc(arcTermine),
    jalon: JALONS_ARCS[arcTermine] ?? "",
    titrePresse: determinerTitrePresse(arcTermine, etat.identite.nom, totaux.reputation ?? 0),
    nbEvenements: entrees.length,
    meilleureStat,
    reputation: etat.stats.reputation,
    sante: etat.stats.sante,
    citation: entreeCitation?.resume ?? null,
    moments: momentsRecents,
    rival: { nom: etat.rival.nom, phrase: construirePhraseRival(etat.rival.nom, deltaRival) },
  };
}

export function choisir(evenement, choixId) {
  const arcAvant = etatCourant.progression.arc;
  const tailleArcAvant = obtenirTailleArc(arcAvant);

  const resultatChoix = appliquerChoix(etatCourant, evenement, choixId);
  idsVus.add(evenement.id);
  avancerProgression(etatCourant);

  const arcApres = etatCourant.progression.arc;
  const etape = arcApres !== arcAvant && arcApres !== "fin" ? construireBilanArc(etatCourant, arcAvant, tailleArcAvant) : null;

  return {
    etat: etatCourant,
    termine: arcApres === "fin",
    etape,
    resultatChoix,
    // La voie ninja se choisit une fois pour toutes à l'entrée dans la Guerre.
    voieProposee: arcAvant === "examen_chunin" && arcApres === "guerre",
  };
}

export function obtenirVoies() {
  return VOIES;
}

export function choisirVoie(voieId) {
  const voie = VOIES.find((v) => v.id === voieId);
  if (!voie || !etatCourant) return;
  appliquerEffets(etatCourant, voie.effets);
  etatCourant.drapeaux[`voie_${voieId}`] = true;
  etatCourant.identite.voie = voie.nom;
}

function evaluerBadges(etat, score, resolution) {
  const nouveaux = [];
  for (const badge of CATALOGUE_BADGES) {
    if (badgesDebloques.has(badge.id)) continue;
    if (badge.condition(etat, score, resolution)) {
      badgesDebloques.add(badge.id);
      nouveaux.push(badge);
    }
  }
  return nouveaux;
}

export function terminerRun() {
  const score = calculerScoreFinal(etatCourant);
  const resolution = determinerResolutionFinale(etatCourant, score);
  const resume = construireResumeNarratif(etatCourant, score, resolution);
  const entree = creerEntreePantheon(etatCourant, score, resolution.titre);

  pantheon.push(entree);
  pantheon.sort((a, b) => b.score - a.score);
  const badgesGagnes = evaluerBadges(etatCourant, score, resolution);

  const rival = etatCourant.rival && {
    nom: etatCourant.rival.nom,
    score: etatCourant.rival.score,
    verdict: determinerVerdictRival(score, etatCourant.rival.score, etatCourant.identite.nom, etatCourant.rival.nom),
  };

  return { score, titre: resolution.titre, resume, badgesGagnes, surnom: determinerSurnom(etatCourant), rival };
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
