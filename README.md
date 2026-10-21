# Calendrier de l'avent entre amis

## Objectif

Créer un site privé de calendrier de l'avent pour Louisa, Orléane et Thomas. Chaque personne se connecte avec son propre identifiant et son mot de passe, et dispose d'un calendrier et d'un contenu qui lui sont propres. Le site comprend un frontend, une API et une petite base de données.

L'application **Les petits jours** est implémentée dans ce dossier. Le cahier des charges
ci-dessous est conservé comme référence ; le guide de démarrage et d'exploitation suit.

## Démarrage et exploitation

### Organisation

```text
src/Advent.Domain          Entités et règles de date Europe/Paris
src/Advent.Application     Requests/handlers MediatR, validation, contrats, Unit of Work
src/Advent.Infrastructure  EF Core SQL Server, sessions, hachage, accès aux données
src/Advent.Api             Endpoints minces, cookies, anti-CSRF, limitation, CLI privée
database/                 Projet SQL SDK/SSDT et scripts de déploiement → DACPAC
frontend/                 React + TypeScript + Vite, illustrations et autocollants
content/                  72 propositions de textes et notes de préparation
tests/Advent.Tests        Tests métier et tests HTTP avec un vrai SQL Server
deploy/                   Dockerfiles, reverse proxy, déploiement et sauvegardes
```

Décisions de la première version :

- Les 24 cadeaux sont suspendus à une grande girlande continue et irrégulière qui descend
  dans la page. Son tracé s'adapte aux petits écrans, sans changer l'ordre des jours,
  les états des cadeaux ni la navigation au clavier.
- Première ouverture enregistrée ; relecture et appels concurrents ne changent pas sa date.
- Gestion des contenus par CLI et fichier JSON privé, ou par l'éditeur web **réservé à l'atelier local**.
  Le panneau de comptes est réservé aux administrateurs et reste disponible en Production.
- Les 72 textes fournis sont des **brouillons à relire**, sans souvenir personnel inventé.
  `reviewed: true` est requis sur chaque texte avant une publication explicite.
- Une phrase décorative varie de façon pseudo-aléatoire **par personne et date de Paris**.
  Le contenu des cases et les autocollants restent fixes, sauf correction volontaire de l'administrateur.
  La connexion choisit une petite légende aléatoire à chaque visite ; le calendrier et la fenêtre
  de surprise affichent la phrase quotidienne, sans modifier le contenu principal.
- Pas d'inscription publique, d'upload public, de contenu HTML ni de média distant.
  Les catégories `blague`, `anecdote`, `activite`, `surprise` peuvent contenir du texte,
  des citations, des images, des vidéos et de l'audio.

### Prérequis pour lancer l'API directement

.NET SDK 10, Node.js 24, SQL Server 2019 ou plus récent (Express convient).
Les outils SQL sont restaurés localement, sans installation globale.

### Préparation initiale

À effectuer une seule fois, depuis la racine, dans PowerShell :

```powershell
dotnet tool restore
dotnet build .\Advent.slnx
dotnet sqlpackage /Action:Publish /SourceFile:".\database\bin\Debug\Advent.Database.dacpac" /TargetConnectionString:"Server=.\SQLEXPRESS;Database=Advent2026;Integrated Security=True;Encrypt=True;TrustServerCertificate=True" /p:BlockOnPossibleDataLoss=True
dotnet user-secrets set "ConnectionStrings:Advent" "Server=.\SQLEXPRESS;Database=Advent2026;Integrated Security=True;Encrypt=True;TrustServerCertificate=True" --project .\src\Advent.Api
npm ci --prefix .\frontend
```

### Démarrage quotidien

Depuis la racine, ouvrez deux terminaux :

```powershell
dotnet run --project .\src\Advent.Api
```

```powershell
npm run dev
```

Le script `npm run dev` à la racine démarre Vite dans `frontend/`.
Frontend : <http://127.0.0.1:5173> ; API : <http://localhost:5080>.
Vite relaie `/api` vers l'API : aucune configuration CORS permissive n'est nécessaire.
`/health` vérifie SQL et les comptes ; `/openapi/v1.json` n'existe qu'en développement.
Après le déploiement du schéma SQL, le démarrage local de l'API crée l'administrateur s'il n'existe
aucun compte, ou configure le compte `admin` inactif semé par le post-deploy. Connexion :
`admin@localhost.test` / `Advent2026!Local`. Ces identifiants sont réservés au développement ;
changez-les ensuite dans **Administration**. Les identifiants sont conservés aux redémarrages.
Le fichier [Advent.http](./Advent.http) décrit les requêtes, y compris le renouvellement anti-CSRF.

### Démarrer toute l'application avec Docker

Docker Desktop avec Compose v2 suffit ; aucun SQL Server n'a besoin d'être installé sur l'hôte.
Depuis la racine du dépôt :

```powershell
docker compose up --build
```

Ouvrir <http://localhost:8080>. Au premier démarrage, Compose construit les images, génère les
identifiants SQL aléatoires dans un volume Docker local, publie le schéma, crée le compte SQL
applicatif à permissions limitées et active automatiquement l'administrateur local. Connectez-vous
avec `admin@localhost.test` / `Advent2026!Local`. Ces identifiants sont réservés au développement :
ne les utilisez jamais en production. Pour les personnaliser, définissez `LOCAL_ADMIN_EMAIL` et
`LOCAL_ADMIN_PASSWORD` avant le lancement. Les données persistent dans les volumes ;
`docker compose down -v` les supprime.

Les trois comptes du calendrier restent désactivés jusqu'à la définition de leurs mots de passe.
Pour en activer un depuis PowerShell, saisir un mot de passe temporairement sans le mettre dans
le Compose :

```powershell
$secret = Read-Host "Nouveau mot de passe (14 caractères minimum)" -AsSecureString
$env:ADVENT_PASSWORD = [System.Net.NetworkCredential]::new("", $secret).Password
try {
    docker compose run --rm -e ADVENT_PASSWORD api admin set-password louisa
} finally {
    Remove-Item Env:\ADVENT_PASSWORD
}
```

Répéter pour `orleane` et `thomas` si nécessaire. Les comptes n'ont pas de mot de passe par défaut.

La chaîne intégrée ci-dessus ne contient aucun secret. Pour une autre instance, utiliser
`ConnectionStrings__Advent` ou les secrets utilisateur .NET. Ne jamais ajouter un mot de passe
à un fichier versionné. En dehors de `dotnet run`, définir la variable d'environnement :
les secrets utilisateur ne sont chargés qu'en environnement `Development`.

### Comptes

Le DACPAC initialise `louisa`, `orleane` et `thomas`, **désactivés et sans mot de passe ni email**.
Il est idempotent : un redéploiement ne réinitialise ni les comptes, ni les contenus, ni les ouvertures.
Les noms affichés sont Louisa, Orléane et Thomas.

Le DACPAC initialise également le compte `admin`, désactivé tant que le provisionnement ne l'a pas
activé avec les identifiants fournis. Le Compose local effectue cette étape automatiquement.
La connexion se fait par email et mot de passe. Les sessions sont conservées dans un cookie
HttpOnly sécurisé pendant 30 jours (aucun jeton d'authentification en localStorage). Les comptes
historiques doivent recevoir un email dans le panneau avant leur connexion par le site.

En production, configurez `INITIAL_ADMIN_EMAIL` et `INITIAL_ADMIN_PASSWORD` comme secrets
d'environnement avant le premier provisionnement (`docker compose -f compose.production.yaml
--profile tools run --rm provision`). Aucun identifiant de production n'est fourni par défaut.
Le compte initial est configuré une seule fois ; les redéploiements ne remplacent pas ses
identifiants. Pour promouvoir ensuite un autre compte, la commande reste disponible :

```powershell
dotnet .\src\Advent.Api\bin\Debug\net10.0\Advent.Api.dll admin promote-admin louisa louisa@example.com
$secret = Read-Host "Nouveau mot de passe (14 caractères minimum)" -AsSecureString
$env:ADVENT_PASSWORD = [System.Net.NetworkCredential]::new("", $secret).Password
try {
    dotnet .\src\Advent.Api\bin\Debug\net10.0\Advent.Api.dll admin set-password louisa
} finally {
    Remove-Item Env:\ADVENT_PASSWORD
}
```

Connectez-vous ensuite, puis utilisez **Administration** pour renseigner les emails des comptes
historiques, créer de nouveaux comptes, modifier les coordonnées, définir un mot de passe ou
désactiver un compte. L’onglet **Cadeaux** permet de choisir une personne et un jour, puis de
composer, enregistrer en brouillon ou publier son cadeau. Les changements de mot de passe et la
désactivation révoquent les sessions. Un compte peut aussi être supprimé définitivement :
ses cadeaux, médias, sessions et jetons de réinitialisation sont supprimés en cascade. Le panneau
empêche de supprimer son propre compte ou le dernier administrateur actif.
Le panneau ne permet pas de promouvoir un autre administrateur ; cette opération reste réservée
à la CLI `admin promote-admin <identifiant> <email>`.

Les liens « mot de passe oublié » sont envoyés par SMTP. En production, renseigner `SMTP_HOST`,
`SMTP_PORT`, `SMTP_ENABLE_SSL`, `SMTP_USERNAME`, `SMTP_PASSWORD` et `SMTP_FROM_ADDRESS` dans
l'environnement du déploiement (ainsi que `SMTP_FROM_NAME` si souhaité). Le lien utilise l'URL
publique définie depuis `SITE_DOMAIN`. En développement, configurer les mêmes paramètres via
les secrets utilisateur .NET ou des variables d'environnement, et définir `PasswordReset:BaseUrl`
sur l'adresse du frontend local. Sans SMTP valide, l'API indique explicitement que la réinitialisation
n'est pas disponible. Les secrets SMTP restent hors du dépôt.

La CLI utilise la même configuration SQL que l'API. À la racine :

```powershell
$env:ConnectionStrings__Advent = "Server=.\SQLEXPRESS;Database=Advent2026;Integrated Security=True;Encrypt=True;TrustServerCertificate=True"
$secret = Read-Host "Nouveau mot de passe (14 caractères minimum)" -AsSecureString
$env:ADVENT_PASSWORD = [System.Net.NetworkCredential]::new("", $secret).Password
try {
    dotnet .\src\Advent.Api\bin\Debug\net10.0\Advent.Api.dll admin set-password louisa
} finally {
    Remove-Item Env:\ADVENT_PASSWORD
}
```

Répéter pour les autres identifiants avec des mots de passe différents, transmis séparément
aux destinataires. `set-password` active le compte et révoque toutes ses sessions.
`admin disable orleane` le désactive et révoque également ses sessions.
Aucun mot de passe de production par défaut n'est livré.

### Préparation et publication

1. Copier [content/calendar.2026.json](./content/calendar.2026.json) dans un dossier `private`
   local non versionné. Les exemples contiennent 24 textes différents par personne.
2. Modifier `title`, `text`, `kind` et éventuellement `sticker`. Les `notes` servent uniquement
   à la rédaction : elles ne sont ni enregistrées dans la base ni envoyées au navigateur.
3. Après relecture, marquer chaque texte concerné `reviewed: true`.
4. Importer explicitement le fichier :

```powershell
# Brouillon : non consultable par les destinataires
dotnet .\src\Advent.Api\bin\Debug\net10.0\Advent.Api.dll admin import .\private\calendar.2026.json
# Publication : refusée si l'un des 72 textes n'est pas marqué relu
dotnet .\src\Advent.Api\bin\Debug\net10.0\Advent.Api.dll admin import .\private\calendar.2026.json --publish
```

Les chemins ci-dessus sont relatifs au terminal car la DLL est lancée directement.
Avec `dotnet run --project`, utiliser un chemin **absolu** vers le JSON.

L'import exige exactement les trois personnes et les jours 1 à 24 sans doublon. Il est
validé intégralement avant écriture, puis enregistré en une seule transaction EF Core.
Un nouvel import corrige les textes sans effacer les ouvertures. **Importer sans `--publish`
remet les 72 contenus en brouillon**, même s'ils étaient déjà publiés.
L'API répond alors 404 avec un message « en préparation » sans enregistrer d'ouverture.
Le fichier privé n'est jamais copié dans les images Docker ou le bundle frontend.

### Atelier local : composer et prévisualiser les cadeaux

En environnement **Development**, connecte-toi puis clique sur **« Prévisualiser les 24 cases »**.
Le bandeau « Mode atelier — lecture seule » indique clairement que tu ne regardes pas le calendrier réel.

- Toutes les cases de la personne connectée sont accessibles, même futures ou non publiées.
- La surprise porte une indication **Brouillon non publié** ou **Publié**.
- Les boutons Précédent/Suivant parcourent les 24 cases ; **Actualiser le contenu** recharge la base.
- La prévisualisation ne modifie aucune ouverture, date, publication ou progression.
- **Revenir au calendrier réel** retrouve les vrais verrouillages et états d'ouverture.
- Pour travailler sur une autre personne, déconnecte-toi puis connecte-toi à son compte :
  ce mode ne donne jamais accès au calendrier d'un autre utilisateur.

Dans une surprise, clique sur **Composer ce cadeau** :

1. Renseigne le titre et le message (jusqu'à 50 000 caractères, avec conservation des paragraphes).
2. Ajoute jusqu'à 20 blocs **Texte**, **Citation**, **Image**, **Vidéo** ou **Audio**.
   Les blocs se déplacent avec les flèches ; une citation peut être signée.
3. Importe les fichiers et renseigne leurs descriptions/légendes.
4. **Voir le rendu** affiche la composition sans l'enregistrer ni la publier.
5. **Enregistrer le brouillon** conserve le travail dans SQL, séparément de la version publiée.
6. Après relecture et vérification des médias, coche la confirmation puis clique sur
   **Publier ce cadeau**. La date de déverrouillage et la première ouverture restent inchangées.

Il est possible de composer une case encore absente. Quitter un cadeau modifié demande confirmation ;
un import ou un enregistrement en cours bloque la fermeture. Les erreurs restent visibles sans effacer la saisie.
Les vidéos et audios utilisent les lecteurs natifs, sans lecture automatique. Les vidéos WebM/MP4
doivent utiliser un codec pris en charge par les navigateurs destinataires (par exemple MP4 H.264/AAC).

| Média | Formats | Taille maximale par fichier |
|---|---|---|
| Image | JPG, PNG, WebP, GIF | 10 Mo |
| Vidéo | MP4, WebM | 50 Mo |
| Audio | MP3, WAV, OGG | 50 Mo |

Les fichiers sont stockés dans **CalendarMedia**, dans la même base SQL que les cadeaux :
les sauvegardes/restaurations existantes les incluent. Aucun fichier privé ne va dans le frontend,
un répertoire public ou un service tiers. Chaque média appartient à une personne et à un jour ;
sa lecture réelle exige une session, un cadeau publié et une date déverrouillée. Le serveur accepte
les requêtes Range pour les lecteurs. Retirer/remplacer un bloc ne supprime pas immédiatement le fichier
importé de SQL, afin de préserver une éventuelle version publiée. Sur SQL Server Express, surveiller
la taille de la base (limite de 10 Go) et privilégier des clips courts compressés.

L'éditeur enregistre **dans SQL, pas dans le JSON source**. L'import CLI reste disponible :
modifier le JSON → `admin import <chemin>` → **Actualiser le contenu**.
**Réimporter le JSON remplace les compositions publiées et efface les brouillons de l'éditeur** pour les
cases importées. Ne pas réimporter une ancienne version après un travail dans l'interface.
Pour transférer ces créations vers une autre instance, utiliser la sauvegarde/restauration SQL,
en suivant les précautions de remplacement de base décrites plus bas.

Le mode est activé dans `appsettings.Development.json` par `Preview:Enabled`.
Pour le désactiver localement, définir `Preview__Enabled=false` puis redémarrer l'API.
**En Production et Staging, aucune route `/api/preview/*` (lecture, édition ou import) n'est enregistrée,
même si ce paramètre vaut `true`**. Le bouton dépend de la capacité annoncée par l'API,
pas d'un paramètre Vite ou d'une date du navigateur. Ne jamais exposer l'environnement Development
aux destinataires ; la stack locale Docker l'utilise pour l'atelier, tandis que
`compose.production.yaml` démarre l'API en Production.

### Dates et protection des sessions

- Aucune horloge de démonstration ni route de déverrouillage n'existe dans la production.
  Avant le 1er décembre 2026, les 24 cadeaux sont donc normalement verrouillés.
- Les ouvertures sont autorisées exclusivement par l'API à partir de minuit `Europe/Paris`.
  Elles restent disponibles après Noël, même l'année suivante.
- PBKDF2-SHA256, 600 000 itérations et sel aléatoire par mot de passe.
- Sessions opaques aléatoires de 256 bits ; seul leur SHA-256 est stocké dans SQL.
  Expiration absolue de 30 jours, cookie HttpOnly, SameSite Strict, Secure en production.
- Session contrôlée en base à chaque requête privée. Déconnexion effective côté serveur.
- Anti-CSRF sur **tous** les POST et PUT, y compris connexion, édition et import.
  Obtenir un nouveau jeton après connexion.
- Connexion limitée à 5 requêtes/minute/adresse IP et 30/15 minutes pour l'application.
  Les compteurs sont en mémoire : déployer une seule instance API pour cette petite application.
  Ne pas utiliser un redémarrage comme stratégie de réinitialisation en exploitation.
- Aucun propriétaire fourni par le navigateur n'est utilisé. `/api/calendar` désigne toujours
  le compte identifié par la session. Les états de la grille ne contiennent aucun texte de surprise.
- En cas d'erreur, réponses Problem Details sans secret ; les problèmes internes portent un identifiant
  de trace. Le client affiche chargement, préparation, panne réseau et expiration de session.

### Autocollants

Les 24 WebP de 300 × 300 dans [frontend/public/stickers](./frontend/public/stickers)
conservent la transparence et utilisent des noms stables :

| Ligne source | Expressions, de gauche à droite |
|---|---|
| 1 | sourire, clin-oeil, rire, surprise, sceptique, bisou |
| 2 | langue, bouderie, grrr, reflexion, lunettes-noires, baiser |
| 3 | chapeau, joues-gonflees, chut, grimace, pikachu, larmes |
| 4 | lunettes-bleues, burger, malice, mousse, cri, zen |

La propriété `sticker` de chaque texte définit l'association personne/jour ; aucune attribution
ne change à l'actualisation. La [planche de contrôle](./frontend/public/stickers/contact-sheet.webp)
permet de vérifier les 24 exports. Régénération : `npm run assets` depuis `frontend`.
Le script conserve le canal alpha, supprime les fragments voisins et sépare manuellement
le contact entre la main « reflexion » et la tête « grimace ». Les contours qui se touchent
dans l'original sont donc légèrement retouchés ; la source elle-même reste intacte.

### Tests

```powershell
dotnet build .\database\Advent.Database.sqlproj
dotnet tool restore
dotnet test .\tests\Advent.Tests --logger trx
Set-Location .\frontend
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Les tests .NET utilisent xUnit/VSTest. Les tests d'intégration créent et suppriment uniquement une
base `AdventTest_<GUID>`, déployée deux fois par DACPAC pour vérifier l'idempotence.
Par défaut ils utilisent `.\SQLEXPRESS` avec authentification intégrée. Pour une autre instance,
définir `ADVENT_TEST_SQL` avec une connexion autorisée à créer une base (jamais une base de production).
Les tests sans SQL se lancent avec `--filter "Category!=Integration"`.

Les parcours Playwright desktop/mobile utilisent des réponses API contrôlées en décembre :
ils testent l'interface indépendamment de la date réelle. Les tests HTTP .NET, eux, utilisent
le véritable SQL Server et vérifient les droits, dates, brouillons, sessions, concurrence et relectures.

Un test de production facultatif, `.\tests\smoke-compose.ps1`, construit et démarre un projet Docker
jetable `advent-smoke-<id>` sur le port local 18080. Il vérifie HTTP, connexion, cookies,
anti-CSRF, persistance des sessions et sauvegarde/restauration SQL, puis supprime **uniquement**
ses conteneurs et volumes. Il nécessite Docker, Node et plusieurs Go de mémoire libre. Il ne faut
pas le lancer en parallèle d'une pile utilisant déjà le sous-réseau `172.29.216.0/24`.

### Production : Debian / Proxmox

La configuration de déploiement est dans `compose.production.yaml`. La commande `docker compose up`
à la racine utilise la stack locale de développement décrite plus haut.

Prévoir une machine **x86-64**, idéalement au moins 4 Go de RAM, Docker Engine et Compose v2.
Dans un LXC Debian, vérifier nesting, cgroups, stockage et permissions nécessaires à Docker ;
utiliser une VM si la configuration LXC empêche le démarrage fiable de SQL Server.
Le choix de SQL Server Express évite de déployer une licence Developer en production.

Paramètres à injecter dans l'environnement du serveur ou son gestionnaire de secrets :

| Variable | Valeur attendue |
|---|---|
| `SITE_DOMAIN` | Nom DNS du site, pointant vers le serveur |
| `MSSQL_SA_PASSWORD` | Secret d'administration SQL, fort et unique |
| `APP_DB_PASSWORD` | Autre secret SQL, 24 à 128 caractères |
| `INITIAL_ADMIN_EMAIL` | Email du premier administrateur, requis au premier déploiement |
| `INITIAL_ADMIN_PASSWORD` | Mot de passe du premier administrateur (14 caractères minimum) |

Générer les deux secrets indépendamment avec `openssl rand -hex 32` évite les caractères
spéciaux des chaînes de connexion et de l'interpolation Compose. Ne jamais stocker ces valeurs
dans le dépôt ou dans une image. Le fichier d'exemple d'environnement n'est pas fourni,
sa création étant bloquée par la politique de contenu de l'organisation.

Depuis la racine du projet sur Debian :

```sh
sh deploy/deploy.sh
```

Le script construit les images, attend SQL, publie le DACPAC, crée le login SQL `advent_app`
avec **uniquement SELECT/INSERT/UPDATE/DELETE sur les trois tables**, puis démarre les services.
L'API n'utilise jamais le compte `sa`. Le secret d'administration sert aux tâches ponctuelles.
`schema` et `provision` sont des services du profil `tools`, sans redémarrage automatique :
aucune migration ou publication de schéma n'a lieu au redémarrage de l'API.

Le proxy Caddy sert le domaine en HTTP sur le port hôte 8081. Dans NPM, configurer ce port
comme cible HTTP du proxy host ; NPM conserve la terminaison TLS publique sur les ports 80/443.
Limiter l'accès au port 8081 aux connexions provenant de NPM avec le pare-feu de l'hôte si possible.
SQL et l'API ne publient aucun port sur l'hôte ; SQL est sur le réseau interne `data`.
Le proxy a l'adresse fixe `172.29.216.10`, seule adresse Docker autorisée à transmettre
les en-têtes d'IP et de protocole. En cas de conflit de sous-réseau, modifier **ensemble**
le réseau Compose, cette adresse et `Proxy__Address`.

Les volumes `sql-data`, `api-keys`, `caddy-data` et `caddy-config` persistent après redémarrage.
Les clés anti-CSRF dans `api-keys` sont protégées par les permissions du volume ;
chiffrer le stockage hôte si nécessaire. Ne pas lancer `docker compose down -v` en production.

Pour administrer après déploiement, exporter temporairement `ADVENT_PASSWORD`, puis :

```sh
docker compose -f compose.production.yaml run --rm -e ADVENT_PASSWORD api admin set-password louisa
unset ADVENT_PASSWORD
docker compose -f compose.production.yaml run --rm -v /chemin/prive/calendar.2026.json:/content.json:ro api admin import /content.json --publish
docker compose -f compose.production.yaml ps
docker compose -f compose.production.yaml logs --tail 100 api
```

Ne pas placer les contenus sous un répertoire servi par le frontend. Restreindre l'accès SSH
et Docker : un administrateur Docker a, par nature, accès aux variables secrètes des conteneurs.
SqlPackage reçoit son mot de passe en argument à l'intérieur du conteneur ponctuel de déploiement ;
ne pas activer de traçage shell `set -x`.

### Sauvegarde, restauration et mises à jour

1. Planifier quotidiennement `sh deploy/backup.sh /chemin/vers/sauvegardes`.
   Le script exécute `BACKUP DATABASE ... COPY_ONLY, CHECKSUM`, puis `RESTORE VERIFYONLY`.
   Il copie le `.bak` **hors du conteneur**, avec permissions restrictives.
2. Copier les sauvegardes chiffrées vers **un autre hôte** ; appliquer une rétention, par exemple
   7 quotidiennes et 4 hebdomadaires. Cette destination et ce transfert sont à configurer sur le serveur.
3. Sauvegarder également les secrets de déploiement et les volumes des clés/proxy par le mécanisme
   sécurisé de l'hôte. Un snapshot Proxmox seul ne remplace pas une sauvegarde SQL cohérente.
4. Pour restaurer sur la même installation : `sh deploy/restore.sh /chemin/sauvegarde.bak --confirm-replace`.
   Cette commande **remplace la base**, après arrêt API/proxy, et rétablit les droits du login applicatif.
   En cas d'échec, les services restent arrêtés : consulter l'erreur avant de les relancer.
5. Sur une nouvelle machine : installer la même pile, restaurer les secrets, déployer d'abord le schéma vide,
   puis restaurer le `.bak` dans le service SQL. Les sauvegardes prévues ici viennent du même agencement
   de fichiers SQL Docker ; pour un `.bak` externe, adapter `RESTORE ... WITH MOVE` aux noms logiques.
6. Tester régulièrement une restauration sur une installation isolée. Éviter les sauvegardes simultanées :
   le fichier de transit dans SQL a un nom fixe.

Avant une mise à jour : sauvegarder, relire le changement de schéma, puis relancer le script
de déploiement. `BlockOnPossibleDataLoss=True` refuse les transformations potentiellement destructives.
Ne pas ajouter de migrations EF Core concurrentes au `.sqlproj`.

---

## Cahier des charges de référence

## Fonctionnement attendu

- Le calendrier de 2026 comporte 24 cases, du 1er au 24 décembre.
- Une nouvelle case devient disponible chaque jour à la date prévue.
- Les cases déjà devenues disponibles restent accessibles : si une personne ne se connecte pas un jour, elle peut rattraper les cases manquées les jours suivants.
- Une case future reste verrouillée. Les dates sont calculées selon le fuseau `Europe/Paris` ; une fois disponible, une case reste accessible pour le rattrapage.
- Chaque calendrier est indépendant : les contenus, l'état d'ouverture et les éventuelles personnalisations d'une personne ne doivent pas modifier ceux des autres.
- Une case contient une blague, une anecdote, une petite activité ou une surprise. Le type et le texte peuvent varier d'un jour à l'autre.
- L'expérience doit être agréable sur téléphone comme sur ordinateur, avec un état visuel clair pour les cases ouvertes, disponibles et verrouillées.

## Personnes et connexion

Comptes à prévoir :

- Louisa
- Orléane
- Thomas

Connexion par email et mot de passe. L'inscription publique n'est pas demandée : les comptes sont créés ou préparés par la personne qui gère le site. Ne jamais enregistrer les mots de passe en clair ; utiliser un hachage adapté, des sessions sécurisées, une limitation des tentatives de connexion et une vérification des droits sur chaque requête privée. Les messages d'erreur ne doivent pas révéler si un compte existe.

Chaque requête concernant un calendrier doit être autorisée côté API pour la personne connectée. Masquer une case dans le frontend ne suffit pas à la protéger.

## Contenus et personnalisation

- Préparer 72 contenus spécifiques : un contenu pour chacune des 24 cases de chacune des 3 personnes.
- Autoriser plusieurs formats simples : blague, anecdote, activité, texte surprise et, si souhaité plus tard, image.
- Prévoir des champs ou des notes de rédaction pour personnaliser les textes (prénoms, souvenirs communs, sujets à éviter, ton souhaité). Ces notes sont des indications de préparation, pas du contenu à afficher aux destinataires.
- Prévoir un élément aléatoire sur chaque page, par exemple une décoration, une petite phrase ou une animation choisie dans une liste.
- Décider si cet élément aléatoire change à chaque visite ou reste stable pour une personne et une journée. Pour éviter qu'une surprise de case change après actualisation, le contenu principal de la case devra rester stable.
- Le contenu doit pouvoir être relu et corrigé avant publication. Le mode de saisie ou d'administration des contenus reste à décider.

## Image à préparer

Image source fournie : `Planche d’autocollants aux expressions variées.png` (à la racine du dossier du projet).

Exigences de préparation des images (exports réalisés dans cette version) :

- Repérer et découper chaque tête/expression de la planche en une image distincte.
- Exporter les découpes dans un format adapté au web, avec fond transparent si la source le permet.
- Donner des noms de fichiers explicites et stables, puis vérifier chaque découpe (cadrage, bords, transparence et lisibilité à petite taille).
- Ranger les fichiers exportés dans un dossier d'assets dédié et documenter quelle expression peut être associée à quelle personne ou à quel jour.
- Ne pas modifier ni remplacer l'image source.

Le nombre exact de têtes, leurs associations et le format d'export sont à confirmer en examinant la planche au moment de la découpe.

## Écrans du frontend

- **Connexion** : identifiant, mot de passe, retour d'erreur sobre et compréhensible.
- **Calendrier personnel** : nom de la personne connectée, grille de 24 cases, indication des cases ouvertes/disponibles/verrouillées, accès à la déconnexion.
- **Contenu d'une case** : surprise du jour, date ou numéro de case, navigation vers les autres cases déjà disponibles.
- **États réseau** : chargement, absence de contenu, erreur API et session expirée.

### Direction visuelle retenue

- **Ambiance** : Noël illustré, avec un contraste moderne, des cadeaux colorés et un décor festif sans surcharge.
- **Ordinateur** : disposer les 24 cadeaux dans une composition libre, tout en gardant une numérotation et des états (ouvert, disponible, verrouillé) immédiatement lisibles.
- **Mobile** : réorganiser les cadeaux en parcours vertical illustré, adapté au défilement et aux interactions tactiles.
- **Personnalisation** : conserver le même langage visuel pour Louisa, Orléane et Thomas ; leur calendrier et leurs surprises restent différents.
- **Autocollants** : utiliser les têtes découpées comme expressions/réactions liées aux surprises. Leur attribution peut être aléatoire, mais doit rester stable pour une case afin qu'une actualisation ne change pas la réaction.
- **Mouvement** : transitions rapides et animation légère à l'ouverture d'une case ; éviter les effets qui gênent la lecture ou la navigation.

La palette précise et les illustrations de fond restent à choisir. Prévoir une mise en page responsive, des commandes accessibles au clavier et des contrastes suffisants.

## API et données

L'API doit fournir au minimum les opérations suivantes, avec authentification et contrôle d'accès lorsque nécessaire :

- ouvrir une session et fermer la session ;
- récupérer les informations du compte connecté ;
- récupérer son calendrier et l'état de ses 24 cases ;
- consulter le contenu d'une case devenue disponible ;
- éventuellement gérer les contenus par une interface privée réservée à l'administrateur, si cette option est retenue.

Modèle de données minimal à étudier :

- **Utilisateur** : identifiant, nom affiché, empreinte du mot de passe, état du compte ;
- **Case** : utilisateur propriétaire, numéro/jour, type de contenu, contenu, éventuel média ;
- **Ouverture** (facultatif si l'état est déductible) : utilisateur, numéro de case, date d'ouverture.

Le volume (trois comptes et 72 contenus) reste faible ; SQL Server sera utilisé comme base relationnelle. L'hébergement et la stratégie de sauvegarde restent à définir. Les identifiants et secrets de déploiement ne doivent pas être inclus dans le dépôt.

## Technologies retenues

La pile retenue est l'option A.

### Option A — Frontend et API séparés, pile .NET

- **Frontend** : React avec TypeScript et Vite.
- **API** : ASP.NET Core Web API en C#.
- **Base de données** : Microsoft SQL Server.
- **Accès aux données** : Entity Framework Core (EF Core), avec le fournisseur SQL Server. EF Core assure le mapping objet-relationnel et l'accès aux données ; le projet SQL ci-dessous est la source de vérité du schéma.

**Avantages** : séparation nette entre interface et API ; API structurée et facile à tester ; C# apporte un typage solide ; EF Core facilite les requêtes et l'évolution du schéma ; SQL Server offre des contraintes relationnelles et des outils de gestion adaptés.

**Inconvénients** : deux langages (TypeScript et C#) ; deux parties à configurer et potentiellement déployer ; plus de mise en place qu'une application intégrée ; SQL Server demande une instance à installer ou héberger, donc plus de configuration et de ressources qu'une base fichier comme SQLite.

### Choix retenu

Pile choisie : **React + TypeScript + Vite**, **ASP.NET Core Web API en C#**, **SQL Server**, **EF Core**, **MediatR**, **FluentValidation** et **Autofac**. Il reste à décider où l'API et SQL Server seront hébergés et comment la base sera sauvegardée. Les identifiants de connexion à SQL Server devront être fournis par configuration sécurisée et ne jamais être enregistrés dans le dépôt.

## Architecture de l'API retenue

L'API suit une **Clean Architecture** organisée en projets/couches aux responsabilités distinctes. Les dépendances vont vers le domaine et les abstractions applicatives ; le domaine ne dépend ni d'ASP.NET Core, ni d'EF Core, ni de SQL Server.

- **API / présentation** : endpoints HTTP, authentification, autorisation, configuration du pipeline et traduction des résultats en réponses HTTP. Les contrôleurs ou endpoints restent minces et délèguent les opérations à MediatR.
- **Application** : `Request` MediatR (commandes pour modifier, queries pour lire), handlers, contrats et règles applicatives. Chaque Request a un handler dédié.
- **Domain** : entités, objets-valeurs et règles métier indépendantes de l'infrastructure.
- **Infrastructure** : implémentations EF Core, `DbContext`, accès SQL Server, dépôts si nécessaires et implémentation de l'Unit of Work.

### Médiation, validation et injection de dépendances

- Chaque Request est validée avec **FluentValidation** avant l'exécution de son handler, idéalement par un comportement de pipeline MediatR. Les règles métier restent également vérifiées dans la couche appropriée ; la validation d'entrée seule ne remplace pas l'autorisation.
- L'injection de dépendances est composée au démarrage de l'API. **Autofac** est le conteneur retenu ; enregistrer les composants par modules/layers et éviter les enregistrements dupliqués avec le conteneur .NET par défaut.
- Les handlers applicatifs dépendent d'interfaces, pas directement de `DbContext`, de SQL Server ou de classes concrètes de l'Infrastructure.

### Configuration

- Utiliser `appsettings.json` pour les paramètres non secrets communs et `appsettings.Development.json` pour les réglages locaux non sensibles.
- Surcharger la configuration avec les variables d'environnement ou le gestionnaire de secrets de l'environnement de déploiement.
- Ne jamais versionner de mot de passe, chaîne de connexion contenant un secret, clé de signature ou autre secret. La chaîne de connexion SQL Server est fournie hors du dépôt.

### SQL Server, projet SQL et Unit of Work

- Ajouter un projet de base de données **SQL Server Data Tools (`.sqlproj`)** qui produit un DACPAC et porte la définition du schéma.
- Définir explicitement les tables applicatives dans le schéma **`dbo`** (par exemple `dbo.Users`, `dbo.CalendarEntries` et, si nécessaire, `dbo.Openings`), avec clés, contraintes, index et relations documentés.
- Les scripts **pre-deployment** et **post-deployment** font partie du projet SQL. Le pre-deployment prépare les opérations préalables nécessaires ; le post-deployment contient les données de référence ou d'initialisation et doit pouvoir être rejoué sans créer de doublons.
- Déployer le schéma avec le DACPAC ; ne pas utiliser simultanément les migrations EF Core pour modifier ce même schéma. EF Core garde des configurations de mapping alignées sur le `.sqlproj`.
- Introduire une abstraction **Unit of Work** dans Application et son implémentation dans Infrastructure. Avec EF Core, `DbContext` fournit déjà l'essentiel du suivi et de la transaction ; l'abstraction demandée doit rester mince, centraliser la validation des changements et ne pas ajouter une deuxième mécanique transactionnelle.
- Une opération applicative qui modifie plusieurs entités doit être atomique. Les handlers ne doivent pas appeler plusieurs commits partiels pour une seule opération métier.

## Déploiement Docker sur Proxmox

La cible retenue est un **conteneur Debian hébergé sur ton serveur Proxmox**, que tu administres. Le déploiement de production doit pouvoir être lancé avec **Docker Compose** dans cet environnement. Les fichiers à prévoir lors de l'implémentation :

- un `Dockerfile` multi-stage pour construire le frontend React/Vite et le servir avec un serveur web léger ;
- un `Dockerfile` multi-stage pour publier et exécuter l'API ASP.NET Core ;
- des fichiers Compose décrivant les services, leur réseau interne, leurs volumes, leurs politiques de redémarrage et leurs contrôles de santé ;
- un reverse proxy léger, par exemple Caddy, pour exposer le site en HTTPS et router les requêtes vers le frontend et l'API ;
- le déploiement du DACPAC SQL Server, avec les scripts pre-deployment et post-deployment, intégré à une étape explicite du déploiement plutôt qu'exécuté à chaque redémarrage de l'application.

Le Compose de production doit prévoir les services frontend, API, SQL Server et reverse proxy. SQL Server ne doit pas être exposé directement à Internet ; seul le reverse proxy publie les ports web. Les services API et base communiquent sur un réseau Docker privé.

La base doit utiliser un volume persistant, avec une procédure documentée de sauvegarde hors du conteneur et de restauration. Les secrets (mot de passe SQL Server, clés d'authentification et autres paramètres sensibles) sont injectés sur le VPS par un fichier d'environnement non versionné ou un gestionnaire de secrets. Ne pas copier de secrets dans les images Docker.

Avant le déploiement, vérifier que le conteneur Debian autorise Docker (fonctionnalités de nesting, cgroups et stockage adaptés), ainsi que la compatibilité x86-64 et la mémoire disponible pour SQL Server. SQL Server en conteneur demande à lui seul au moins 2 Go de mémoire ; le frontend, l'API et le proxy nécessitent une marge supplémentaire.

## Règles de sécurité et de robustesse

- Vérifier la disponibilité d'une case côté API à partir de la date courante ; ne pas faire confiance à l'horloge ou à l'état transmis par le navigateur.
- Refuser l'accès aux cases futures, même si l'URL ou l'identifiant de case est modifié manuellement.
- S'assurer qu'un utilisateur ne peut lire ni modifier le calendrier d'un autre utilisateur.
- Protéger les sessions (cookies sécurisés en production, durée limitée, fermeture effective à la déconnexion) et limiter les tentatives de connexion.
- Valider les données entrantes et ne pas renvoyer d'informations sensibles dans les réponses ou les journaux.
- Prévoir une sauvegarde de la petite base et une procédure de restauration.

## Plan de réalisation

- [x] Confirmer le calendrier du 1er au 24 décembre 2026 et le fuseau `Europe/Paris`.
- [x] Confirmer si les cases sont simplement consultables dès leur déblocage ou si une première ouverture doit être enregistrée.
- [x] Décider comment créer/modifier les comptes et les contenus (fichier de données initial, outil privé d'administration ou autre méthode).
- [ ] Écrire et relire les 72 contenus (un par personne et par case), avec les notes de personnalisation séparées des textes publiés.
- [x] Découper les têtes de l'image source, contrôler les exports et définir leurs associations.
- [x] Choisir l'option A : React + TypeScript + Vite, ASP.NET Core Web API, SQL Server et EF Core.
- [x] Définir les projets Clean Architecture et les règles de dépendance entre couches.
- [x] Ajouter MediatR, les Requests/handlers, FluentValidation et Autofac avec leurs enregistrements DI.
- [x] Ajouter le `.sqlproj`, les tables `dbo`, les scripts pre-deployment/post-deployment et aligner le mapping EF Core.
- [x] Définir l'implémentation de l'Unit of Work et la gestion des transactions.
- [x] Définir les sources de configuration `appsettings` et le stockage sécurisé des secrets.
- [x] Créer les Dockerfiles de production pour le frontend et l'API.
- [x] Créer `compose.production.yaml` avec frontend, API, SQL Server et reverse proxy HTTPS.
- [x] Configurer les volumes persistants, contrôles de santé, secrets hors dépôt et sauvegarde/restauration SQL Server.
- [x] Intégrer le déploiement du DACPAC et vérifier l'exécution sûre des scripts pre-deployment/post-deployment.
- [x] Choisir le conteneur Debian sur Proxmox comme cible de déploiement.
- [ ] Vérifier l'architecture x86-64, la mémoire, le stockage et la prise en charge de Docker/nesting dans le conteneur Debian.
- [ ] Construire l'authentification et les contrôles d'accès côté API.
- [x] Construire les écrans responsive du calendrier et des cases.
- [x] Ajouter les contenus propres à chaque personne et l'élément aléatoire par page selon la règle décidée.
- [x] Tester les dates limites, le rattrapage des jours manqués, les cases futures, les trois comptes et l'isolation des calendriers.
- [x] Vérifier localement l'accessibilité clavier/mobile, les erreurs réseau, les protections de production, la sauvegarde et la restauration.

La relecture finale des textes, les mots de passe définitifs et les vérifications matérielles/DNS
sur Proxmox restent des opérations de mise en service, pas des paramètres embarqués dans l'application.

## Critères de validation

- Louisa, Orléane et Thomas ne voient que leur propre calendrier et leurs propres contenus.
- Une case se débloque au bon moment ; les jours manqués restent accessibles ; les jours futurs sont refusés par l'API.
- Une actualisation ne remplace pas le contenu fixe d'une case déjà publiée.
- L'élément aléatoire suit la règle choisie et n'empêche ni la lecture ni la navigation.
- Les 24 cases et les contenus associés sont utilisables sur mobile et ordinateur.
- Les mots de passe ne sont pas stockés en clair et un utilisateur ne peut pas contourner les contrôles d'accès en appelant directement l'API.
- Le déploiement complet peut être démarré sur le VPS par Docker Compose ; les données SQL survivent au redémarrage et les ports de la base ne sont pas exposés publiquement.
- Les images découpées sont nettes, correctement cadrées et chargées par le site.
