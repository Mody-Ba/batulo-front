import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApercuResponse } from '../../../core/models/sondage.model';
import { SondageService } from '../../../core/services/sondage.service';
import { questionDeTest, sectionDeTest } from '../../../testing/donnees-test';
import { ApercuSondage } from './apercu-sondage';

const APERCU: ApercuResponse = {
  id: 3,
  titre: 'Malnutrition',
  description: null,
  version: 1,
  statut: 'NON_COMMENCE',
  sections: [sectionDeTest({ questions: [questionDeTest({ id: 1, obligatoire: false })] })],
};

describe('Aperçu : page d’accueil', () => {
  async function afficher(apercu: ApercuResponse): Promise<{ el: HTMLElement; detecter: () => void }> {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: SondageService, useValue: { apercu: vi.fn(() => of(apercu)) } }] });
    const f = TestBed.createComponent(ApercuSondage);
    f.componentRef.setInput('id', '3');
    await f.whenStable();
    f.detectChanges();
    return { el: f.nativeElement, detecter: () => f.detectChanges() };
  }

  const bouton = (el: HTMLElement, texte: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(texte))!;

  it('accueil d’abord (case qui fonctionne), puis le formulaire ; « Recommencer » y ramène', async () => {
    const { el, detecter } = await afficher({ ...APERCU, objetEnquete: 'Objet', consentementRequis: true, texteConsentement: 'J’accepte' });
    expect(el.querySelector('app-accueil-sondage h2')!.textContent).toContain('Malnutrition');
    expect(el.querySelector('app-formulaire-sondage')).toBeNull();
    el.querySelector<HTMLInputElement>('app-accueil-sondage input[type="checkbox"]')!.click();
    detecter();
    bouton(el, 'Commencer').click();
    detecter();
    expect(el.querySelector('app-formulaire-sondage')).not.toBeNull();
    bouton(el, 'Recommencer').click();
    detecter();
    expect(el.querySelector('app-accueil-sondage')).not.toBeNull();
  });

  it('sans page d’accueil : directement le formulaire', async () => {
    const { el } = await afficher(APERCU);
    expect(el.querySelector('app-accueil-sondage')).toBeNull();
    expect(el.querySelector('app-formulaire-sondage')).not.toBeNull();
  });

  it('apparence de l’entreprise limitée au cadre du formulaire : bandeau et couleurs ; la page garde celles de Batulo', async () => {
    const { el } = await afficher({
      ...APERCU,
      apparence: { nomAffiche: 'Coopérative de Kaolack', logoUrl: 'https://api.batulo.test/api/public/logos/2f1c', couleurPrincipale: '#1E6B52', couleurTexte: '#FFFFFF' },
    });
    const cadre = el.querySelector<HTMLElement>('.cadre')!;
    expect(cadre.style.getPropertyValue('--bt-marque')).toBe('#1E6B52');
    expect(cadre.querySelector('app-bandeau-apparence img')!.getAttribute('alt')).toBe('Coopérative de Kaolack');
    expect(el.querySelector<HTMLElement>('.conteneur-page')!.style.getPropertyValue('--bt-marque')).toBe('');
  });
});
