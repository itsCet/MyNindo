// Gestion de l'état du personnage et de la progression de carrière.
// Aucune manipulation du DOM ici : uniquement des données et des fonctions pures/mutatrices d'état.

export const CLES_STATS = [
  "force",
  "vitesse",
  "intelligence",
  "maitriseChakra",
  "reputation",
  "controleEmotionnel",
  "loyaute",
  "sante",
];

const STAT_DE_BASE = 45;

export function clamp(valeur, min = 0, max = 100) {
  return Math.min(max, Math.max(min, valeur));
}

function statsDeBase() {
  const stats = {};
  for (const cle of CLES_STATS) stats[cle] = STAT_DE_BASE;
  return stats;
}

function appliquerBonusStats(stats, bonus = {}) {
  for (const [cle, valeur] of Object.entries(bonus)) {
    if (!(cle in stats)) continue;
    stats[cle] = clamp(stats[cle] + valeur);
  }
}

// selection = { nom, villageId, clanId, affiniteId, temperamentId, mentorId }
export function creerPersonnage(selection, origines) {
  const village = origines.villages.find((v) => v.id === selection.villageId);
  const clan = origines.clans.find((c) => c.id === selection.clanId);
  const affinite = origines.affinitesChakra.find((a) => a.id === selection.affiniteId);
  const temperament = origines.temperaments.find((t) => t.id === selection.temperamentId);
  const mentor = origines.mentors.find((m) => m.id === selection.mentorId);

  const stats = statsDeBase();
  for (const origine of [village, clan, affinite, temperament, mentor]) {
    if (origine) appliquerBonusStats(stats, origine.bonus);
  }

  return {
    identite: {
      nom: selection.nom?.trim() || "Ninja sans nom",
      village: village?.nom ?? "Village inconnu",
      clan: clan?.nom ?? "Sans clan",
      affiniteChakra: affinite?.nom ?? "Affinité inconnue",
      temperament: temperament?.nom ?? "Tempérament inconnu",
      mentor: mentor?.nom ?? "Mentor inconnu",
    },
    stats,
    drapeaux: {},
    progression: {
      arc: "academie",
      compteurArc: 0,
      rangIndex: 0,
      compteurRang: 0,
    },
    historique: [],
  };
}

export function appliquerEffets(etat, effets = {}) {
  const { stats = {}, drapeaux = {} } = effets;
  for (const [cle, delta] of Object.entries(stats)) {
    if (!(cle in etat.stats)) continue;
    etat.stats[cle] = clamp(etat.stats[cle] + delta);
  }
  for (const [cle, valeur] of Object.entries(drapeaux)) {
    etat.drapeaux[cle] = valeur;
  }
}

export function moyenneStats(etat) {
  const total = CLES_STATS.reduce((somme, cle) => somme + etat.stats[cle], 0);
  return total / CLES_STATS.length;
}

export function calculerScoreFinal(etat) {
  let score = Math.round(moyenneStats(etat) * 0.7); // jusqu'à 70 points sur la forme du personnage
  let bonus = 20; // socle de base pour qu'un parcours honnête reste dans une fourchette lisible

  if (etat.drapeaux.a_sauve_un_village) bonus += 8;
  if (etat.drapeaux.a_aide_un_camarade) bonus += 4;
  if (etat.drapeaux.lien_fort_avec_mentor) bonus += 6;
  if (etat.drapeaux.a_trahi_son_equipe) bonus -= 15;
  if (etat.drapeaux.a_quitte_le_village) bonus -= 10;
  if (etat.drapeaux.rejoint_organisation_secrete) bonus -= 6;
  if (etat.drapeaux.a_perdu_son_mentor) bonus -= 4;

  return clamp(score + bonus, 0, 100);
}

export function determinerTitre(etat, score) {
  const d = etat.drapeaux;

  if (d.a_trahi_son_equipe) return "Ombre Reniée";
  if (d.a_quitte_le_village && !d.rejoint_organisation_secrete) return "Errant Sans Village";
  if (d.rejoint_organisation_secrete) {
    return score >= 60 ? "Lame de l'Ombre Repentie" : "Marionnette de l'Organisation";
  }
  if (score >= 90) return "Légende Vivante";
  if (score >= 75) return "Maître Reconnu";
  if (score >= 55) return "Jonin Accompli";
  if (score >= 35) return "Chunin Vétéran";
  return "Ninja Oublié";
}

export function construireResumeNarratif(etat, score, titre) {
  const { nom, village, clan, mentor } = etat.identite;
  const moments = etat.historique
    .filter((h) => h.resume)
    .slice(-5)
    .map((h) => `— ${h.resume}.`);

  const lignes = [
    `${nom}, du village de ${village}${clan !== "Sans clan" ? ` et du ${clan}` : ""}, a suivi l'enseignement de ${mentor} avant de tracer sa propre voie.`,
    "Derniers moments marquants de son parcours :",
    ...moments,
    `Son parcours s'achève avec un score de ${score}/100, sous le titre : « ${titre} ».`,
  ];

  return lignes.join("\n");
}

export function creerEntreePantheon(etat, score, titre) {
  return {
    nom: etat.identite.nom,
    village: etat.identite.village,
    titre,
    score,
    horodatage: Date.now(),
  };
}
