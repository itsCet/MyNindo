# Spec — My Nindô, jeu narratif de carrière ninja (univers original)

Statut : **construit et déployé**. Ce document décrit l'état réel du jeu, pas une proposition —
il est mis à jour au fil des évolutions plutôt que de rester figé sur l'intention initiale.

## 1. Pitch

Un jeu narratif solo, 100% navigateur, où le joueur incarne un jeune ninja depuis l'enfance
jusqu'à la fin de sa carrière, à travers une succession d'événements textuels à choix multiples
qui façonnent ses statistiques, sa réputation et son destin final (Kage, bras droit, légende,
déserteur, traître, sage errant...). Une carrière complète dure 5 à 10 minutes.

Univers entièrement original : villages, clans, mythologie, PNJ et organisations inventés pour ce
projet. Aucun nom, lieu, personnage ou terme protégé d'un univers existant.

## 2. Boucle de gameplay

```
Création de personnage (6 étapes : nom, village, clan, affinité, tempérament, mentor)
   → Arc Enfance
   → Arc Académie
   → Examen Genin
   → Arcs Missions (rang D → S)
   → Examen Chunin
   → Arc Guerre & Ombres (voie ninja choisie ici, mythologie originale, organisation secrète)
   → Arc Ascension
   → Résolution finale (rang S/A/B/C/F + titre narratif + score/100 + surnom)
   → Écran de fin de run (résumé narratif personnalisé)
   → Rouleaux / Anciens Nindô (session en cours)
   → Rejouer
```

Chaque arc pioche dans un pool d'événements filtré par les conditions du personnage (stats,
drapeaux de clan/tempérament/village, drapeaux narratifs accumulés). Chaque événement propose 2 à
4 choix, certains tagués (Risqué, Prudent, Loyal...) et certains avec une vraie probabilité
d'échec. Un bilan façon presse s'affiche à chaque transition d'arc (citation, tuiles de stats,
mention du rival). Le jeu avance automatiquement d'arc en arc selon des seuils courts (2-3
événements par arc, 1 par rang en missions) pour tenir dans la durée cible.

## 3. Stack & contraintes techniques

- HTML5 / CSS3 / JavaScript vanilla, ES modules natifs (`<script type="module">`), aucun
  framework, aucun bundler.
- **Point d'attention dev** : les ES modules et le `fetch()` des fichiers JSON ne fonctionnent pas
  en ouvrant `index.html` directement en `file://` (restriction CORS des navigateurs). Un serveur
  statique local est nécessaire en développement (`npx serve`, `python -m http.server`...). Voir
  [README.md](./README.md).
- Aucune dépendance à `localStorage` / `sessionStorage`. Tout l'état (personnage en cours, rival
  simulé, panthéon, badges) vit en mémoire JavaScript (variables de module).
  - **Conséquence assumée** : un rechargement de page réinitialise entièrement la session. Rappelé
    dans le pied de page.
- Mobile-first, testé à 375px et 1280px+.
- Dark/light mode avec bascule manuelle, fond shuriken tuilé propre à chaque thème.

## 4. Architecture de fichiers

```
index.html
style.css
/assets/logo.png, background-light.png, background-dark.png
/data/origines.json              villages, clans, affinités, tempéraments, mentors
/data/personnages.json           50 PNJ originaux (prénom + nom), tirés au sort par run
/data/evenements-enfance.json
/data/evenements-academie.json
/data/evenements-missions.json
/data/evenements-examens.json    genin + chunin
/data/evenements-guerre.json     inclut la mythologie originale et la voie ninja
/data/evenements-ascension.json
/engine/etat.js                  état du personnage, score, résolution finale, rang, surnom
/engine/moteur.js                lecture des événements, conditions, application des effets/échecs
/engine/app.js                   orchestrateur (progression, PNJ, voies, badges, panthéon, rival)
/ui/ecrans.js                    affichage et transitions entre écrans (seul module qui touche le DOM)
```

Séparation stricte des responsabilités :
- `/data` = contenu pur (aucune logique)
- `/engine` = logique pure (aucune manipulation du DOM)
- `/ui` = affichage/DOM uniquement
- `app.js` est le seul fichier qui connaît les trois couches et les connecte.

## 5. Modèle de données — état du personnage

```js
{
  identite: { nom, village, titreChefVillage, clan, affiniteChakra, temperament, mentor, voie },
  stats: {
    force, vitesse, intelligence, maitriseChakra,
    reputation, controleEmotionnel, loyaute, sante   // 0–100
  },
  drapeaux: {
    // drapeaux d'archétype posés à la création : clan_<id>, temperament_<id>, village_<id>
    // drapeaux narratifs accumulés au fil des choix (extensibles par événement)
  },
  pnj: { coequipier, ami, instructeur, adversaire },  // noms tirés parmi les 50 PNJ
  rival: { nom, score },                               // trajectoire simulée, mise à jour à chaque bilan d'arc
  progression: { arc, compteurArc, rangIndex, compteurRang },
  historique: [ { eventId, choixId, resume, tag, effets, echec } ],
}
```

## 6. Schéma d'un événement (JSON)

```json
{
  "id": "gue_015",
  "arc": "guerre",
  "decisif": true,
  "conditions": { "drapeaux": {}, "statsMin": {}, "statsMax": {} },
  "texte": "... {{instructeur}} ... {{coequipier}} ... {{ami}} ... {{adversaire}} ...",
  "choix": [
    {
      "id": "a",
      "texte": "...",
      "tag": "Risqué",
      "risque": 0.35,
      "effets": { "stats": { "force": 2 }, "drapeaux": { "porte_technique_interdite": true } },
      "echec": { "resume": "...", "effets": { "stats": { "sante": -6 } } }
    }
  ]
}
```

- `decisif: true` affiche un badge "Moment décisif" sur la carte.
- `{{role}}` dans les textes est remplacé par le nom du PNJ correspondant tiré pour la run.
- `risque` + `echec` : un choix risqué peut réellement échouer et appliquer un résultat différent
  (pire) de celui affiché sur le bouton.

## 7. Écrans (`ui/ecrans.js`)

Accueil → Création (6 étapes) → Jeu (stats repliables + carte événement + résultat + bilan d'arc +
sélection de voie) → Fin de run (surnom, rang S/A/B/C/F, titre, résumé) → Rouleaux (badges) →
Anciens Nindô (panthéon de la session).

Transitions gérées par affichage/masquage de sections, sans router externe.

## 8. Scoring, rang et titres de fin

- **Score /100** = pondération des statistiques finales + bonus/malus liés aux drapeaux narratifs
  clés. Les trois moments héroïques (village sauvé, aide décisive, lien fort avec le mentor
  préservé) rapportent gros (+14/+8/+12) pour qu'un parcours vraiment exemplaire puisse viser le
  haut du barème.
- **Rang S/A/B/C/F** (seuils 90/75/55/35) : mesure la compétence brute, indépendante du titre.
- **Titre narratif** (13 catégories : Kage dynamique selon le village, Bras Droit, Légende
  Vivante, Errant Sans Village, Ombre Reniée, Le Village en Cendres...) : raconte l'histoire vécue.
  Les deux axes sont indépendants — un déserteur peut être Rang S.
- **Surnom** : généré par la voie ninja choisie (ex. « La Lame Silencieuse de Hono-gakure »).
- **Rival simulé** : mentionné dans les bilans d'arc (trajectoire propre), sans écran de
  comparaison dédié.

## 9. Guidelines de design

- Design tokens CSS : espacement en base 4px, typographie fluide via `clamp()`.
- Palette sombre par défaut : tons encre/charbon + accent chaud (braise) et accent froid (lueur de
  chakra). Pas de dégradé violet générique, pas de grille à colonnes identiques.
- Thème clair = variante lisible, contrastes AA. Fond shuriken tuilé propre à chaque thème.
- Toute l'interface tient en une seule colonne, y compris l'écran de jeu (stats au-dessus de la
  carte d'événement), pour rester digeste sur mobile comme sur desktop.
- Accessibilité de base : focus clavier toujours visible, navigation complète au clavier.

## 10. Meta-progression (session uniquement)

- **Rouleaux** (badges) débloqués pendant la session : Premier Pas, Parcours Éclatant, Loyauté
  Inébranlable, Dans l'Ombre, Sauveur, Lien Indéfectible, La Couronne, La Main de l'Ombre, Cendres,
  Héritage Interdit, Le Prix de Nyxar.
- **Anciens Nindô** (panthéon) = liste des runs de la session en cours, triée par score.
- Une couche méta persistante (boutique de jetons, quêtes du jour, streak) est envisagée mais pas
  construite : elle nécessiterait de lever la contrainte "aucun stockage", décision volontairement
  reportée.

## 11. Historique des grandes étapes

Construit en une seule session itérative à partir de ce spec initial : Milestone 1 (fondations),
Milestone 2 (boucle complète Missions/Examens/Guerre), Milestone 3 (méta, badges, polish) ont tous
été livrés, puis étendus bien au-delà du plan d'origine : arcs Enfance/Ascension, 50 PNJ nommés,
mécanique d'échec réelle, événements conditionnés par clan/tempérament/stats, voie ninja et
surnom, rival simulé, mythologie originale, rang S/A/B/C/F, réduction de la durée à 5-10 minutes,
recalibrage du score, refonte de la création en étapes successives, identité visuelle (logo, fonds
d'écran par thème).

## 12. Hors scope actuel

Pas de sauvegarde persistante (choix assumé), pas de multijoueur, pas de son/musique, pas de
boutique/quêtes/duels/mode histoire (nécessitent de statuer sur le stockage), contenu en français
uniquement.
