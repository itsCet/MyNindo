# Spec — Jeu narratif de carrière ninja (univers original)

Statut : **proposition en attente de validation**. Aucun code n'a été écrit — seul ce document existe pour l'instant.

## 1. Pitch

Un jeu narratif solo, 100% navigateur, où le joueur incarne un jeune ninja depuis son entrée à l'Académie de son village jusqu'à la fin de sa carrière, à travers une succession d'événements textuels à choix multiples qui façonnent ses statistiques, sa réputation et son destin final (jonin, maître, légende, déchu...).

Univers entièrement original : villages, clans, techniques, personnages et organisations inventés pour ce projet. Aucun nom, lieu, personnage ou terme protégé d'un univers existant.

## 2. Boucle de gameplay

Mécanique inspirée de Destiny Eleven (inspiration de structure uniquement, pas de contenu ni de design repris) :

```
Création de personnage
   → Arc Académie
   → Examen Genin
   → Arcs Missions (rang D → S)
   → Examen Chunin
   → Escouade / mentor
   → Arc Guerre / organisation secrète
   → Résolution finale (rang + titre + score/100)
   → Écran de fin de run (résumé narratif personnalisé)
   → Panthéon / badges (session en cours)
   → Rejouer
```

Chaque étape puise dans un pool d'événements filtré par l'arc courant et par les conditions du personnage (stats, drapeaux). Chaque événement propose 2 à 4 choix, chacun avec des effets explicites sur les statistiques et/ou les drapeaux narratifs. Le jeu avance automatiquement d'arc en arc selon des seuils ou compteurs d'événements consommés.

## 3. Stack & contraintes techniques

- HTML5 / CSS3 / JavaScript vanilla, ES modules natifs (`<script type="module">`), aucun framework, aucun bundler.
- **Point d'attention dev** : les ES modules et le `fetch()` des fichiers JSON ne fonctionnent pas en ouvrant `index.html` directement en `file://` (restriction CORS des navigateurs). Ce n'est pas un build tool, mais un serveur statique local est nécessaire en développement (`npx serve`, extension "Live Server", `python -m http.server`, etc.). Ce point sera documenté dans un `README.md` court.
- Aucune dépendance à `localStorage` / `sessionStorage`. Tout l'état (personnage en cours, panthéon, badges) vit en mémoire JavaScript (variables de module).
  - **Conséquence assumée** : un rechargement de page réinitialise entièrement la session, y compris le panthéon et les badges débloqués. C'est une contrainte imposée, pas un oubli — elle sera rappelée dans l'UI (ex. petite mention discrète) pour éviter toute frustration du joueur.
- Mobile-first, testé à 375px et 1280px+.
- Dark/light mode avec bascule manuelle (pas seulement basé sur `prefers-color-scheme`, qui ne sert que de valeur par défaut initiale).

## 4. Architecture de fichiers

```
index.html
style.css
/data/origines.json
/data/evenements-academie.json
/data/evenements-missions.json
/data/evenements-examens.json
/data/evenements-guerre.json
/engine/etat.js         → état du personnage + progression
/engine/moteur.js        → lecture des événements, conditions, application des effets
/engine/app.js           → AJOUT proposé : orchestrateur (bootstrap, chargement des données,
                            initialisation de l'état, lancement de l'écran d'accueil)
/ui/ecrans.js            → affichage et transitions entre écrans
```

Séparation stricte des responsabilités :
- `/data` = contenu pur (aucune logique)
- `/engine` = logique pure (aucune manipulation du DOM)
- `/ui` = affichage/DOM uniquement
- `app.js` est le seul fichier qui connaît les trois couches et les connecte.

## 5. Modèle de données — état du personnage

```js
{
  identite: {
    nom, village, clan, affiniteChakra, temperament, mentor
  },
  stats: {
    force, vitesse, intelligence, maitriseChakra,
    reputation, controleEmotionnel, loyaute, sante   // 0–100
  },
  drapeaux: {
    a_perdu_son_mentor: false,
    a_quitte_le_village: false,
    rejoint_organisation_secrete: false,
    // ... extensible par arc
  },
  arc: "academie" | "examen_genin" | "missions" | "examen_chunin" | "escouade" | "guerre" | "fin",
  historique: [ { eventId, choixId, resume } ],   // alimente le résumé narratif final
  compteurArc: { missionsD: 0, missionsC: 0, ... }
}
```

## 6. Schéma d'un événement (JSON)

Commun aux 4 fichiers de `/data` :

```json
{
  "id": "aca_001",
  "arc": "academie",
  "conditions": { "drapeaux": {}, "statsMin": {}, "statsMax": {} },
  "texte": "...",
  "choix": [
    {
      "id": "a",
      "texte": "...",
      "effets": {
        "stats": { "force": 2, "reputation": -1 },
        "drapeaux": { "a_seche_un_cours": true }
      }
    }
  ]
}
```

`moteur.js` expose (a minima) :
- `filtrerEvenementsDisponibles(pool, etat)`
- `tirerProchainEvenement(pool, etat)`
- `appliquerChoix(etat, evenement, choixId)`
- `evaluerConditions(etat, conditions)`

## 7. Écrans (`ui/ecrans.js`)

Accueil → Création de personnage → Jeu (carte événement + panneau de statistiques) → Fin de run (résumé narratif + score/100 + titre) → Badges → Panthéon (runs de la session, triées par score).

Transitions gérées par affichage/masquage de sections dans `index.html`, sans router externe.

## 8. Scoring & titres de fin

Score sur 100 = pondération des statistiques finales + bonus/malus liés aux drapeaux narratifs clés + réputation. Une table de correspondance (seuils de score × drapeaux → titre, ex. "Légende du village", "Maître déchu", "Ombre errante") détermine le titre final. Table indicative en Milestone 1 (valeurs factices), finalisée en Milestone 2/3.

## 9. Guidelines de design

- Design tokens CSS : espacement en base 4px (4 / 8 / 12 / 16 / 24 / 32 / 48 / 64), typographie fluide via `clamp()`.
- Palette sombre par défaut : tons encre/charbon + un accent chaud ("braise") et un accent froid ("lueur de chakra"). Explicitement **pas** de dégradé violet générique, **pas** de grille à 3 colonnes identiques façon template IA.
- Thème clair = variante lisible avec contrastes conformes AA.
- Accessibilité de base : focus clavier toujours visible, navigation complète au clavier, alt text sur toute icône informative.
- Direction visuelle Milestone 1 (validée) : **100% texte + icônes SVG/CSS générées en interne**, aucun portrait ni asset bitmap. Une structure `/assets/` pourra être ajoutée plus tard si besoin, sans bloquer le code.

## 10. Meta-progression (session uniquement)

- Badges débloqués pendant la session courante (ex. premier run terminé, score > 90, tous les rangs testés au moins une fois).
- Panthéon = liste des runs de la session en cours, triée par score, réinitialisée au rechargement de page — cohérent avec la contrainte "pas de storage persistant".

## 11. Milestones

**Milestone 1 — Fondations jouables**
Écran d'accueil, création de personnage (village / clan / affinité de chakra / tempérament / mentor), moteur d'événements minimal, arc "Académie" jouable de bout en bout avec données factices (6 à 8 événements), écran de fin de run basique (score placeholder + titre générique), bascule dark/light, responsive 375px/1280px+, zéro dépendance externe.

**Milestone 2 — Boucle de carrière complète**
Arcs Missions (D → S), Examen Genin puis Chunin, Escouade/mentor, ensemble des drapeaux narratifs et des arcs spéciaux qu'ils déclenchent, résumé narratif personnalisé complet, table de titres finalisée, contenu texte définitif remplaçant les données factices du M1.

**Milestone 3 — Meta-progression & polish**
Arc Guerre/organisation secrète + rangs finaux multiples, système de badges complet, panthéon complet, passe d'accessibilité (contrastes, focus, navigation clavier), polish visuel final, relecture de tout le contenu narratif (originalité, absence de toute référence à un univers protégé).

## 12. Hors scope explicite

Pas de sauvegarde persistante (imposé par la stack), pas de multijoueur, pas de son/musique sauf demande contraire ultérieure, pas d'illustrations bitmap en Milestone 1, contenu en français uniquement (pas de traduction prévue).

---

*Prochaine étape (après validation de ce document) : rédaction du `todo.md` détaillé pour le Milestone 1 uniquement.*
