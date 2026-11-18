import { environment } from '../../../../environments/environment';
import { urlLogoSure, variablesApparence } from './apparence';

describe('Apparence du formulaire', () => {
  it('couleur personnalisée et valide : variables CSS, texte du backend', () => {
    expect(variablesApparence({ couleurPrincipale: '#1e6b52', couleurTexte: '#FFFFFF' })).toEqual({
      '--bt-marque': '#1E6B52',
      '--bt-sur-marque': '#FFFFFF',
    });
  });

  it('couleur Batulo par défaut, invalide ou absente : rien (le thème garde ses couleurs, sombre compris)', () => {
    expect(variablesApparence({ couleurPrincipale: '#005CBB', couleurTexte: '#FFFFFF' })).toBeNull();
    expect(variablesApparence({ couleurPrincipale: '#005cbb', couleurTexte: '#FFFFFF' })).toBeNull();
    expect(variablesApparence({ couleurPrincipale: 'red; background:url(x)', couleurTexte: '#FFFFFF' })).toBeNull();
    expect(variablesApparence(null)).toBeNull();
  });

  it('couleur de texte invalide : recalculée par contraste', () => {
    expect(variablesApparence({ couleurPrincipale: '#FFD600', couleurTexte: 'blanc' })).toEqual({
      '--bt-marque': '#FFD600',
      '--bt-sur-marque': '#000000',
    });
  });

  it('logo : seul le chemin /api/public/logos/{jeton} est gardé, préfixé par environment.apiUrl, quel que soit l’hôte reçu', () => {
    const api = `${environment.apiUrl}/api/public/logos/2f1c-9a`;
    expect(urlLogoSure('http://localhost:4200/api/public/logos/2f1c-9a')).toBe(api);
    expect(urlLogoSure('http://localhost:8090/api/public/logos/2f1c-9a')).toBe(api);
    expect(urlLogoSure('https://api.batulo.example/api/public/logos/2f1c-9a')).toBe(api);
    expect(urlLogoSure('/api/public/logos/2f1c-9a')).toBe(api);
  });

  it('logo avec apiUrl vide (reseau-local) : chemin relatif /api/public/logos/…, transmis à l’API par le proxy', () => {
    expect(urlLogoSure('http://localhost:4200/api/public/logos/2f1c-9a', '')).toBe('/api/public/logos/2f1c-9a');
    expect(urlLogoSure('http://localhost:8090/api/public/logos/2f1c-9a', '')).toBe('/api/public/logos/2f1c-9a');
    expect(urlLogoSure('javascript:alert(1)', '')).toBeNull();
    expect(urlLogoSure('https://api.batulo.example/api/public/logos/2f1c', 'https://api.batulo.example/')).toBe(
      'https://api.batulo.example/api/public/logos/2f1c',
    );
  });

  it('logo : URL dangereuses ou hors de la route des logos refusées', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:image/png;base64,AAAA',
      'https://exemple.test/piege.png',
      'http://localhost:4200/api/public/logos/',
      'http://localhost:4200/api/public/logos/2f1c/autre',
      'http://localhost:4200/api/public/logos/../../api/admin/x',
      'http://localhost:4200/api/public/logos/2f1c?x=1',
      'http://localhost:4200/api/public/logos/2f1c#x',
      'http://localhost:4200/api/public/logos/%2e%2e',
      'blob:https://autre-site.test/123',
      null,
    ]) {
      expect(urlLogoSure(url)).toBeNull();
    }
  });

  it('aperçu local d’un fichier choisi (blob: de cette page) : gardé tel quel', () => {
    expect(urlLogoSure(`blob:${location.origin}/123-abc`)).toBe(`blob:${location.origin}/123-abc`);
  });
});
