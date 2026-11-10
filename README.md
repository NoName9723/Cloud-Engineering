# NEXORA — Cloud Engineering

Site vitrine multipage de démonstration autour du Cloud Engineering et du Platform Engineering.

## Pages
- `index.html` — accueil et présentation générale
- `expertise.html` — domaines d'expertise et méthode
- `solutions.html` — détail des prestations et livrables
- `architecture.html` — architecture de référence et onglets interactifs
- `technologies.html` — panorama des technologies
- `company.html` — approche et principes
- `lab.html` — campagne interactive Cloud Incident Lab
- `contact.html` — formulaire avec validation côté navigateur
- `404.html` — page d'erreur personnalisée

## Cloud Incident Lab
Campagne pédagogique en six incidents liés au même service :
1. Corriger un Deployment Kubernetes (labels, readiness probe, port).
2. Réparer le routage NGINX et l'upstream applicatif.
3. Corriger une configuration Terraform de stockage (chiffrement, versioning, rétention).
4. Réparer un workflow GitHub Actions (tests avant déploiement).
5. Remettre en état l'Horizontal Pod Autoscaler (cible, bornes et seuil CPU).
6. Réécrire une fonction JavaScript de readiness pour qu'elle retourne un état HTTP cohérent avec ses dépendances.

Le joueur dispose d'un éditeur de code, d'un terminal de commandes simulées, d'une suite de 24 tests de code et de configuration, d'un journal d'événements et d'un déploiement verrouillé tant que tous les tests ne passent pas. La progression est sauvegardée localement dans le navigateur.

**Sécurité et limites :** le terminal n'exécute aucune commande système. Le code écrit dans l'éditeur n'est pas exécuté comme JavaScript et n'est envoyé à aucun serveur. Les validateurs vérifient des règles pédagogiques déterministes sur le texte des fichiers. La simulation ne provisionne aucune ressource cloud réelle et les résultats sont fictifs.

## Technologies
HTML5, CSS3, JavaScript natif et illustrations vectorielles SVG. Aucun framework ni étape de compilation n'est requis. Les illustrations réseau et exploitation cloud sont des schémas conceptuels créés pour ce site ; les adresses IP sont des exemples.

## Tests automatisés
GitHub Actions exécute automatiquement :
- `node --check script.js` pour vérifier la syntaxe JavaScript ;
- `node tests/site-check.mjs` pour contrôler la présence des pages, les liens internes, les ressources locales et la structure attendue du Cloud Lab ;
- `node tests/cloud-lab.test.mjs` pour vérifier que les six configurations de départ échouent comme prévu et que les réparations de référence passent les 24 contrôles.

Le workflow se déclenche à chaque push et pull request vers `main`.

## Publication
Le site est conçu pour GitHub Pages : dépôt public, branche `main`, dossier `/(root)`.

## Limites connues
Le formulaire de contact est uniquement front-end : aucune donnée n'est transmise ni stockée. Pour recevoir des demandes, connecter un service de formulaire ou une API backend. NEXORA est une marque fictive utilisée pour la démonstration ; les contenus techniques illustrent des pratiques générales et ne constituent pas des références clients.
