import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { Role } from '../../core/models/role.model';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { PersonnalisationService } from '../../core/services/personnalisation.service';
import { fichierDeTest, OCTETS_PNG, personnalisationDeTest } from '../../testing/donnees-test';
import { MESSAGE_GESTIONNAIRE, PageApparence } from './page-apparence';
import { MESSAGE_LOGO_FORMAT } from './validation-logo';
import { ZoneLogo } from './zone-logo';

/** Comme le renvoie le backend avec APP_BASE_URL=http://localhost:4200 (le front, pas l'API). */
const LOGO = {
  url: 'http://localhost:4200/api/public/logos/2f1c',
  typeMime: 'image/png',
  taille: 35 * 1024,
  largeur: 400,
  hauteur: 120,
  dateModification: '2026-11-16T10:00:00Z',
};
/** Ce que le front affiche : le chemin du logo sur l'API (environment.apiUrl). */
const LOGO_API = `${environment.apiUrl}/api/public/logos/2f1c`;
const PERSONNALISEE = personnalisationDeTest({
  nomAffiche: 'Coopérative de Kaolack',
  nomEffectif: 'Coopérative de Kaolack',
  couleurPrincipale: '#1E6B52',
  couleurEffective: '#1E6B52',
  couleurTexte: '#FFFFFF',
  logo: LOGO,
});

describe('PageApparence (/apparence)', () => {
  let fixture: ComponentFixture<PageApparence>;
  let element: HTMLElement;
  let service: Record<'lire' | 'modifier' | 'remplacerLogo' | 'supprimerLogo', ReturnType<typeof vi.fn>>;
  const role = signal<Role>('ADMIN');
  const lectureSeule = signal(false);
  let confirmation: boolean;

  async function creer(): Promise<void> {
    fixture = TestBed.createComponent(PageApparence);
    element = fixture.nativeElement;
    await fixture.whenStable();
    fixture.detectChanges();
  }
  const stable = async () => {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const texte = () => (element.textContent ?? '').replace(/\s+/g, ' ');
  const bouton = (libelle: string) => Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith(libelle));
  const champCouleur = () => element.querySelector<HTMLInputElement>('.champ-couleur input')!;
  const selecteur = () => element.querySelector<HTMLInputElement>('input[type="color"]')!;
  const variables = () => element.querySelector<HTMLElement>('app-apercu-apparence figure')!.style;

  function saisir(champ: HTMLInputElement, valeur: string, evenement = 'input'): void {
    champ.value = valeur;
    champ.dispatchEvent(new Event(evenement));
    fixture.detectChanges();
  }

  beforeEach(() => {
    role.set('ADMIN');
    lectureSeule.set(false);
    confirmation = true;
    service = {
      lire: vi.fn(() => of(PERSONNALISEE)),
      modifier: vi.fn(() => of(PERSONNALISEE)),
      remplacerLogo: vi.fn(() => of(PERSONNALISEE)),
      supprimerLogo: vi.fn(() => of(personnalisationDeTest({ ...PERSONNALISEE, logo: null }))),
    };
    URL.createObjectURL = vi.fn(() => `blob:${location.origin}/logo-local`);
    URL.revokeObjectURL = vi.fn();
    TestBed.configureTestingModule({
      imports: [PageApparence],
      providers: [
        { provide: PersonnalisationService, useValue: service },
        { provide: AuthService, useValue: { role, lectureSeule } },
        { provide: MatDialog, useValue: { open: vi.fn(() => ({ afterClosed: () => of(confirmation) })) } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
  });

  it('valeurs enregistrées et aperçu en direct : logo, nom, couleur et texte renvoyés par le backend', async () => {
    await creer();
    expect(champCouleur().value).toBe('#1E6B52');
    expect(selecteur().value).toBe('#1e6b52');
    const apercu = element.querySelector('app-apercu-apparence')!;
    expect(apercu.querySelector('img')!.getAttribute('src')).toBe(LOGO_API);
    expect(apercu.querySelector('img')!.getAttribute('alt')).toBe('Coopérative de Kaolack');
    expect(variables().getPropertyValue('--bt-marque')).toBe('#1E6B52');
    expect(variables().getPropertyValue('--bt-sur-marque')).toBe('#FFFFFF');
    expect(texte()).toContain('PNG · 35 Ko · 400 × 120 px');
  });

  it('couleur : sélecteur et champ hexadécimal synchronisés ; saisie invalide refusée ; « Couleur par défaut »', async () => {
    await creer();
    saisir(selecteur(), '#ffd600');
    expect(champCouleur().value).toBe('#FFD600');
    // Couleur pas encore enregistrée : texte recalculé par contraste (noir sur jaune).
    expect(variables().getPropertyValue('--bt-marque')).toBe('#FFD600');
    expect(variables().getPropertyValue('--bt-sur-marque')).toBe('#000000');

    saisir(champCouleur(), '#3366cc');
    expect(selecteur().value).toBe('#3366cc');
    saisir(champCouleur(), '3366cc', 'blur');
    expect(champCouleur().value).toBe('#3366CC');

    saisir(champCouleur(), '#33');
    champCouleur().dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(texte()).toContain('Format attendu : # suivi de 6 chiffres ou lettres');
    expect(selecteur().value).toBe('#1e6b52');
    bouton('Enregistrer')!.click();
    expect(service.modifier).not.toHaveBeenCalled();

    bouton('Couleur par défaut')!.click();
    fixture.detectChanges();
    expect(champCouleur().value).toBe('');
    expect(variables().getPropertyValue('--bt-marque')).toBe('');
    bouton('Enregistrer')!.click();
    // Seul ce qui a changé est envoyé.
    expect(service.modifier).toHaveBeenCalledWith({ couleurPrincipale: '' });
  });

  it('bug : aucune couleur enregistrée -> champ vide, sélecteur sur #005cbb (jamais noir), rien envoyé pour la couleur', async () => {
    service.lire.mockReturnValue(of(personnalisationDeTest()));
    await creer();
    expect(champCouleur().value).toBe('');
    expect(champCouleur().getAttribute('placeholder')).toBe('Couleur Batulo (#005CBB)');
    expect(selecteur().value).toBe('#005cbb');
    expect(variables().getPropertyValue('--bt-marque')).toBe('');

    // Navigateur qui a perdu la valeur du sélecteur (#000000 par défaut) : réécrite au rendu suivant.
    selecteur().value = '#000000';
    saisir(element.querySelector<HTMLInputElement>('input[autocomplete="organization"]')!, 'Coopérative');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(selecteur().value).toBe('#005cbb');

    // Ouvrir puis fermer le sélecteur sans choisir : aucune couleur n'est imposée.
    saisir(selecteur(), '#005cbb');
    expect(champCouleur().value).toBe('');
    expect(variables().getPropertyValue('--bt-marque')).toBe('');

    bouton('Enregistrer')!.click();
    expect(service.modifier).toHaveBeenCalledWith({ nomAffiche: 'Coopérative' });
  });

  it('rien de modifié : aucun appel au serveur', async () => {
    await creer();
    bouton('Enregistrer')!.click();
    expect(service.modifier).not.toHaveBeenCalled();
  });

  it('bug : logo renvoyé sur l’hôte du front (APP_BASE_URL=4200) -> chargé depuis l’API, partout', async () => {
    await creer();
    expect(element.querySelector('.zone-logo img')!.getAttribute('src')).toBe(LOGO_API);
    expect(element.querySelector('app-apercu-apparence img')!.getAttribute('src')).toBe(LOGO_API);
    expect(element.innerHTML).not.toContain('localhost:4200/api');
  });

  it('image du logo illisible (API injoignable) -> message clair au lieu d’une image cassée', async () => {
    await creer();
    const image = element.querySelector<HTMLImageElement>('.zone-logo img')!;
    image.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(element.querySelector('.zone-logo img')).toBeNull();
    const message = element.querySelector('.zone-logo .erreur-logo')!;
    expect(message.getAttribute('role')).toBe('alert');
    expect(message.textContent).toContain(LOGO_API);
    expect(message.textContent).toContain('Vérifiez que l’API Batulo répond');
    // L'aperçu du formulaire retire le bandeau plutôt que d'afficher une icône cassée.
    element.querySelector<HTMLImageElement>('app-apercu-apparence img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(element.querySelector('app-apercu-apparence img')).toBeNull();
  });

  it('refus du serveur (400 COULEUR_INVALIDE) : message affiché', async () => {
    service.modifier.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { code: 'COULEUR_INVALIDE', message: 'Couleur invalide : format #RRGGBB attendu.' } })),
    );
    await creer();
    saisir(champCouleur(), '#3366CC');
    bouton('Enregistrer')!.click();
    fixture.detectChanges();
    expect(texte()).toContain('L’apparence n’a pas été enregistrée');
    expect(texte()).toContain('Couleur invalide');
  });

  it('gestionnaire : lecture seule, valeurs et aperçu sans aucun bouton ni champ de modification', async () => {
    role.set('GESTIONNAIRE');
    await creer();
    expect(texte()).toContain(MESSAGE_GESTIONNAIRE);
    expect(element.querySelectorAll('button').length).toBe(0);
    expect(element.querySelector('input[type="color"], .champ-couleur, .zone-depot')).toBeNull();
    expect(texte()).toContain('#1E6B52');
    expect(texte()).toContain('Coopérative de Kaolack');
    expect(element.querySelector('app-apercu-apparence img')).not.toBeNull();
  });

  it('admin dont l’abonnement a expiré : lecture seule aussi', async () => {
    lectureSeule.set(true);
    await creer();
    expect(texte()).toContain('Abonnement expiré : lecture seule.');
    expect(element.querySelectorAll('button').length).toBe(0);
  });

  describe('logo', () => {
    it('fichier refusé avant l’envoi : message clair, rien n’est envoyé', async () => {
      service.lire.mockReturnValue(of(personnalisationDeTest()));
      await creer();
      const zone = fixture.debugElement.query((d) => d.componentInstance instanceof ZoneLogo).componentInstance as ZoneLogo;
      await zone.prendre(fichierDeTest([0x47, 0x49, 0x46, 0x38], 'anim.png'));
      fixture.detectChanges();
      expect(element.querySelector('.erreur-logo')!.textContent).toContain(MESSAGE_LOGO_FORMAT);
      expect(element.querySelector('.erreur-logo')!.getAttribute('role')).toBe('alert');
      expect(service.remplacerLogo).not.toHaveBeenCalled();
    });

    it('glisser-déposer : aperçu local (aussi dans l’en-tête), puis « Enregistrer ce logo » ; erreur du serveur affichée', async () => {
      service.lire.mockReturnValue(of(personnalisationDeTest()));
      service.remplacerLogo.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 400, error: { code: 'LOGO_DIMENSIONS', message: 'Le logo ne doit pas dépasser 2000 x 2000 pixels.' } })),
      );
      await creer();
      expect(element.querySelector('app-apercu-apparence img')).toBeNull();
      const fichier = fichierDeTest(OCTETS_PNG, 'logo.png');
      const depot = new Event('drop') as DragEvent;
      Object.defineProperty(depot, 'dataTransfer', { value: { files: [fichier] } });
      element.querySelector('.zone-depot')!.dispatchEvent(depot);
      await stable();
      expect(element.querySelector('.zone-logo img')!.getAttribute('src')).toBe(`blob:${location.origin}/logo-local`);
      expect(element.querySelector('app-apercu-apparence img')!.getAttribute('src')).toBe(`blob:${location.origin}/logo-local`);
      expect(texte()).toContain('pas encore enregistré');

      bouton('Enregistrer ce logo')!.click();
      fixture.detectChanges();
      expect(service.remplacerLogo).toHaveBeenCalledWith(fichier);
      expect(texte()).toContain('Le logo n’a pas été enregistré');
      expect(texte()).toContain('2000 x 2000 pixels');

      bouton('Enregistrer ce logo')!.click();
      fixture.detectChanges();
      expect(texte()).toContain('PNG · 35 Ko');
      expect(URL.revokeObjectURL).toHaveBeenCalledWith(`blob:${location.origin}/logo-local`);
    });

    it('supprimer : après confirmation seulement', async () => {
      await creer();
      confirmation = false;
      bouton('Supprimer')!.click();
      expect(service.supprimerLogo).not.toHaveBeenCalled();
      confirmation = true;
      bouton('Supprimer')!.click();
      fixture.detectChanges();
      expect(service.supprimerLogo).toHaveBeenCalledTimes(1);
      expect(element.querySelector('.zone-logo .logo-actuel')).toBeNull();
      expect(element.querySelector('app-apercu-apparence img')).toBeNull();
    });
  });
});
