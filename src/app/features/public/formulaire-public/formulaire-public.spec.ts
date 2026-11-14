import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { of, Subject, throwError } from 'rxjs';
import { FormulairePublicResponse } from '../../../core/models/formulaire-public.model';
import { FormulairePublicService } from '../../../core/services/formulaire-public.service';
import { questionDeTest, sectionDeTest } from '../../../testing/donnees-test';
import { DELAI_BROUILLON_MS, FormulairePublic } from './formulaire-public';
import { memoireRepondant } from './memoire-repondant';

const FORMULAIRE: FormulairePublicResponse = {
  titre: 'Malnutrition',
  description: 'Trois minutes',
  reponseUnique: true,
  dateFermeture: '2026-11-30T23:00:00Z',
  sections: [
    sectionDeTest({
      id: 1,
      titre: 'Identification de l’enfant',
      questions: [
        questionDeTest({ id: 1, libelle: 'Vacciné ?', type: 'OUI_NON', options: [], obligatoire: true }),
        questionDeTest({ id: 2, libelle: 'Nom', type: 'TEXTE_COURT', options: [], configuration: { longueurMax: 255 } }),
      ],
    }),
    sectionDeTest({
      id: 2,
      titre: 'Mesures',
      questions: [questionDeTest({ id: 3, libelle: 'Âge (mois)', type: 'NUMERIQUE', options: [], configuration: { decimales: 0 } })],
    }),
  ],
};

function erreurHttp(status: number, code?: string, message = 'Message du serveur.', erreurs?: unknown[]) {
  return new HttpErrorResponse({ status, error: code ? { code, message, ...(erreurs ? { erreurs } : {}) } : null });
}

describe('FormulairePublic (/s/:jeton)', () => {
  let fixture: ComponentFixture<FormulairePublic>;
  let service: { lire: ReturnType<typeof vi.fn>; repondre: ReturnType<typeof vi.fn> };

  async function creer(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(FormulairePublic);
    fixture.componentRef.setInput('jeton', 'Ab3x');
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function cliquer(element: HTMLElement, texte: string): void {
    Array.from(element.querySelectorAll('button'))
      .find((b) => b.textContent?.includes(texte))!
      .click();
    fixture.detectChanges();
  }

  /** Oui à la 1re question, puis section 2. */
  function remplirEtAvancer(element: HTMLElement): void {
    element.querySelector<HTMLInputElement>('app-champ-oui-non input[type="radio"]')!.click();
    fixture.detectChanges();
    cliquer(element, 'Suivant');
  }

  beforeEach(() => {
    localStorage.clear();
    service = { lire: vi.fn(() => of(FORMULAIRE)), repondre: vi.fn() };
    TestBed.configureTestingModule({
      imports: [FormulairePublic],
      providers: [{ provide: FormulairePublicService, useValue: service }],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('affiche le formulaire, sa fermeture prévue et le titre de la page ; aucun Angular Material', async () => {
    const element = await creer();
    expect(service.lire).toHaveBeenCalledWith('Ab3x');
    expect(element.querySelector('h1')!.textContent).toContain('Malnutrition');
    expect(element.textContent).toContain('Ce sondage ferme le');
    expect(element.textContent).toContain('Section 1 sur 2');
    expect(TestBed.inject(Title).getTitle()).toBe('Malnutrition · Batulo');
    expect(element.querySelector('[class*="mat-"], [class*="mdc-"]')).toBeNull();
  });

  it('envoi (réponse unique) : jetonRepondant du sondage, confirmation, brouillon effacé, « déjà répondu » retenu', async () => {
    service.repondre.mockReturnValue(of({ message: 'Merci, vos réponses ont été enregistrées.', dateSoumission: '2026-11-14T10:00:00Z' }));
    const element = await creer();
    remplirEtAvancer(element);
    cliquer(element, 'Envoyer mes réponses');
    const [jeton, soumission] = service.repondre.mock.calls[0];
    expect(jeton).toBe('Ab3x');
    expect(soumission.jetonRepondant).toBe(memoireRepondant.jetonRepondant('Ab3x'));
    expect(soumission.reponses).toEqual([{ questionId: 1, valeur: true }]);

    await fixture.whenStable();
    expect(element.textContent).toContain('Merci, vos réponses ont été enregistrées.');
    expect(document.activeElement?.tagName).toBe('H1');
    expect(element.textContent).not.toContain('Nouvelle réponse');
    expect(memoireRepondant.lireBrouillon('Ab3x')).toBeNull();
    expect(memoireRepondant.dejaRepondu('Ab3x')).toBe(true);

    // Revenir sur le lien : l'écran « déjà répondu », sans recharger le formulaire.
    service.lire.mockClear();
    const retour = await creer();
    expect(retour.textContent).toContain('Vous avez déjà répondu');
    expect(service.lire).not.toHaveBeenCalled();
  });

  it('collecte terrain : sans jetonRepondant, puis « Nouvelle réponse » vide le formulaire', async () => {
    service.lire.mockReturnValue(of({ ...FORMULAIRE, reponseUnique: false }));
    service.repondre.mockReturnValue(of({ message: 'Merci.', dateSoumission: '2026-11-14T10:00:00Z' }));
    const element = await creer();
    remplirEtAvancer(element);
    cliquer(element, 'Envoyer mes réponses');
    expect(service.repondre.mock.calls[0][1].jetonRepondant).toBeUndefined();
    expect(memoireRepondant.dejaRepondu('Ab3x')).toBe(false);

    cliquer(element, 'Nouvelle réponse');
    expect(element.textContent).toContain('Section 1 sur 2');
    expect(Array.from(element.querySelectorAll<HTMLInputElement>('app-champ-oui-non input')).some((r) => r.checked)).toBe(false);
  });

  it('brouillon : écrit pendant la saisie, repris au rechargement avec bandeau ; « Tout effacer » vide', async () => {
    let element = await creer();
    vi.useFakeTimers();
    element.querySelector<HTMLInputElement>('app-champ-oui-non input[type="radio"]')!.click();
    vi.advanceTimersByTime(DELAI_BROUILLON_MS);
    expect(memoireRepondant.lireBrouillon('Ab3x')?.reponses).toEqual({ 1: true });
    vi.useRealTimers();

    element = await creer();
    expect(element.textContent).toContain('Vos réponses en cours ont été reprises.');
    expect(element.querySelector<HTMLInputElement>('app-champ-oui-non input')!.checked).toBe(true);
    cliquer(element, 'Tout effacer');
    expect(memoireRepondant.lireBrouillon('Ab3x')).toBeNull();
    expect(element.querySelector<HTMLInputElement>('app-champ-oui-non input')!.checked).toBe(false);
    expect(element.textContent).not.toContain('Vos réponses en cours ont été reprises.');
  });

  it('refus du serveur (REPONSES_INVALIDES) : message sur la bonne question, dans sa section', async () => {
    service.repondre.mockReturnValue(
      throwError(() => erreurHttp(400, 'REPONSES_INVALIDES', '1 réponse est invalide.', [{ questionId: 2, message: 'Le texte est trop long.' }])),
    );
    const element = await creer();
    remplirEtAvancer(element);
    cliquer(element, 'Envoyer mes réponses');
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.textContent).toContain('Section 1 sur 2');
    expect(element.querySelector('[data-question="2"]')!.textContent).toContain('Le texte est trop long.');
  });

  it('envoi refusé pour trop de requêtes ou réseau : le formulaire et les réponses restent, message clair', async () => {
    service.repondre.mockReturnValue(throwError(() => erreurHttp(429, 'TROP_DE_REQUETES', 'Réessayez dans 30 secondes.')));
    const element = await creer();
    remplirEtAvancer(element);
    cliquer(element, 'Envoyer mes réponses');
    expect(element.querySelector('.erreur-envoi')!.textContent).toContain('Réessayez dans 30 secondes. Vos réponses sont gardées sur cet appareil.');
    expect(element.textContent).toContain('Section 2 sur 2');

    service.repondre.mockReturnValue(throwError(() => erreurHttp(0)));
    cliquer(element, 'Envoyer mes réponses');
    expect(element.querySelector('.erreur-envoi')!.textContent).toContain('vérifiez votre connexion');
  });

  it('envoi : déjà répondu (409) -> écran dédié et drapeau ; envoi en cours -> bouton désactivé', async () => {
    const reponse = new Subject<never>();
    service.repondre.mockReturnValue(reponse);
    const element = await creer();
    remplirEtAvancer(element);
    cliquer(element, 'Envoyer mes réponses');
    expect(Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Envoi en cours'))!.disabled).toBe(true);
    reponse.error(erreurHttp(409, 'DEJA_REPONDU', 'Vous avez déjà répondu à ce sondage depuis cet appareil.'));
    fixture.detectChanges();
    expect(element.querySelector('h1')!.textContent).toContain('Vous avez déjà répondu');
    expect(memoireRepondant.dejaRepondu('Ab3x')).toBe(true);
  });

  it('écrans d’état à l’ouverture : pas encore ouvert, fermé, lien invalide, trop de requêtes, réseau', async () => {
    const cas: [HttpErrorResponse, string, string | null][] = [
      [erreurHttp(403, 'SONDAGE_NON_OUVERT', 'Ce sondage ouvrira le 20 novembre 2026.'), 'Ce sondage n’est pas encore ouvert', 'Ce sondage ouvrira le 20 novembre 2026.'],
      [erreurHttp(410, 'SONDAGE_FERME', 'Fermé.'), 'Ce sondage est fermé', 'Il n’accepte plus de réponses.'],
      [erreurHttp(404, 'SONDAGE_INTROUVABLE', 'x'), 'Lien introuvable', 'Ce lien ne correspond à aucun sondage.'],
      [erreurHttp(429, 'TROP_DE_REQUETES', 'Réessayez dans 12 secondes.'), 'Trop de demandes', 'Réessayez dans 12 secondes.'],
      [erreurHttp(0), 'Connexion impossible', 'Vérifiez votre connexion à Internet.'],
    ];
    for (const [erreur, titre, texte] of cas) {
      service.lire.mockReturnValue(throwError(() => erreur));
      const element = await creer();
      expect(element.querySelector('h1')!.textContent, titre).toContain(titre);
      if (texte) {
        expect(element.textContent, titre).toContain(texte);
      }
      expect(document.activeElement?.tagName, titre).toBe('H1');
    }
  });

  it('« Réessayer » recharge le formulaire', async () => {
    service.lire.mockReturnValueOnce(throwError(() => erreurHttp(0)));
    const element = await creer();
    cliquer(element, 'Réessayer');
    expect(service.lire).toHaveBeenCalledTimes(2);
    expect(element.textContent).toContain('Section 1 sur 2');
  });
});
