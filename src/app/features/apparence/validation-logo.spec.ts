import { fichierDeTest as fichier, OCTETS_JPEG, OCTETS_PNG } from '../../testing/donnees-test';
import { messageLogoFormat, messageLogoVide, tailleEnClair, typeLogo, verifierLogo } from './validation-logo';

describe('Vérification du logo avant envoi', () => {
  it('PNG et JPEG reconnus à leurs premiers octets (pas à l’extension ni au type annoncé)', async () => {
    expect(typeLogo(new Uint8Array(OCTETS_PNG))).toBe('image/png');
    expect(typeLogo(new Uint8Array(OCTETS_JPEG))).toBe('image/jpeg');
    expect(await verifierLogo(fichier(OCTETS_PNG))).toBeNull();
    expect(await verifierLogo(fichier(OCTETS_JPEG, 'logo.jpg', 'image/jpeg'))).toBeNull();
    // Un GIF renommé en .png, un WebP, un SVG : refusés.
    expect(await verifierLogo(fichier([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 'logo.png'))).toBe(messageLogoFormat());
    expect(await verifierLogo(fichier([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], 'logo.webp', 'image/webp'))).toBe(messageLogoFormat());
    expect(await verifierLogo(fichier([...'<svg'].map((c) => c.charCodeAt(0)), 'logo.svg', 'image/svg+xml'))).toBe(messageLogoFormat());
  });

  it('1 Mo au plus ; fichier vide refusé', async () => {
    expect(await verifierLogo(fichier(OCTETS_PNG, 'logo.png', 'image/png', 1024 * 1024))).toBeNull();
    expect(await verifierLogo(fichier(OCTETS_PNG, 'gros.png', 'image/png', 1024 * 1024 + 1))).toBe(
      'Le logo ne doit pas dépasser 1 Mo (ce fichier fait 1 Mo).',
    );
    expect(await verifierLogo(fichier(OCTETS_PNG, 'gros.png', 'image/png', 1600 * 1024))).toContain('1,6 Mo');
    expect(await verifierLogo(fichier([]))).toBe(messageLogoVide());
    expect(tailleEnClair(35 * 1024)).toBe('35 Ko');
  });
});
