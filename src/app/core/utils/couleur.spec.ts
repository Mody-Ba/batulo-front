import { contraste, couleurTexte, couleurValide, normaliserCouleur } from './couleur';

describe('Couleurs (règles de ContrasteCouleur du backend)', () => {
  it('format #RRGGBB seulement', () => {
    expect(couleurValide('#1E6B52')).toBe(true);
    expect(couleurValide('#1e6b52')).toBe(true);
    for (const v of ['1E6B52', '#1E6B5', '#1E6B522', 'red', 'rgb(0,0,0)', '#12345G', 'url(x)', '', null, 42]) {
      expect(couleurValide(v)).toBe(false);
    }
    expect(normaliserCouleur('#1e6b52')).toBe('#1E6B52');
  });

  it('texte blanc ou noir selon le meilleur contraste WCAG (à égalité : blanc)', () => {
    expect(couleurTexte('#005CBB')).toBe('#FFFFFF');
    expect(couleurTexte('#1E6B52')).toBe('#FFFFFF');
    expect(couleurTexte('#FFD600')).toBe('#000000');
    expect(couleurTexte('#FFFFFF')).toBe('#000000');
    expect(couleurTexte('#000000')).toBe('#FFFFFF');
    expect(contraste('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });
});
