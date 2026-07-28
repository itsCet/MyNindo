// Moteur d'événements : lecture des pools, évaluation des conditions, application des choix.
// Aucune manipulation du DOM ici.

import { appliquerEffets } from "./etat.js";

export function evaluerConditions(etat, conditions = {}) {
  const { drapeaux = {}, statsMin = {}, statsMax = {} } = conditions;

  for (const [cle, valeurAttendue] of Object.entries(drapeaux)) {
    if (Boolean(etat.drapeaux[cle]) !== Boolean(valeurAttendue)) return false;
  }
  for (const [cle, min] of Object.entries(statsMin)) {
    if ((etat.stats[cle] ?? 0) < min) return false;
  }
  for (const [cle, max] of Object.entries(statsMax)) {
    if ((etat.stats[cle] ?? 0) > max) return false;
  }
  return true;
}

// pool : liste d'événements déjà filtrée par arc (et par rang le cas échéant)
export function filtrerEvenementsDisponibles(pool, etat, idsVus = new Set()) {
  return pool.filter((ev) => !idsVus.has(ev.id) && evaluerConditions(etat, ev.conditions));
}

export function tirerProchainEvenement(pool, etat, idsVus = new Set()) {
  const disponibles = filtrerEvenementsDisponibles(pool, etat, idsVus);
  if (disponibles.length === 0) return null;
  const index = Math.floor(Math.random() * disponibles.length);
  return disponibles[index];
}

// Un choix peut porter un champ "risque" (0-1) et un bloc "echec" (resume/texte/effets
// alternatifs). Si le tirage échoue, c'est le bloc "echec" qui s'applique à la place
// du résultat attendu — un choix risqué peut donc vraiment mal tourner.
export function appliquerChoix(etat, evenement, choixId) {
  const choix = evenement.choix.find((c) => c.id === choixId);
  if (!choix) throw new Error(`Choix inconnu "${choixId}" pour l'événement "${evenement.id}"`);

  const risque = choix.risque ?? 0;
  const echoue = risque > 0 && Math.random() < risque && Boolean(choix.echec);
  const resolu = echoue ? choix.echec : choix;

  appliquerEffets(etat, resolu.effets);
  etat.historique.push({
    eventId: evenement.id,
    choixId,
    resume: resolu.resume ?? resolu.texte ?? choix.texte,
    tag: echoue ? "Échec" : choix.tag ?? null,
    effets: resolu.effets ?? {},
    echec: echoue,
  });

  return { ...resolu, echec: echoue };
}
