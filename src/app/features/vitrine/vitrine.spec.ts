import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AbonnementService } from '../../core/services/abonnement.service';
import { COURRIEL_CONTACT, FAQ, FONCTIONNALITES, SECTIONS_VITRINE } from './contenu-vitrine';
import { prixEnClair } from './tarifs-vitrine/tarifs-vitrine';
import { Vitrine } from './vitrine';

const FORMULES = [
  { formule: 'MENSUEL', libelle: 'Abonnement mensuel', prix: 1, devise: 'CAD', duree: '1 mois' },
  { formule: 'ANNUEL', libelle: 'Abonnement annuel', prix: 2, devise: 'CAD', duree: '1 an' },
];

describe('Vitrine publique', () => {
  let fixture: ComponentFixture<Vitrine>;
  let formules: ReturnType<typeof vi.fn>;

  async function creer(): Promise<HTMLElement> {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AbonnementService, useValue: { formules } }] });
    fixture = TestBed.createComponent(Vitrine);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const texte = (el: HTMLElement) => el.textContent?.replace(/\s+/g, ' ') ?? '';
  const lien = (el: HTMLElement, libelle: string) =>
    Array.from(el.querySelectorAll<HTMLAnchorElement>('a')).find((a) => a.textContent?.trim() === libelle)!;

  beforeEach(() => {
    formules = vi.fn(() => of(FORMULES));
  });

  it('un seul h1, les sections et leurs ancres, sans Angular Material', async () => {
    const el = await creer();
    expect(el.querySelectorAll('h1').length).toBe(1);
    expect(el.querySelector('h1')!.textContent).toContain('Créez vos sondages');
    for (const s of SECTIONS_VITRINE) {
      expect(el.querySelector(`#${s.id}`)).not.toBeNull();
      expect(el.querySelector(`nav a[href="#${s.id}"]`)!.textContent).toContain(s.libelle);
    }
    expect(el.querySelectorAll('.grille-fonctionnalites li').length).toBe(FONCTIONNALITES.length);
    expect(el.querySelectorAll('.etapes li').length).toBe(4);
    expect(el.querySelectorAll('details').length).toBe(FAQ.length);
    expect(el.querySelector('[class*="mat-"], [class*="mdc-"]')).toBeNull();
  });

  it('boutons vers les routes réelles : Connexion, Créer un compte, Commencer, Se connecter', async () => {
    const el = await creer();
    expect(lien(el, 'Connexion').getAttribute('href')).toBe('/connexion');
    expect(lien(el, 'Créer un compte').getAttribute('href')).toBe('/inscription');
    expect(lien(el, 'Commencer').getAttribute('href')).toBe('/inscription');
    expect(lien(el, 'Se connecter').getAttribute('href')).toBe('/connexion');
  });

  it('tarifs lus dans l’API (rien d’écrit en dur) ; l’annuel mis en avant s’il coûte moins que douze mois', async () => {
    const el = await creer();
    expect(formules).toHaveBeenCalled();
    const cartes = el.querySelectorAll('#tarifs .carte');
    expect(cartes.length).toBe(2);
    expect(texte(cartes[0] as HTMLElement)).toContain('Abonnement mensuel');
    expect(texte(cartes[0] as HTMLElement)).toContain(prixEnClair({ prix: 1, devise: 'CAD' }).replace(/\s+/g, ' '));
    expect(texte(cartes[0] as HTMLElement)).toContain('CAD / 1 mois');
    expect(cartes[1].classList).toContain('en-avant');
    expect(cartes[1].textContent).toContain('Le plus avantageux');
  });

  it('tarifs indisponibles : message et « Réessayer »', async () => {
    formules.mockReturnValueOnce(throwError(() => new Error('réseau')));
    const el = await creer();
    expect(el.querySelector('#tarifs [role="alert"]')!.textContent).toContain('Les tarifs n’ont pas pu être chargés.');
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Réessayer'))!.click();
    fixture.detectChanges();
    expect(formules).toHaveBeenCalledTimes(2);
    expect(el.querySelectorAll('#tarifs .carte').length).toBe(2);
  });

  it('menu de téléphone : aria-expanded, fermé par Échap ou par un lien', async () => {
    const el = await creer();
    const bouton = el.querySelector<HTMLButtonElement>('.bouton-menu')!;
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    expect(bouton.getAttribute('aria-controls')).toBe('menu-vitrine');
    bouton.click();
    fixture.detectChanges();
    expect(bouton.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('#menu-vitrine')!.classList).toContain('ouvert');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(bouton.getAttribute('aria-expanded')).toBe('false');

    bouton.click();
    fixture.detectChanges();
    el.querySelector<HTMLAnchorElement>('nav a[href="#faq"]')!.click();
    fixture.detectChanges();
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
  });

  it('lien d’une section : focus sur son titre, sans changer de route', async () => {
    const el = await creer();
    el.querySelector<HTMLAnchorElement>('nav a[href="#tarifs"]')!.click();
    expect(document.activeElement).toBe(el.querySelector('#titre-tarifs'));
  });

  it('contact et pied de page : courriel de la constante, © 2026 Batulo', async () => {
    const el = await creer();
    expect(el.querySelector('#contact a')!.getAttribute('href')).toBe(`mailto:${COURRIEL_CONTACT}`);
    expect(COURRIEL_CONTACT).toBe('contact@batulo.example');
    expect(texte(el)).toContain('© 2026 Batulo');
  });
});
