# Sécurité — piksel-web.fr

Ce document répond point par point au rapport d'analyse du site. Il se lit en
deux parties : ce qui a été corrigé **dans le dépôt** (déjà fait, il suffit de
déployer) et ce qui doit être corrigé **dans le DNS Cloudflare** (à faire à la
main, aucune ligne de code ne peut le faire à ta place).

---

## Partie 1 — corrigé dans le dépôt

### En-tête HSTS manquant · *critique*

Ajouté dans `_headers` :

```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

Sans cet en-tête, quelqu'un qui tape `piksel-web.fr` dans sa barre d'adresse
part en HTTP, et c'est cette toute première requête — avant la redirection —
qu'un attaquant sur le même Wi-Fi peut détourner. HSTS dit au navigateur : « à
partir de maintenant, et pendant deux ans, n'essaie même pas le HTTP pour ce
domaine ».

`preload` est une déclaration d'intention : elle rend le domaine éligible à
[hstspreload.org](https://hstspreload.org/), une liste embarquée directement
dans Chrome, Firefox et Safari, qui protège aussi la toute première visite.
**Inscris-toi seulement quand le site est stable** : sortir de la liste prend
plusieurs mois, et pendant ce temps aucun sous-domaine ne peut être servi en
HTTP.

### Content Security Policy manquante · *critique*

C'est le point qui a demandé le plus de travail, parce qu'une CSP posée à la
va-vite (`script-src 'unsafe-inline'`) coche la case du scanner sans rien
protéger du tout.

La politique appliquée part de `default-src 'none'` — tout est interdit — puis
rouvre uniquement ce que le site charge réellement :

| Directive | Valeur | Pourquoi |
|---|---|---|
| `script-src` | `'self'` + Turnstile + 3 empreintes SHA-256 | Les blocs `<script>` d'`index.html` sont autorisés par leur empreinte, pas par `'unsafe-inline'` |
| `style-src` | `'self'` + 2 empreintes SHA-256 | Idem pour les blocs `<style>` |
| `img-src` | `'self' data:` | Images du site + favicon en SVG embarqué |
| `font-src` | `'self'` | Les polices sont hébergées sur le domaine |
| `connect-src` | `'self'` + Turnstile | Le formulaire poste sur `/api/contact` |
| `frame-src` | Turnstile | Le captcha s'affiche dans une iframe Cloudflare |
| `frame-ancestors` | `'none'` | Personne ne peut encadrer le site (clickjacking) |
| `base-uri`, `object-src`, `worker-src` | `'none'` | Vecteurs classiques d'injection, fermés |

**La différence entre `'unsafe-inline'` et les empreintes.** Avec
`'unsafe-inline'`, le navigateur exécute n'importe quel script inline — y
compris celui qu'un attaquant réussirait à injecter dans la page : la CSP ne
sert plus à rien contre le XSS. Avec les empreintes, seul le code dont le
SHA-256 figure dans l'en-tête s'exécute. Un script injecté n'aura jamais la
bonne empreinte.

**La contrepartie, et c'est important :** modifier ne serait-ce qu'un espace
dans un bloc `<script>` ou `<style>` change son empreinte, et la page se
retrouve bloquée par son propre navigateur. D'où le script fourni :

```bash
node tools/build-headers.mjs          # recalcule et réécrit la CSP
node tools/build-headers.mjs --check  # échoue si _headers n'est plus à jour
```

**À lancer après chaque modification du HTML, avant de committer.** Le mode
`--check` est fait pour un hook de pre-commit ou une action CI.

⚠️ **Une option Cloudflare peut casser les empreintes.** Tout ce qui réécrit le
HTML à la volée modifie le contenu des balises et invalide leur SHA-256. Vérifie
que **Rocket Loader** est désactivé (Cloudflare → Speed → Optimization). Auto
Minify n'existe plus depuis 2024, et l'obfuscation d'email ne touche pas aux
blocs `<script>`, mais Rocket Loader, lui, les réécrit systématiquement.

### Politique CORS trop permissive · *important*

Cloudflare Pages sert les fichiers statiques avec `Access-Control-Allow-Origin: *`,
ce qui autorise n'importe quel site à lire les réponses en JavaScript depuis le
navigateur d'un visiteur. Rien ici n'a vocation à être consommé par un tiers,
donc l'en-tête est retiré :

```
! Access-Control-Allow-Origin
```

Le `!` est la syntaxe de suppression du fichier `_headers` de Cloudflare Pages.

Deuxième volet, côté `functions/api/contact.js` : la route vérifie maintenant
l'en-tête `Origin`. Le navigateur l'envoie systématiquement sur un POST ; s'il
est présent et ne correspond pas au domaine, la requête vient d'une page tierce
qui se sert du formulaire comme relais d'envoi — elle est refusée en 403. Un
`Origin` absent (curl, test manuel) reste accepté, le captcha Turnstile faisant
barrage plus loin.

### Chemins sensibles dans robots.txt · *important*

L'ancien fichier contenait :

```
Disallow: /docs/
Disallow: /api/
```

`robots.txt` est public : écrire « n'allez pas voir là » revient à publier la
carte de ce qu'on cherche à cacher — c'est la première URL qu'un scanner lit.
Les deux lignes sont supprimées. La protection réelle est ailleurs, et elle
existait déjà : `functions/docs/[[path]].js` répond 404 sur tout `/docs/...`
avant même que le fichier statique soit servi, et `/api/contact` n'accepte que
le POST. J'ai ajouté `X-Robots-Tag: noindex, nofollow` sur ces deux chemins
pour la ceinture et les bretelles.

### Cross-Origin-Opener-Policy absente · *info*

```
Cross-Origin-Opener-Policy: same-origin
```

Isole le contexte de navigation : une page ouverte depuis le site ne peut plus
manipuler `window.opener`, et les fuites d'informations entre onglets
d'origines différentes sont coupées.

Note : je n'ai **pas** ajouté `Cross-Origin-Embedder-Policy`. C'est le
compagnon habituel de COOP, mais il exige que chaque ressource tierce déclare
explicitement accepter d'être chargée — l'iframe du captcha Turnstile ne le
garantit pas, et le formulaire cesserait de fonctionner. Le gain de sécurité
sur un site sans données sensibles en mémoire ne justifie pas le risque.

### Pas de security.txt · *info*

Créé : `.well-known/security.txt` (format RFC 9116).

⚠️ Le champ `Expires` vaut `2027-08-19`. Un `security.txt` expiré est considéré
comme invalide — pense à le repousser d'un an, ou supprime le fichier si tu ne
comptes plus le maintenir.

### Stack technologique révélée · *info*

Rien à faire, et ce n'est pas grave. L'en-tête `Server: cloudflare` est ajouté
par le proxy et n'est pas retirable sur les offres Pages. Il ne révèle que ce
que le rapport constate lui-même à la ligne suivante (« CDN/WAF détecté ») :
que le site est derrière Cloudflare. Aucune version logicielle exploitable
n'est exposée.

### Bonus non demandé : Google Fonts sur la page 404

`404.html` chargeait encore la police depuis `fonts.googleapis.com`, alors que
le reste du site l'héberge en local justement pour ne pas transmettre l'IP des
visiteurs à Google (le sujet est traité dans la page Confidentialité). La 404
utilise désormais les mêmes fichiers `.woff2` locaux — cohérence RGPD, et une
CSP qui n'a plus besoin d'autoriser de domaine de style externe.

### Autres en-têtes renforcés au passage

- `X-Frame-Options: DENY` (était `SAMEORIGIN`) — aucune page n'est encadrée.
- `Permissions-Policy` étendue : `payment`, `usb`, `magnetometer`, `gyroscope`,
  `accelerometer` et `interest-cohort` s'ajoutent à la géolocalisation, au micro
  et à la caméra.
- `Cross-Origin-Resource-Policy: same-origin` sur `/fonts/*` — les polices ne
  sont pas là pour être chargées par d'autres sites. Volontairement **absent**
  sur `og.jpg`, qui doit rester lisible par les robots d'aperçu de LinkedIn,
  WhatsApp et consorts.

---

## Partie 2 — à faire dans le DNS Cloudflare

Ces six points sont ceux que le rapport classe en email et DNS. Aucun ne se
règle dans le code : il faut aller dans **Cloudflare → ton domaine → DNS →
Records**.

Le contexte retenu : `piksel-web.fr` **envoie** du courrier via Resend
(formulaire de contact) et n'a **aucune boîte de réception** — tu lis tes mails
sur Gmail. C'est ce qui rend la configuration ci-dessous à la fois simple et
très stricte.

### 1. SPF · *important*

SPF déclare quels serveurs ont le droit d'envoyer du courrier en ton nom.
Aujourd'hui la liste est vide, donc n'importe qui peut écrire
`De : contact@piksel-web.fr`.

**Resend fournit les enregistrements exacts** — ils sont propres à ton compte
et à la région choisie, je ne peux pas les inventer. Va dans
**Resend → Domains → piksel-web.fr → Records** et recopie les deux
enregistrements proposés, tels quels :

| Type | Nom | Contenu |
|---|---|---|
| `MX` | `send` | (valeur donnée par Resend, ex. `feedback-smtp.eu-west-1.amazonses.com`) |
| `TXT` | `send` | (valeur donnée par Resend, ex. `v=spf1 include:amazonses.com ~all`) |

Puis, **sur le domaine racine**, ajoute un SPF qui n'autorise personne :

| Type | Nom | Contenu |
|---|---|---|
| `TXT` | `@` | `v=spf1 -all` |

Ce n'est pas une erreur. Resend envoie avec une adresse de retour en
`send.piksel-web.fr` : c'est ce sous-domaine que SPF vérifie, et il est couvert
par l'enregistrement Resend ci-dessus. La racine, elle, n'envoie jamais rien
directement — le `-all` dit donc « tout message prétendant venir d'ici en
direct est un faux, rejetez-le ». C'est la position la plus protectrice.

> Si un jour tu envoies depuis autre chose (Gmail avec l'adresse du domaine, un
> outil de newsletter, un formulaire hébergé ailleurs), il faudra ajouter le
> `include:` correspondant à cette ligne, sinon ces messages partiront en spam.

### 2. DKIM · *info*

Non détecté parce que le domaine n'est probablement pas encore vérifié chez
Resend. Les trois enregistrements `TXT` de DKIM sont générés dans le même écran
**Resend → Domains → Records** — mêmes consignes : copier-coller à
l'identique, sans reformater.

DKIM signe chaque message avec une clé privée détenue par Resend ; le
destinataire vérifie la signature avec la clé publique publiée ici. C'est ce
qui prouve que le contenu n'a pas été modifié en route.

### 3. DMARC · *important*

DMARC dit aux serveurs destinataires quoi faire quand SPF et DKIM échouent —
sans lui, chacun décide dans son coin, et la plupart laissent passer.

Commence en mode observation, une à deux semaines :

| Type | Nom | Contenu |
|---|---|---|
| `TXT` | `_dmarc` | `v=DMARC1; p=none; rua=mailto:piksel.website@gmail.com; fo=1; adkim=r; aspf=r` |

Tu recevras des rapports agrégés quotidiens. Une fois que les envois du
formulaire passent tous SPF **et** DKIM dans ces rapports, durcis :

| Type | Nom | Contenu |
|---|---|---|
| `TXT` | `_dmarc` | `v=DMARC1; p=reject; rua=mailto:piksel.website@gmail.com; fo=1; adkim=s; aspf=s` |

`p=reject` demande le rejet pur et simple de tout message usurpant ton domaine.
**Ne saute pas l'étape `p=none`** : si un envoi légitime échoue encore
l'authentification, tu perds silencieusement des messages de prospects.

### 4. Réception : null MX plutôt que MTA-STS · *info*

Le rapport recommande MTA-STS pour protéger les mails **entrants**. Dans ton
cas la meilleure réponse est plus radicale : puisque le domaine ne reçoit
aucun courrier, dis-le explicitement.

| Type | Nom | Priorité | Contenu |
|---|---|---|---|
| `MX` | `@` | `0` | `.` |

Ce « null MX » (RFC 7505) annonce que le domaine n'accepte pas de courrier. Les
serveurs expéditeurs rejettent immédiatement, au lieu de tenter une livraison
qui pourrait être interceptée. Aucune interception possible s'il n'y a rien à
livrer — c'est une meilleure protection que MTA-STS, et c'est un enregistrement
au lieu d'un sous-domaine et d'un fichier à maintenir.

⚠️ Cet enregistrement ne concerne que la racine. Le `MX` sur `send` demandé par
Resend reste indispensable et n'entre pas en conflit.

> **Si tu ouvres un jour une vraie boîte** sur le domaine, il faudra retirer le
> null MX et mettre en place MTA-STS : un sous-domaine `mta-sts.piksel-web.fr`
> servant `/.well-known/mta-sts.txt` en HTTPS, plus un `TXT` sur
> `_mta-sts`. Note-le, c'est le genre de détail qu'on oublie.

### 5. CAA · *info*

Sans CAA, n'importe quelle autorité de certification au monde peut émettre un
certificat pour `piksel-web.fr`. Ces quatre enregistrements limitent l'émission
aux seules autorités utilisées par Cloudflare :

| Type | Nom | Flags | Tag | Valeur |
|---|---|---|---|---|
| `CAA` | `@` | `0` | `issue` | `letsencrypt.org` |
| `CAA` | `@` | `0` | `issue` | `pki.goog; cansignhttpexchanges=yes` |
| `CAA` | `@` | `0` | `issue` | `ssl.com` |
| `CAA` | `@` | `0` | `issue` | `sectigo.com` |

Les quatre sont nécessaires : Cloudflare choisit l'autorité librement et peut
en changer au renouvellement. En omettre une, c'est risquer un renouvellement
bloqué et un site en erreur de certificat un matin.

Ajoute aussi un enregistrement de signalement, qui te prévient si quelqu'un
tente une émission non autorisée :

| Type | Nom | Flags | Tag | Valeur |
|---|---|---|---|---|
| `CAA` | `@` | `0` | `iodef` | `mailto:piksel.website@gmail.com` |

> Cloudflare ajoute parfois les CAA automatiquement quand il gère le DNS.
> Vérifie l'onglet DNS avant d'en créer en double.

### 6. DNSSEC · *info*

Sans DNSSEC, les réponses DNS ne sont pas signées : un attaquant capable
d'empoisonner un cache peut faire pointer `piksel-web.fr` vers son propre
serveur, et tout le reste (HSTS, CSP, certificat) est contourné en amont.

C'est le plus simple de la liste :

1. **Cloudflare → DNS → Settings → DNSSEC → Enable DNSSEC**
2. Cloudflare affiche un enregistrement `DS`.
3. Copie-le chez ton **registrar** (là où le domaine a été acheté), dans la
   section DNSSEC.

⚠️ L'étape 3 est celle qu'on oublie. Tant que le `DS` n'est pas chez le
registrar, DNSSEC est activé côté Cloudflare mais **inactif** — et le scanner
continuera à le signaler. Compte jusqu'à 24 h de propagation.

---

## Récapitulatif

| Point du rapport | Gravité | Où | État |
|---|---|---|---|
| HSTS manquant | Critique | `_headers` | ✅ Corrigé |
| CSP manquante | Critique | `_headers` + `tools/` | ✅ Corrigé |
| CORS trop permissive | Important | `_headers` + `contact.js` | ✅ Corrigé |
| Chemins dans robots.txt | Important | `robots.txt` | ✅ Corrigé |
| COOP absente | Info | `_headers` | ✅ Corrigé |
| security.txt | Info | `.well-known/` | ✅ Corrigé |
| Stack révélée | Info | — | ⚪ Sans objet (Cloudflare) |
| SPF manquant | Important | DNS + Resend | ⏳ À faire |
| DMARC manquant | Important | DNS | ⏳ À faire |
| DKIM non détecté | Info | DNS + Resend | ⏳ À faire |
| CAA non définis | Info | DNS | ⏳ À faire |
| MTA-STS | Info | DNS (null MX) | ⏳ À faire |
| DNSSEC | Info | Cloudflare + registrar | ⏳ À faire |

---

## Vérifier après déploiement

```bash
# En-têtes de sécurité (note attendue : A+)
https://securityheaders.com/?q=piksel-web.fr

# Analyse CSP directive par directive
https://csp-evaluator.withgoogle.com/

# SPF, DKIM, DMARC, DNSSEC, CAA en un coup d'œil
https://internet.nl/site/piksel-web.fr/
https://www.hardenize.com/report/piksel-web.fr
```

Et surtout, le test qui compte le plus : **ouvre le site, F12 → Console,
envoie un message par le formulaire.** Si la console ne montre aucune erreur
`Refused to execute` ou `Refused to apply`, la CSP est correcte. Si elle en
montre une, c'est presque toujours qu'un bloc `<script>` ou `<style>` a été
modifié sans relancer `node tools/build-headers.mjs`.
