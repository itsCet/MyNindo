# My Nindô — Chronique d'un ninja

Jeu web narratif de carrière : tu incarnes un jeune ninja depuis l'enfance jusqu'à la fin de sa
légende (Kage, déserteur, traître, sage errant...), à travers une succession d'événements à choix
multiples qui façonnent ses statistiques, sa réputation et son destin final. Univers, villages,
clans, PNJ et mythologie entièrement originaux — aucun nom ni personnage sous licence.

Une carrière complète dure 5 à 10 minutes (19 événements répartis sur 7 arcs).

Voir [spec.md](./spec.md) pour l'état détaillé des mécaniques et de l'architecture.

## Lancer le jeu en local

Le jeu est en HTML/CSS/JS vanilla, sans build tool. Mais comme il utilise des ES modules et
`fetch()` pour charger les données JSON, **ouvrir `index.html` directement dans le navigateur
(`file://...`) ne fonctionnera pas** (restriction CORS des navigateurs sur `file://`). Il faut le
servir via un petit serveur statique local :

```bash
npx serve .
# ou
python -m http.server 5500
```

Puis ouvrir l'URL indiquée (ex. `http://localhost:5500`).

## Structure du projet

```
index.html               point d'entrée unique
style.css                 design tokens, thèmes clair/sombre, fond shuriken, responsive
/assets                   logo + fonds d'écran (clair/sombre)
/data                     contenu du jeu (origines, PNJ, pools d'événements par arc), aucune logique
/engine                   logique pure (état du personnage, moteur d'événements, orchestration)
/ui                        affichage et transitions entre écrans (seul module qui touche le DOM)
```

## Mécaniques principales

- **7 arcs** : Enfance → Académie → Examen Genin → Missions (D à S) → Examen Chunin →
  Guerre & Ombres → Ascension → fin de run.
- **Voie ninja** : choix unique et définitif à l'entrée dans la Guerre (4 voies), donne un surnom
  affiché à l'écran de fin.
- **Choix risqués** : certains choix ont une vraie chance d'échec (mission ratée, technique qui
  se retourne contre toi...), pas juste un malus cosmétique.
- **50 PNJ originaux** tirés au sort par run (coéquipier, ami, instructeur, adversaire).
- **Score /100 + Rang S/A/B/C/F** combiné à un titre narratif (le rang mesure la compétence brute,
  le titre raconte l'histoire — un déserteur peut être Rang S).
- **Événements conditionnés** par clan, tempérament ou seuils de statistiques, pour que chaque
  combinaison de personnage vive une carrière différente.

## Contraintes importantes

- Aucune sauvegarde persistante (pas de `localStorage`/`sessionStorage`) : la progression, le
  panthéon et les badges vivent uniquement en mémoire le temps de la session, et sont perdus au
  rechargement de la page. C'est un choix de conception assumé, pas un bug.
- Mobile-first, testé à 375px et 1280px+, dark/light mode avec bascule manuelle.

## Déploiement

- Code source : [github.com/itsCet/MyNindo](https://github.com/itsCet/MyNindo)
- Déployé sur Vercel comme site statique (aucune configuration de build nécessaire), redéploiement
  automatique à chaque push sur `main` via l'intégration GitHub de Vercel.
