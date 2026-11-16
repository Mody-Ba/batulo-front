/**
 * Paramètre ?retour= de la connexion : page où revenir une fois connecté (ex. retour de Moosyl sur un téléphone
 * qui n'avait pas de session). Contre les redirections ouvertes, seul un chemin interne est accepté : il commence
 * par un seul « / » (ni « // » ni « /\ », que les navigateurs lisent comme une autre origine), sans caractère de
 * contrôle, et ne mène pas à la connexion elle-même.
 */
export function cheminInterne(valeur: unknown): string | null {
  if (typeof valeur !== 'string' || valeur.length > 2000) {
    return null;
  }
  if (!valeur.startsWith('/') || valeur.startsWith('//') || valeur.startsWith('/\\')) {
    return null;
  }
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(valeur)) {
    return null;
  }
  if (valeur === '/connexion' || valeur.startsWith('/connexion?') || valeur.startsWith('/connexion#')) {
    return null;
  }
  return valeur;
}
