# Voie d'Ombre — Chronique d'un ninja

Jeu web narratif de carrière : tu incarnes un jeune ninja depuis son entrée à l'Académie jusqu'à
la fin de sa carrière, à travers une succession d'événements à choix multiples qui façonnent ses
statistiques, sa réputation et son destin final. Univers, villages, clans et personnages
entièrement originaux.

Voir [spec.md](./spec.md) pour la spécification complète (mécaniques, architecture, milestones).

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
index.html              point d'entrée unique
style.css                design tokens, thèmes clair/sombre, responsive
/data                    contenu du jeu (origines + pools d'événements par arc), aucune logique
/engine                  logique pure (état du personnage, moteur d'événements, orchestration)
/ui                       affichage et transitions entre écrans (seul module qui touche le DOM)
```

## Contraintes importantes

- Aucune sauvegarde persistante (pas de `localStorage`/`sessionStorage`) : la progression, le
  panthéon et les badges vivent uniquement en mémoire le temps de la session, et sont perdus au
  rechargement de la page. C'est un choix de conception assumé, pas un bug.
- Mobile-first, testé à 375px et 1280px+, dark/light mode avec bascule manuelle.

## Déploiement

Déployé sur Vercel comme site statique (aucune configuration de build nécessaire).
