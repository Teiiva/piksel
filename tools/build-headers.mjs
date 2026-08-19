/**
 * Regenere la Content-Security-Policy du fichier `_headers`.
 *
 * Pourquoi un script ?
 * --------------------
 * La CSP du site interdit les scripts et les styles inline, sauf ceux dont
 * l'empreinte SHA-256 est explicitement listee. C'est ce qui permet de garder
 * le CSS et le JS dans index.html (une seule requete, premier affichage plus
 * rapide) sans ouvrir la porte au XSS : un script injecte par un attaquant
 * n'aura jamais la bonne empreinte, donc le navigateur refusera de l'executer.
 *
 * La contrepartie : la moindre modification d'un bloc <script> ou <style>
 * change son empreinte et casse la page. D'ou ce script, a relancer apres
 * chaque retouche du HTML :
 *
 *     node tools/build-headers.mjs
 *
 * Il relit les fichiers HTML, recalcule les empreintes et reecrit la ligne
 * `Content-Security-Policy` de `_headers`. Avec `--check`, il ne modifie rien
 * et sort en erreur si `_headers` n'est plus a jour — pratique en CI ou en
 * hook de pre-commit.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const FICHIER_HEADERS = join(RACINE, '_headers');
const MARQUEUR = '  Content-Security-Policy:';

/** Domaines tiers reellement charges par le site. */
const TURNSTILE = 'https://challenges.cloudflare.com';

const sha256 = (contenu) =>
  `'sha256-${createHash('sha256').update(contenu, 'utf8').digest('base64')}'`;

/**
 * Extrait le contenu des balises inline. On vise volontairement large
 * (`<script>` sans `src`, quel que soit son `type`) car Chrome applique aussi
 * la CSP aux blocs `application/ld+json`.
 */
function empreintes(html, balise) {
  const motif = new RegExp(`<${balise}([^>]*)>([\\s\\S]*?)</${balise}>`, 'gi');
  const trouvees = [];
  for (const [, attributs, contenu] of html.matchAll(motif)) {
    if (/\ssrc\s*=/i.test(attributs)) continue; // script externe : pas d'empreinte
    trouvees.push(sha256(contenu));
  }
  return trouvees;
}

const pagesHtml = readdirSync(RACINE).filter((f) => f.endsWith('.html')).sort();

const hashScripts = new Set();
const hashStyles = new Set();
for (const page of pagesHtml) {
  const html = readFileSync(join(RACINE, page), 'utf8');
  empreintes(html, 'script').forEach((h) => hashScripts.add(h));
  empreintes(html, 'style').forEach((h) => hashStyles.add(h));
}

const directives = [
  // Tout est interdit par defaut ; chaque type de ressource est ouvert
  // explicitement ci-dessous. Une balise oubliee est bloquee, pas toleree.
  `default-src 'none'`,
  `script-src 'self' ${TURNSTILE} ${[...hashScripts].join(' ')}`,
  `style-src 'self' ${[...hashStyles].join(' ')}`,
  `img-src 'self' data:`,
  `font-src 'self'`,
  // Le formulaire poste sur /api/contact ; Turnstile dialogue avec Cloudflare.
  `connect-src 'self' ${TURNSTILE}`,
  // Le captcha s'affiche dans une iframe servie par Cloudflare.
  `frame-src ${TURNSTILE}`,
  // Personne n'a de raison d'encadrer ce site : bloque le clickjacking.
  `frame-ancestors 'none'`,
  `form-action 'self'`,
  `base-uri 'none'`,
  `object-src 'none'`,
  `worker-src 'none'`,
  `manifest-src 'self'`,
  // Rattrape une eventuelle URL en http:// oubliee dans le contenu.
  `upgrade-insecure-requests`,
];

const ligneCsp = `${MARQUEUR} ${directives.join('; ')}`;

const actuel = readFileSync(FICHIER_HEADERS, 'utf8');
if (!actuel.split('\n').some((l) => l.startsWith(MARQUEUR))) {
  console.error(`Aucune ligne "${MARQUEUR.trim()}" dans _headers — ajoute-la d'abord.`);
  process.exit(1);
}
const attendu = actuel
  .split('\n')
  .map((l) => (l.startsWith(MARQUEUR) ? ligneCsp : l))
  .join('\n');

if (process.argv.includes('--check')) {
  if (actuel !== attendu) {
    console.error('_headers n\'est plus a jour : relance `node tools/build-headers.mjs`.');
    process.exit(1);
  }
  console.log('_headers est a jour.');
} else if (actuel === attendu) {
  console.log('_headers etait deja a jour.');
} else {
  writeFileSync(FICHIER_HEADERS, attendu);
  console.log(
    `_headers mis a jour — ${hashScripts.size} empreinte(s) de script, ` +
    `${hashStyles.size} de style, sur ${pagesHtml.length} page(s).`
  );
}
