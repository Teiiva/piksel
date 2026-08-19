# Piksel sur Cloudflare Pages

Le site est un `index.html` statique accompagné de deux petites fonctions
serveur. Aucune étape de build : Cloudflare sert les fichiers tels quels.

**En ligne : https://piksel-aj3.pages.dev**
**Domaine acheté, à brancher : `piksel-web.fr`**

## Où on en est

| | |
|---|---|
| ✅ | Dépôt GitHub poussé et connecté à Cloudflare Pages |
| ✅ | Site déployé, page 404 active, dossier `docs/` fermé au public |
| ✅ | Widget Turnstile créé, hostname `piksel-aj3.pages.dev` autorisé |
| ✅ | Compte Resend créé, variables d'environnement renseignées |
| ✅ | **Formulaire de contact fonctionnel** |
| ⬜ | **Brancher `piksel-web.fr`** → section 7 |
| ⬜ | **Pousser les fichiers de référencement** ajoutés en local → section 8 |

Les sections 1 à 6 décrivent la mise en place initiale : elles sont
conservées pour référence, mais **tout y est déjà fait**. Pour continuer,
va directement à la **section 7**.

---

## Ce que contient le dossier

| Chemin | Rôle |
|---|---|
| `index.html` | Le site entier — HTML, CSS et JS dans un seul fichier |
| `404.html` | Page affichée sur une adresse inconnue |
| `functions/api/contact.js` | Vérifie le captcha et envoie le mail du formulaire |
| `functions/docs/[[path]].js` | Renvoie 404 sur `/docs/` pour garder ce dossier privé |
| `_headers` | En-têtes de sécurité et durées de cache |
| `_routes.json` | Limite l'invocation des fonctions à `/api/` et `/docs/` |
| `projets/`, `teiva.*` | Images, en WebP avec repli PNG |
| `docs/` | Ces notes — dans le dépôt, mais **jamais servies** |
| `_ancienne-photo/`, `_originaux-projets/` | Sauvegardes locales, exclues de git |

---

## 1. Remplacer la clé du captcha

`index.html` contient encore la clé de test de Cloudflare, qui laisse
**tout** passer. C'est le seul blocage réel avant la mise en ligne — mais
il faut d'abord créer le widget (étape 3), alors garde ce point en tête et
reviens-y.

---

## 2. Pousser sur GitHub

Crée d'abord un dépôt **vide** nommé `piksel` sur github.com — sans README,
sans .gitignore, ils sont déjà là. Puis, dans le dossier du projet
(PowerShell ou Git Bash) :

```bash
git init
git add .
git commit -m "Site Piksel — formulaire de contact avec captcha"
git branch -M main
git remote add origin https://github.com/TON-PSEUDO/piksel.git
git push -u origin main
```

Remplace `TON-PSEUDO` par ton nom d'utilisateur GitHub.

> Le `.gitignore` exclut déjà `.dev.vars`, `.env` et les dossiers de
> sauvegarde. Tes clés secrètes ne partiront jamais sur GitHub.

Vérifie avant de pousser que rien de sensible n'est inclus :

```bash
git status --short
```

---

## 3. Créer le widget Turnstile (le captcha)

1. **dash.cloudflare.com** → menu de gauche → **Turnstile** → **Add widget**
2. Remplis :
   - **Widget name** : `piksel`
   - **Hostname** : `piksel-aj3.pages.dev` — **recopie-le exactement**, avec
     le suffixe `-aj3`. Cloudflare ajoute ce suffixe quand le nom `piksel`
     est déjà pris ailleurs sur la plateforme. Un hostname qui ne
     correspond pas fait échouer le captcha sans message clair.
     Ajoute aussi `localhost` pour tes tests
   - **Widget mode** : **Managed** (Cloudflare décide ; invisible dans la
     grande majorité des cas)
3. **Create**. Tu obtiens deux clés :
   - **Site Key** (publique, `0x4AAA…`)
   - **Secret Key** (privée, `0x4AAA…` aussi — ne la partage pas)

### Coller la Site Key

Dans `index.html`, cherche `data-sitekey` (une seule occurrence, section
contact) et remplace la valeur :

```html
<div id="cfTurnstile" data-sitekey="1x00000000000000000000AA"></div>
                                    ^^^^^^^^^^^^^^^^^^^^^^^^
                                    remplace par ta vraie Site Key
```

La **Secret Key** ne va pas dans le code : elle va dans les variables
d'environnement, à l'étape 5.

---

## 4. Créer le compte Resend (l'envoi d'email)

1. Inscris-toi sur **resend.com** — gratuit, 3 000 mails/mois, 100/jour.
   **Utilise `piksel.website@gmail.com`** : voir la limite juste en dessous.
2. **API Keys** → **Create API Key** → permission **Sending access**
3. Copie la clé (`re_…`) — **elle ne s'affiche qu'une seule fois**

### Quelle adresse d'expéditeur ?

**Pour démarrer**, le domaine de test de Resend :

```
CONTACT_FROM = Piksel <onboarding@resend.dev>
```

Limite importante : ce domaine ne peut écrire **qu'à l'adresse du compte
Resend**. D'où l'inscription avec `piksel.website@gmail.com`, qui est aussi
ton `CONTACT_TO`. Les mails partent avec un risque de finir en spam —
vérifie ce dossier au premier test.

**Quand tu auras un domaine** : **Domains** → **Add Domain**, ajoute les
trois enregistrements DNS fournis (SPF, DKIM, DMARC), attends la
validation, puis passe `CONTACT_FROM` à `Piksel <contact@tondomaine.fr>`.
Tu pourras alors écrire à n'importe quelle adresse, avec une bien
meilleure délivrabilité.

---

## 5. Créer le projet Cloudflare Pages

1. **dash.cloudflare.com** → **Workers & Pages** → **Create** →
   onglet **Pages** → **Connect to Git**
2. Autorise GitHub, sélectionne le dépôt `piksel`
3. Configuration du build — **laisse tout vide** :

   | Champ | Valeur |
   |---|---|
   | Framework preset | `None` |
   | Build command | *(vide)* |
   | Build output directory | `/` |

   Il n'y a pas d'étape de build ; Cloudflare détecte seul le dossier
   `functions/`.

4. Déplie **Environment variables (advanced)** et ajoute les quatre :

   | Nom | Valeur | Type |
   |---|---|---|
   | `TURNSTILE_SECRET_KEY` | Secret Key de l'étape 3 | **Encrypt** |
   | `RESEND_API_KEY` | clé `re_…` de l'étape 4 | **Encrypt** |
   | `CONTACT_TO` | `piksel.website@gmail.com` | Texte |
   | `CONTACT_FROM` | `Piksel <onboarding@resend.dev>` | Texte |

   Clique bien sur **Encrypt** pour les deux clés : elles deviennent
   ensuite illisibles, y compris pour toi.

5. **Save and Deploy**. Une minute plus tard, le site est sur
   `https://piksel-aj3.pages.dev`

> **Le projet existe déjà** : passe par **Workers & Pages** → `piksel` →
> **Settings** → **Variables and Secrets** pour ajouter les quatre
> variables.
>
> **Attention** — une variable ajoutée après coup ne s'applique qu'au
> déploiement suivant. Va ensuite dans **Deployments** → dernier
> déploiement → **Retry deployment**, sinon rien ne change.

---

## 6. Vérifier

Sur `https://piksel-aj3.pages.dev` :

| À tester | Attendu |
|---|---|
| Le formulaire de contact | « Message envoyé, merci ! » puis un mail sous une minute (**regarde les spams**) |
| Le bouton clair/sombre | Le captcha change de thème avec la page |
| `piksel-aj3.pages.dev/docs/plan-lancement.md` | Page 404 — le dossier est bien fermé |
| `piksel-aj3.pages.dev/nimportequoi` | Ta page 404, pas l'accueil |
| Sur téléphone | Les carrousels glissent, les points suivent |

### Si le formulaire échoue

| Message affiché | Cause probable | Correctif |
|---|---|---|
| « La vérification anti-robot est indisponible » | le widget refuse de se charger | ouvre la console du navigateur : le code d'erreur Turnstile y est écrit, voir le tableau ci-dessous |
| « Merci de valider le captcha » | widget non chargé | Site Key absente, ou hostname non autorisé dans Turnstile |
| « Captcha refusé » | Secret Key erronée | vérifie `TURNSTILE_SECRET_KEY`, puis redéploie |
| « Captcha non configuré côté serveur » | variable absente | ajoute `TURNSTILE_SECRET_KEY`, puis redéploie |
| « L'envoi a échoué » | Resend refuse | voir les logs ci-dessous |
| « Connexion impossible » | `/api/contact` introuvable | le dossier `functions/` manque dans le dépôt |

Logs détaillés : **Workers & Pages** → le projet → **Deployments** →
dernier déploiement → **Functions** → **Real-time logs**. Les erreurs
Resend y sont en clair — le plus souvent une adresse `from` non vérifiée,
ou une tentative d'écrire ailleurs qu'à l'adresse du compte avec
`onboarding@resend.dev`.

---

## 7. Brancher le domaine `piksel-web.fr`

Le domaine est acheté. **L'ordre compte** : chaque étape dépend de la
précédente. Compte une demi-journée, essentiellement de l'attente DNS.

> **Ne pousse pas les modifications locales avant l'étape 7.3.** Le code
> contient maintenant une balise `canonical` qui désigne `piksel-web.fr`
> comme adresse de référence. Tant que ce domaine ne répond pas, elle
> pointe dans le vide — et c'est le meilleur moyen de se faire
> désindexer par Google.

### 7.1 Passer le DNS chez Cloudflare

1. **dash.cloudflare.com** → **Add a site** → `piksel-web.fr` → plan **Free**
2. Cloudflare affiche **deux serveurs de noms** (du type `xxx.ns.cloudflare.com`)
3. Chez ton registrar, remplace les serveurs de noms par ces deux-là
4. Attends la validation — souvent quelques minutes, jusqu'à 24 h

Sans cette étape, le domaine ne peut pas être relié à Pages.

### 7.2 Relier le domaine au site

**Workers & Pages** → le projet → **Custom domains** →
**Set up a domain** → `piksel-web.fr`. Recommence pour `www.piksel-web.fr`.
Le certificat HTTPS est émis automatiquement, compte quelques minutes.

> L'ancienne adresse `piksel-aj3.pages.dev` continue de fonctionner. C'est
> voulu : elle sert aux déploiements de préversion. La balise `canonical`
> ajoutée dans le code dit à Google laquelle des deux fait foi.

### 7.3 Mettre à jour le captcha

**Turnstile** → widget `piksel` → **Settings** → **Hostname Management** →
ajoute `piksel-web.fr`. **Ne retire pas `piksel-aj3.pages.dev`**, sinon le
captcha cassera sur les préversions.

Effet immédiat, aucun redéploiement nécessaire.

### 7.4 Le code (déjà fait en local)

Dans `index.html`, ajouter dans le `<head>` :

```html
<link rel="canonical" href="https://piksel-web.fr/" />
<meta property="og:url" content="https://piksel-web.fr/" />
<meta property="og:image" content="https://piksel-web.fr/og.jpg" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
```

**N'ajoute la balise `canonical` qu'une fois le domaine réellement en
ligne.** Pointer un canonical vers une adresse qui ne répond pas est le
meilleur moyen de se faire désindexer.

L'`og:image` manque toujours : sans elle, le lien partagé par SMS,
WhatsApp ou LinkedIn s'affiche sans aucun visuel. Or toute ta prospection
repose sur l'envoi d'un lien — c'est exactement le moment où tu veux
faire bonne impression. Il faut une image de 1200 × 630 px à la racine.

### 7.5 L'email professionnel

Trois options, du moins cher au plus complet :

| Solution | Prix | Ce que ça fait |
|---|---|---|
| **Cloudflare Email Routing** | gratuit | `contact@piksel-web.fr` est **redirigé** vers ta boîte Gmail. Réception uniquement : tes réponses partiront depuis l'adresse Gmail. |
| **Boîte chez Infomaniak / OVH** | 1 à 3 €/mois | Une vraie boîte : tu reçois **et** tu envoies depuis `contact@piksel-web.fr`. |
| **Google Workspace** | ~6 €/mois | Idem, plus Drive, Agenda et Meet à ton nom de domaine. |

La redirection gratuite dépanne, mais répondre à un prospect depuis
`piksel.website@gmail.com` après lui avoir écrit depuis
`contact@piksel-web.fr` fait amateur. **Une boîte à 2 €/mois est le bon
choix** dès le premier client.

Cloudflare Email Routing se configure en deux minutes une fois le DNS chez
Cloudflare : **Email** → **Email Routing** → **Enable**.

### 7.6 Passer Resend sur le domaine

Aujourd'hui les mails du formulaire partent de `onboarding@resend.dev`,
qui ne peut écrire qu'à ta propre adresse et finit facilement en spam.

1. **Resend** → **Domains** → **Add Domain** → `piksel-web.fr`
2. Resend affiche trois enregistrements DNS (SPF, DKIM, DMARC) — ajoute-les
   dans Cloudflare : **DNS** → **Records** → **Add record**
3. Attends la validation (quelques minutes)
4. Cloudflare Pages → **Settings** → **Variables and Secrets** :
   - `CONTACT_FROM` → `Piksel <contact@piksel-web.fr>`
   - `CONTACT_TO` → ton adresse de réception
5. **Deployments** → dernier → **Retry deployment**

### 7.7 Vérifier

| À tester | Attendu |
|---|---|
| `https://piksel-web.fr` | Le site, en HTTPS, sans avertissement |
| `https://www.piksel-web.fr` | Idem |
| Le formulaire de contact | Message envoyé, mail reçu **hors du dossier spam** |
| Le lien collé dans une conversation | Un aperçu avec titre, description et image |

---

## 8. Le référencement

Tout est déjà écrit dans le dépôt local — il reste à pousser, **après**
avoir terminé la section 7.

### Ce qui a été ajouté

| Fichier | Rôle |
|---|---|
| `og.jpg` | Image 1200 × 630 affichée quand le lien est partagé |
| `robots.txt` | Autorise l'indexation, exclut `/docs/` et `/api/`, déclare le sitemap |
| `sitemap.xml` | Donne à Google l'adresse de référence et la date de mise à jour |

Et dans le `<head>` de `index.html` : `canonical`, les balises Open Graph
avec l'image, `twitter:card`, et un bloc **JSON-LD**.

Le titre et la description ont aussi été réécrits. L'ancien titre était
« Piksel — Teiva Mettelet, développeur web freelance » : il décrivait qui
tu es, pas ce qu'on cherche. Personne ne tape ton nom dans Google — on
tape « création site internet ». Le nouveau titre commence donc par le
service.

### Le JSON-LD, en clair

C'est une fiche d'identité que Google lit directement, au lieu de deviner
ton activité depuis le texte. Elle déclare que Piksel est un
**prestataire de services** (`ProfessionalService`), que tu en es le
fondateur, et détaille tes quatre offres avec leurs prix. C'est ce qui
permet de ressortir comme entreprise locale plutôt que comme simple page
web.

**Un champ reste à ajuster** : `areaServed` vaut `France`. Remplace-le
par ta ville et les communes alentour — c'est le champ qui pèse le plus
pour ressortir sur « création site internet [ta ville] ». Cherche
`areaServed` dans `index.html`.

### Après la mise en ligne

1. **Google Search Console** (search.google.com/search-console) →
   ajoute `piksel-web.fr` → la propriété se valide automatiquement si le
   DNS est chez Cloudflare → soumets `https://piksel-web.fr/sitemap.xml`.
   Compte quelques jours avant la première indexation.
2. **Vérifie l'aperçu de partage** : colle le lien dans une conversation
   WhatsApp ou sur LinkedIn. Tu dois voir le titre, la description et
   l'image. Si l'ancienne version reste affichée, ces plateformes gardent
   un cache — LinkedIn a un outil, le *Post Inspector*, pour le vider.
3. **Teste les données structurées** sur
   `search.google.com/test/rich-results` avec l'adresse du site.

### Ce qui n'est pas fait, et qui compte plus que tout le reste

Le référencement technique met un site en état d'être trouvé. Il ne le
fait pas remonter. Pour une activité locale, ce qui pèse vraiment :

- **Une fiche Google Business Profile** — gratuite, et c'est elle qui
  place une entreprise dans le bloc carte de Google. Pour un prestataire
  local, elle apporte souvent plus de contacts que le site lui-même.
- **Des avis Google** — d'où le conseil de ton plan de lancement :
  facturer les trois premiers clients au prix du témoignage.
- **Du contenu qui répond à de vraies recherches** — une page par
  métier ciblé (« site internet pour plombier »), ou par ville.

Le site actuel tient en une seule page : il ne peut se positionner que
sur une poignée de requêtes. C'est suffisant pour convertir un prospect à
qui tu as envoyé le lien — ce qui est exactement la stratégie de ton plan
— mais pas pour être découvert par une recherche spontanée.

---

## Travailler en local

```bash
npm install -g wrangler          # une seule fois
cp .dev.vars.example .dev.vars   # puis remplis-le avec tes vraies clés
npx wrangler pages dev .
```

Le site tourne sur `http://localhost:8788` **avec** les fonctions actives.
Ouvrir `index.html` en double-cliquant ne suffit pas : les fonctions ne
tournent pas et le formulaire retombe sur l'ouverture de ta messagerie.

---

## Ce qui protège le formulaire

Trois couches, dans l'ordre où un spammeur les rencontre :

1. **Turnstile** — le captcha Cloudflare. Invisible pour un humain,
   bloquant pour un robot.
2. **Vérification côté serveur** — le jeton est revalidé auprès de
   Cloudflare dans `contact.js`. Sans ça, un robot posterait directement
   sur `/api/contact` en ignorant le widget.
3. **Champ piège** — un champ « Société » caché hors écran. Les robots
   remplissent tout ce qu'ils trouvent ; s'il est rempli, le serveur
   répond « ok » sans rien envoyer, pour que le robot n'insiste pas.

Les entrées sont échappées avant d'être mises dans l'email (pas
d'injection HTML) et le sujet est nettoyé des retours à la ligne (pas
d'injection d'en-têtes).
