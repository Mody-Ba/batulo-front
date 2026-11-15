import { ComponentFixture, TestBed } from '@angular/core/testing';
import { accueilNecessaire } from '../../../core/models/sondage.model';
import { AccueilSondage, ContenuAccueil } from './accueil-sondage';

const CONTENU: ContenuAccueil = {
  titre: 'Malnutrition',
  description: 'Trois minutes',
  objetEnquete: 'Mesurer l’état nutritionnel\ndes enfants.',
  texteConfidentialite: 'Réponses anonymes.',
  consentementRequis: true,
  texteConsentement: 'J’accepte de participer.',
};

describe('Page d’accueil du répondant', () => {
  let fixture: ComponentFixture<AccueilSondage>;

  async function creer(entrees: Record<string, unknown> = {}): Promise<HTMLElement> {
    fixture = TestBed.createComponent(AccueilSondage);
    fixture.componentRef.setInput('contenu', CONTENU);
    for (const [nom, valeur] of Object.entries(entrees)) {
      fixture.componentRef.setInput(nom, valeur);
    }
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const bouton = (el: HTMLElement, texte: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(texte))!;

  function cocher(el: HTMLElement): void {
    el.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click();
    fixture.detectChanges();
  }

  it('titre, description, objet et confidentialité ; éléments natifs, sans Angular Material', async () => {
    const el = await creer();
    expect(el.querySelector('h1')!.textContent).toContain('Malnutrition');
    expect(el.textContent).toContain('Objet de l’enquête');
    expect(el.textContent).toContain('Mesurer l’état nutritionnel');
    expect(el.textContent).toContain('Confidentialité des réponses');
    expect(el.querySelector('fieldset legend')!.textContent).toContain('Consentement');
    expect(el.querySelector('label.case')!.textContent).toContain('J’accepte de participer.');
    expect(el.querySelector('[class*="mat-"], [class*="mdc-"]')).toBeNull();
  });

  it('« Commencer » désactivé et expliqué tant que la case n’est pas cochée ; puis consentement émis', async () => {
    const el = await creer();
    const depart = vi.fn();
    fixture.componentInstance.commencer.subscribe(depart);
    const commencer = bouton(el, 'Commencer le questionnaire');
    expect(commencer.disabled).toBe(true);
    expect(commencer.getAttribute('aria-describedby')).toBe('aide-consentement');
    expect(el.querySelector('#aide-consentement')!.textContent).toContain('Cochez la case');

    cocher(el);
    expect(commencer.disabled).toBe(false);
    expect(commencer.getAttribute('aria-describedby')).toBeNull();
    commencer.click();
    expect(depart).toHaveBeenCalledWith({ consentement: true, reprendre: false });
  });

  it('sans consentement exigé : bouton actif, consentement false', async () => {
    const el = await creer({ contenu: { ...CONTENU, consentementRequis: false } });
    const depart = vi.fn();
    fixture.componentInstance.commencer.subscribe(depart);
    expect(el.querySelector('fieldset')).toBeNull();
    bouton(el, 'Commencer le questionnaire').click();
    expect(depart).toHaveBeenCalledWith({ consentement: false, reprendre: false });
  });

  it('brouillon : « Reprendre » (section N sur M) ou « Recommencer à zéro », la case est à recocher', async () => {
    const el = await creer({ reprise: { section: 1, nombreSections: 3 } });
    const depart = vi.fn();
    fixture.componentInstance.commencer.subscribe(depart);
    expect(bouton(el, 'Reprendre').textContent).toContain('section 2 sur 3');
    expect(bouton(el, 'Reprendre').disabled).toBe(true);
    cocher(el);
    bouton(el, 'Reprendre').click();
    expect(depart).toHaveBeenLastCalledWith({ consentement: true, reprendre: true });
    bouton(el, 'Recommencer à zéro').click();
    expect(depart).toHaveBeenLastCalledWith({ consentement: true, reprendre: false });
  });

  it('erreur du serveur affichée en alerte ; titre de niveau 2 dans l’aperçu', async () => {
    const el = await creer({ erreur: 'Le consentement est obligatoire.', niveauTitre: 2, mode: 'apercu' });
    expect(el.querySelector('[role="alert"]')!.textContent).toContain('Le consentement est obligatoire.');
    expect(el.querySelector('h1')).toBeNull();
    expect(el.querySelector('h2')!.textContent).toContain('Malnutrition');
    expect(el.textContent).toContain('rien n’est enregistré');
  });

  it('page d’accueil nécessaire : un texte d’accueil ou le consentement (la description seule ne suffit pas)', () => {
    expect(accueilNecessaire({})).toBe(false);
    expect(accueilNecessaire({ objetEnquete: '   ', texteConfidentialite: null, consentementRequis: false })).toBe(false);
    expect(accueilNecessaire({ objetEnquete: 'Objet' })).toBe(true);
    expect(accueilNecessaire({ texteConfidentialite: 'Anonyme' })).toBe(true);
    expect(accueilNecessaire({ consentementRequis: true })).toBe(true);
  });
});
