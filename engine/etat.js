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

  // Drapeaux d'archétype : posés une fois pour toutes à la création, ils permettent
  // à des événements de ne se déclencher que pour tel clan ou tel tempérament, pour
  // que chaque combinaison vive une carrière qui lui ressemble vraiment.
  const drapeaux = {};
  if (clan) drapeaux[`clan_${clan.id}`] = true;
  if (temperament) drapeaux[`temperament_${temperament.id}`] = true;
  if (village) drapeaux[`village_${village.id}`] = true;

  return {
    identite: {
      nom: selection.nom?.trim() || "Ninja sans nom",
      village: village?.nom ?? "Village inconnu",
      titreChefVillage: village?.titreChef ?? "chef du village",
      clan: clan?.nom ?? "Sans clan",
      affiniteChakra: affinite?.nom ?? "Affinité inconnue",
      temperament: temperament?.nom ?? "Tempérament inconnu",
      mentor: mentor?.nom ?? "Mentor inconnu",
    },
    stats,
    drapeaux,
    progression: {
      arc: "enfance",
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
  if (etat.drapeaux.a_cause_la_chute_du_village) bonus -= 25;
  if (etat.drapeaux.a_sabote_lorganisation) bonus += 5;
  if (etat.drapeaux.rejoint_clan_deserteur) bonus -= 8;
  if (etat.drapeaux.porte_un_sceau) bonus -= 3;
  if (etat.drapeaux.porte_technique_interdite) bonus -= 4;
  if (etat.drapeaux.a_paye_le_prix_de_nyxar) bonus -= 6;
  if (etat.drapeaux.rejoint_secte_vraxil) bonus -= 8;

  return clamp(score + bonus, 0, 100);
}

// Détermine le titre final ET une catégorie stable (utilisée pour les phrases de
// conclusion et les badges), à partir des drapeaux accumulés sur toute la carrière
// et du score final. L'ordre des vérifications fait office de priorité narrative.
export function determinerResolutionFinale(etat, score) {
  const d = etat.drapeaux;
  const { titreChefVillage, village } = etat.identite;

  if (d.a_cause_la_chute_du_village) {
    return { titre: "Le Village en Cendres", categorie: "villageEnCendres" };
  }
  if (d.a_trahi_son_equipe) {
    return { titre: "Ombre Reniée", categorie: "traitre" };
  }
  if (d.rejoint_organisation_secrete) {
    if (d.a_quitte_le_village) {
      return score >= 60
        ? { titre: "Lame de l'Ombre Repentie", categorie: "ombreRepentie" }
        : { titre: "Marionnette de l'Organisation", categorie: "marionnette" };
    }
    return { titre: "Agent Double de l'Ombre", categorie: "agentDouble" };
  }
  if (d.a_quitte_le_village) {
    return d.vise_liberte && etat.stats.controleEmotionnel >= 55
      ? { titre: "Sage Sans Village", categorie: "sageErrant" }
      : { titre: "Errant Sans Village", categorie: "errant" };
  }
  if (d.vise_kage) {
    if (score >= 70 && etat.stats.reputation >= 65 && etat.stats.loyaute >= 55) {
      return { titre: titreChefVillage, categorie: "kage" };
    }
    return { titre: "Candidat Écarté", categorie: "candidatEcarte" };
  }
  if (d.vise_bras_droit) {
    return score >= 65
      ? { titre: `Bras Droit du ${titreChefVillage}`, categorie: "brasDroit" }
      : { titre: "Conseiller de l'Ombre", categorie: "conseillerOmbre" };
  }
  if (d.vise_liberte) {
    return { titre: `Gardien Discret de ${village}`, categorie: "gardienDiscret" };
  }

  if (score >= 75) return { titre: "Légende Vivante", categorie: "legende" };
  if (score >= 62) return { titre: "Maître Reconnu", categorie: "maitreReconnu" };
  if (score >= 48) return { titre: "Jonin Accompli", categorie: "jonin" };
  if (score >= 32) return { titre: "Chunin Vétéran", categorie: "chuninVeteran" };
  return { titre: "Ninja Oublié", categorie: "oublie" };
}

// Rang de compétence brute (S/A/B/C/F), indépendant du titre narratif : un
// même score peut donner un déserteur de Rang S ou un Kage de Rang S. Reprend
// les mêmes seuils que les paliers de titre par défaut, pour rester cohérent.
export function determinerRang(score) {
  if (score >= 75) return { rang: "S", label: "Excellent" };
  if (score >= 62) return { rang: "A", label: "Très bon" };
  if (score >= 48) return { rang: "B", label: "Bon" };
  if (score >= 32) return { rang: "C", label: "Moyen" };
  return { rang: "F", label: "Échec" };
}

const PHRASES_CONCLUSION = {
  villageEnCendres: (nom, village) => `Les flammes qui ont englouti ${village} porteront à jamais la marque de ce choix.`,
  traitre: (nom) => `Le nom de ${nom} est aujourd'hui prononcé à voix basse, comme un avertissement.`,
  marionnette: (nom) => `${nom} sert une cause qui ne lui appartient plus vraiment.`,
  ombreRepentie: (nom) => `Entre l'ombre et la lumière, ${nom} a choisi de racheter ses choix, à sa manière.`,
  agentDouble: (nom) => `Personne, ni au village ni dans l'organisation, ne connaît vraiment la loyauté réelle de ${nom}.`,
  sageErrant: (nom) => `Libéré des titres, ${nom} continue d'enseigner sa voie à qui veut bien l'entendre.`,
  errant: (nom) => `${nom} n'a plus de toit, mais garde, envers et contre tout, sa propre voie.`,
  kage: (nom, village) => `Sous l'autorité de ${nom}, ${village} entre dans une nouvelle ère.`,
  candidatEcarte: (nom) => `Le conseil a préféré l'expérience à l'ambition — ${nom} devra reconquérir sa place.`,
  brasDroit: (nom, village) => `Dans l'ombre du pouvoir, ${nom} tient à ${village} des fils que peu de gens voient.`,
  conseillerOmbre: (nom, village) => `${nom} influence ${village} sans jamais en réclamer les honneurs.`,
  gardienDiscret: (nom, village) => `${nom} veille sur ${village} à sa manière, loin des titres et des honneurs.`,
  legende: (nom) => `Des générations de jeunes ninjas grandiront en rêvant de marcher dans les pas de ${nom}.`,
  maitreReconnu: (nom) => `${nom} a gagné le respect qu'aucun titre ne pouvait garantir.`,
  jonin: (nom, village) => `${nom} continue de servir ${village}, sans éclat mais sans faille.`,
  chuninVeteran: (nom) => `Le chemin de ${nom} n'est pas terminé, simplement plus incertain que prévu.`,
  oublie: (nom) => `L'histoire ne retiendra pas le nom de ${nom} — mais lui s'en souvient.`,
};

export function construireResumeNarratif(etat, score, resolution) {
  const { nom, village, clan, mentor } = etat.identite;
  const moments = etat.historique
    .filter((h) => h.resume)
    .slice(-5)
    .map((h) => `— ${h.resume}.`);

  const phraseConclusion = PHRASES_CONCLUSION[resolution.categorie]?.(nom, village) ?? "";
  const surnom = determinerSurnom(etat);

  const lignes = [
    `${nom}${surnom ? `, surnommé « ${surnom} »,` : ","} du village de ${village}${clan !== "Sans clan" ? ` et du ${clan}` : ""}, a suivi l'enseignement de ${mentor} avant de tracer sa propre voie.`,
    "Derniers moments marquants de son parcours :",
    ...moments,
    `Son parcours s'achève avec un score de ${score}/100, sous le titre : « ${resolution.titre} ».`,
    phraseConclusion,
  ].filter(Boolean);

  return lignes.join("\n");
}

// Surnom généré à partir de la voie ninja choisie en milieu de carrière (voir
// engine/app.js::choisirVoie). Reste `null` si aucune voie n'a été choisie.
const SURNOMS_VOIE = {
  voie_lame: (village) => `La Lame Silencieuse de ${village}`,
  voie_rempart: (village) => `Le Rempart de ${village}`,
  voie_eclat: (village) => `L'Éclat Stratège de ${village}`,
  voie_coeur: (village) => `Le Cœur Ardent de ${village}`,
};

export function determinerSurnom(etat) {
  const cleVoie = Object.keys(SURNOMS_VOIE).find((cle) => etat.drapeaux[cle]);
  return cleVoie ? SURNOMS_VOIE[cleVoie](etat.identite.village) : null;
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
