import { cheminInterne } from './redirection';

describe('cheminInterne (?retour= de la connexion)', () => {
  it('accepte un chemin interne, avec ses paramètres', () => {
    expect(cheminInterne('/admin')).toBe('/admin');
    expect(cheminInterne('/admin/abonnement/paiement-mobile?reference=r1')).toBe('/admin/abonnement/paiement-mobile?reference=r1');
  });

  it('refuse une URL externe, « // », « /\\ », un caractère de contrôle et la connexion elle-même', () => {
    for (const valeur of [
      'https://exemple.test',
      'javascript:alert(1)',
      '//exemple.test',
      '/\\exemple.test',
      '/admin\\..',
      '/ad\nmin',
      'admin',
      '',
      '/connexion',
      '/connexion?retour=/admin',
      undefined,
      null,
      42,
      '/' + 'a'.repeat(2001),
    ]) {
      expect(cheminInterne(valeur)).toBeNull();
    }
  });
});
