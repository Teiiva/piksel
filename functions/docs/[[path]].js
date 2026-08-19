/**
 * Ferme le dossier /docs au public.
 *
 * Les fichiers de docs/ (notes de lancement, guide de déploiement) sont
 * suivis par git — pratique pour les retrouver — mais ils sont téléversés
 * sur Cloudflare comme n'importe quel autre fichier du dépôt, donc
 * lisibles par qui devine leur nom.
 *
 * Les Pages Functions sont évaluées AVANT les fichiers statiques : cette
 * fonction attrape /docs/... quel que soit le chemin et répond 404, si
 * bien que les fichiers ne sont jamais servis.
 */
export const onRequest = () =>
  new Response('Not Found', {
    status: 404,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      // Par précaution, au cas où un moteur tomberait sur l'adresse.
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
