# Prompt — démo technique : site 3D / parallax pour une maison de parfum

Fichier à coller tel quel dans une nouvelle conversation Cowork, dossier `piksel`
ouvert. Il est écrit à la deuxième personne : c'est un ordre de mission, pas une
documentation. Tout ce qui est entre `<< >>` est à adapter avant l'envoi.

---

## LE PROMPT

Tu vas construire une **démo technique** : un site vitrine d'une seule page pour
une maison de parfum fictive. L'objectif n'est pas la sobriété — c'est de montrer
jusqu'où on peut pousser l'animation au scroll dans un navigateur, sans build,
sans framework. Assume le côté démonstratif : dense, chorégraphié, presque trop.

Livrable : **un seul fichier HTML autonome**, `demo-parfum.html`, à la racine du
dossier. Tout inline (CSS dans `<style>`, JS dans `<script>`), dépendances
externes uniquement depuis `cdnjs.cloudflare.com`. Zéro build, zéro `npm`.
Déployable sur Cloudflare Pages par simple copie.

### Avant d'écrire la moindre ligne

1. **Invoque le skill `modern-web-guidance`.** Il est marqué MANDATORY pour tout
   travail HTML/CSS/JS client, et le sujet ici est exactement son terrain :
   scroll-driven animations, View Transitions, `backdrop-filter`, container
   queries, Core Web Vitals. Interroge-le au minimum sur : *scroll-driven
   animations*, *scroll parallax/reveals*, *View Transitions*, *`content-visibility`*,
   *INP / LCP*. Mes réflexes sur ces API sont périmés — les tiens aussi.
2. **Crée une task list** avec les 6 phases ci-dessous, verification comprise.
3. Ne lis **aucun** skill de format (docx/pptx/pdf) : le livrable est du HTML.

### La marque

Invente-la entièrement. **Aucune maison réelle** — pas de Dior, Guerlain, Le
Labo, Byredo, ni dans le nom, ni dans les visuels, ni dans le ton copié. Tu as
besoin d'un nom, d'une signature, de trois parfums avec leur pyramide olfactive
(tête / cœur / fond), et d'un récit de maison. Suggestion de départ, à remplacer
si tu trouves mieux : *<<SILLAGE>>*, maison de niche, <<Grasse>>, trois
fragrances autour de la matière brute.

Pour toute la microcopie — titres, CTA, états vides, libellés de formulaire —
**utilise le skill `design:ux-copy`**. Le registre parfum se vautre vite dans le
cliché sensoriel (« un voyage olfactif », « l'essence de vous-même »). Vise
concret et matériel : des noms de matières, des lieux, des gestes.

### La chorégraphie au scroll

C'est le cœur du livrable. Sept sections, chacune avec sa mécanique propre —
l'intérêt de la démo est la **variété des techniques**, pas la répétition d'un
seul effet.

| # | Section | Mécanique attendue |
|---|---------|--------------------|
| 1 | Ouverture | Flacon 3D en WebGL, verre réfractif, rotation pilotée par le scroll. Le titre se compose lettre par lettre pendant que la caméra recule. |
| 2 | Manifeste | Texte masqué révélé par `animation-timeline: view()`. Trois plans de fond à vitesses différentes (parallax vrai, pas un `background-attachment`). |
| 3 | Les matières | Galerie horizontale pilotée par le scroll vertical (*scroll hijacking* assumé), cartes en tilt 3D au survol, profondeur par `perspective` + `translateZ`. |
| 4 | Pyramide olfactive | Diagramme SVG qui se dessine (`stroke-dashoffset` sur `animation-timeline: view()`), notes qui apparaissent en cascade. |
| 5 | Les trois parfums | Section épinglée (`position: sticky`) : le flacon 3D change de teinte et de contenu pendant que le texte défile à côté. Transition entre parfums via **View Transitions API**. |
| 6 | L'atelier | Séquence type *image sequence* au scroll — soit un `<canvas>` qui compose des frames, soit un shader qui morphe. Assume le coût, mais mesure-le. |
| 7 | Contact | Retour au calme : formulaire, glassmorphisme, le flacon revient au centre et s'immobilise. |

En plus, transversalement : un curseur personnalisé qui réagit aux zones
interactives, une barre de progression de lecture, une nav dont l'indicateur
**glisse** d'une section à l'autre avec étirement élastique (voir `index.html`,
la `.nav-pill` — reprends le principe des deux temps : étirement pendant le
trajet, retassement à ressort à l'arrivée), et un grain animé en overlay.

### Stack

- **Three.js r128** depuis cdnjs pour le flacon et le shader de fond.
  Attention : `THREE.CapsuleGeometry` n'existe pas en r128, et `OrbitControls`
  n'est pas servi par ce CDN — n'en dépends pas.
- **GSAP + ScrollTrigger** depuis cdnjs *si et seulement si* tu en as besoin.
  Avant de l'ajouter, demande à `modern-web-guidance` si les scroll-driven
  animations CSS natives couvrent le cas : elles tournent sur le compositeur,
  GSAP non. Le poids se justifie pour l'épinglage complexe (sections 3, 5, 6),
  rarement pour le reste.
- Tout le reste en CSS natif et JS vanilla. Pas de React, pas de Tailwind.

### Contraintes non négociables

Ce sont elles qui séparent une démo technique d'une démo qui plante.

- **`prefers-reduced-motion`.** Attention au piège : une règle CSS
  `animation: none !important` ne coupe **pas** une boucle `requestAnimationFrame`
  ni un `ScrollTrigger`. Teste `matchMedia('(prefers-reduced-motion: reduce)')`
  **en JS** et prévois un vrai parcours dégradé — le contenu reste lisible et
  complet, la 3D se fige sur une pose statique, les révélations deviennent
  instantanées. Ce n'est pas une case à cocher : c'est un second design.
- **Initialisation paresseuse.** Aucun `WebGLRenderer` ne démarre avant que sa
  section n'entre dans le viewport (`IntersectionObserver`), et la boucle de rendu
  s'arrête quand elle en sort. Idem sur `visibilitychange`. Sinon la batterie
  d'un portable y passe.
- **Budget perf.** LCP sous 2,5 s sur une connexion 4G simulée. Le premier écran
  doit être lisible **avant** que Three.js ne soit parsé — le flacon arrive en
  second temps, pas au chargement. Mesure, ne suppose pas.
- **Mobile.** Sous 860px, la 3D lourde se remplace par une image statique ou une
  version très allégée (moins de polygones, pas de post-processing). Le scroll
  hijacking de la section 3 se dégrade en carrousel tactile natif.
- **Pas de `localStorage`** ni de stockage navigateur.
- **Clavier.** Tout ce qui est interactif reste atteignable au clavier, avec un
  focus visible. Une section épinglée ne doit pas piéger la tabulation.

### Style de code

Aligne-toi sur `index.html` du dossier, qui a une grammaire précise :

- variables CSS pour toutes les couleurs, verres et courbes — jamais de valeur
  en dur ; une courbe `--ease` unique réutilisée partout ;
- coupure mobile à **860px** ;
- commentaires **en français** qui expliquent le *pourquoi* d'un choix, pas le
  *quoi*. Les bons commentaires du fichier existant documentent un piège
  rencontré (« le flou est porté par `.nav::before`, jamais par `.nav`, parce
  qu'un élément avec `backdrop-filter` devient le bloc conteneur de ses
  descendants en `position: fixed` »). Écris les tiens sur ce modèle ;
- repli `@supports not (backdrop-filter: blur(1px))` pour le verre.

Avant de figer les tokens, passe par le skill **`design:design-system`** pour que
l'échelle typographique, les espacements et les couleurs forment un vrai système
plutôt qu'une collection de valeurs choisies au fil de l'eau.

### SEO et structure

Une démo reste une page servie. Utilise **`searchfit-seo:schema-markup`** pour
poser un JSON-LD `Organization` + `Product` sur les trois parfums, et
**`searchfit-seo:seo-check`** en fin de parcours sur le fichier produit. Titre,
meta description, hiérarchie de titres, `alt` sur les images : rien à négocier
même sur une démo.

### Vérification — obligatoire, et sévère

Ne me livre rien sans avoir fait, dans cet ordre :

1. **`design:accessibility-review`** sur le fichier. Une démo saturée d'animation
   est le pire cas pour l'accessibilité : contrastes sur fond animé, cibles
   tactiles, ordre de focus dans les sections épinglées, texte sur vidéo/canvas.
   Attends-toi à devoir corriger, pas à valider.
2. **`design:design-critique`** sur le rendu. Cherche spécifiquement le moment
   où l'animation cesse de servir le contenu et devient du bruit — sur une démo
   volontairement excessive, ce moment existe forcément. Nomme-le.
3. **Contrôle `prefers-reduced-motion`** : simule la préférence et vérifie que
   plus aucune boucle `rAF` ne tourne. C'est une vérification qui s'exécute, pas
   qui se raisonne.
4. **Contrôle console** : zéro erreur, zéro warning WebGL au chargement et après
   un aller-retour complet de scroll.

Rends compte de ce que tu as mesuré, pas de ce que tu as l'intention de faire.
Si un des effets ci-dessus s'avère infaisable proprement en un seul fichier
sans build, dis-le et propose l'alternative — je préfère six sections solides à
sept dont une bancale.

---

## Notes d'usage

**Ce prompt est long, et c'est voulu.** Les demandes courtes (« fais-moi un site
de parfum animé ») produisent un résultat générique : trois sections, un fade-in
au scroll, et pas de parcours dégradé. Le détail de la chorégraphie et les
contraintes non négociables sont ce qui fait la différence.

**À adapter à chaque relance :** le secteur (parfum → horlogerie, spiritueux,
mobilier — la structure tient), le nom de marque, et la liste des sept
mécaniques, qui est le vrai levier de variation.

**Attente réaliste :** un premier jet complet demande plusieurs allers-retours.
Les sections 5 et 6 (épinglage + séquence d'images) sont les plus fragiles en
mono-fichier ; commence par elles si le temps est compté, plutôt que de découvrir
le problème en fin de parcours.
