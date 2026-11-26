import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CLE_STOCKAGE_LANGUE } from '../../../core/i18n/langues';
import { LangueService } from '../../../core/i18n/langue.service';
import { FormulairePublicResponse } from '../../../core/models/formulaire-public.model';
import { FormulairePublicService } from '../../../core/services/formulaire-public.service';
import { questionDeTest, sectionDeTest } from '../../../testing/donnees-test';
import { FormulairePublic, raisonSelonErreur } from './formulaire-public';
import { memoireRepondant } from './memoire-repondant';

const FORMULAIRE: FormulairePublicResponse = {
  titre: 'Satisfaction des clients',
  description: null,
  dateFermeture: null,
  reponseUnique: false,
  sections: [sectionDeTest({ id: 1, titre: 'Accueil', questions: [questionDeTest({ id: 1, libelle: 'Satisfait ?', type: 'OUI_NON', options: [] })] })],
};

const erreur = (status: number, code: string) => new HttpErrorResponse({ status, error: { code, message: 'Message du serveur.' } });

describe('FormulairePublic : lien personnel (?i=)', () => {
  let fixture: ComponentFixture<FormulairePublic>;
  let service: { lire: ReturnType<typeof vi.fn>; repondre: ReturnType<typeof vi.fn> };

  async function creer(i: string | undefined = 'jeton-perso'): Promise<HTMLElement> {
    fixture = TestBed.createComponent(FormulairePublic);
    fixture.componentRef.setInput('jeton', 'Ab3x');
    fixture.componentRef.setInput('i', i);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  const titre = (el: HTMLElement) => el.querySelector('h1')!.textContent!.trim();

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(CLE_STOCKAGE_LANGUE, '"fr"');
    service = { lire: vi.fn(() => of(FORMULAIRE)), repondre: vi.fn() };
    TestBed.configureTestingModule({
      imports: [FormulairePublic],
      providers: [{ provide: FormulairePublicService, useValue: service }],
    });
  });

  it('raisons : révoqué (410), invalide (404), déjà utilisé (409 DEJA_REPONDU avec un lien personnel seulement)', () => {
    expect(raisonSelonErreur(erreur(410, 'INVITATION_REVOQUEE'), true, true)).toBe('lien-revoque');
    expect(raisonSelonErreur(erreur(404, 'INVITATION_INVALIDE'), true, true)).toBe('lien-invalide');
    expect(raisonSelonErreur(erreur(409, 'DEJA_REPONDU'), false, true)).toBe('lien-utilise');
    expect(raisonSelonErreur(erreur(409, 'DEJA_REPONDU'), false, false)).toBe('deja-repondu');
  });

  it('lecture : jeton personnel en en-tête, sans langue (celle de l’invité) ni jeton d’appareil ; l’interface suit la langue servie', async () => {
    memoireRepondant.jetonRepondant('Ab3x');
    service.lire.mockReturnValue(of({ ...FORMULAIRE, langue: 'en', languesDisponibles: ['fr', 'en'] }));
    await creer();
    expect(service.lire).toHaveBeenCalledWith('Ab3x', null, null, 'jeton-perso');
    await vi.waitFor(() => expect(TestBed.inject(LangueService).langue()).toBe('en'));
    // Contenu déjà dans la langue servie : pas de seconde lecture.
    expect(service.lire).toHaveBeenCalledTimes(1);
    // La visite seulement : le choix mémorisé n'est pas touché.
    expect(localStorage.getItem(CLE_STOCKAGE_LANGUE)).toBe('"fr"');
  });

  it('mode nominatif : mention visible sur le questionnaire ; absente en mode anonyme', async () => {
    service.lire.mockReturnValue(of({ ...FORMULAIRE, invitation: { dejaRepondu: false, reponsesNominatives: true } }));
    let el = await creer();
    expect(el.querySelector('.mention-nominative')?.textContent).toContain('vos réponses seront associées à votre nom et à votre courriel');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [FormulairePublic], providers: [{ provide: FormulairePublicService, useValue: service }] });
    service.lire.mockReturnValue(of({ ...FORMULAIRE, invitation: { dejaRepondu: false, reponsesNominatives: false } }));
    el = await creer();
    expect(el.querySelector('app-formulaire-sondage')).not.toBeNull();
    expect(el.querySelector('.mention-nominative')).toBeNull();
  });

  it('lien déjà utilisé (invitation.dejaRepondu) : écran dédié, pas de formulaire', async () => {
    service.lire.mockReturnValue(of({ ...FORMULAIRE, invitation: { dejaRepondu: true, reponsesNominatives: false } }));
    const el = await creer();
    expect(titre(el)).toBe('Lien déjà utilisé');
    expect(el.textContent).toContain('Ce lien personnel a déjà servi');
    expect(el.querySelector('app-formulaire-sondage')).toBeNull();
  });

  it('lien révoqué et lien invalide : écrans dédiés', async () => {
    service.lire.mockReturnValue(throwError(() => erreur(410, 'INVITATION_REVOQUEE')));
    let el = await creer();
    expect(titre(el)).toBe('Lien désactivé');
    expect(el.textContent).toContain('désactivé par l’organisateur');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [FormulairePublic], providers: [{ provide: FormulairePublicService, useValue: service }] });
    service.lire.mockReturnValue(throwError(() => erreur(404, 'INVITATION_INVALIDE')));
    el = await creer();
    expect(titre(el)).toBe('Lien personnel invalide');
  });

  it('envoi : jetonInvitation dans le corps (pas de jeton d’appareil) ; confirmation sans « Nouvelle réponse »', async () => {
    service.repondre.mockReturnValue(of({ message: 'Merci, votre réponse a été enregistrée.', dateSoumission: '2026-11-25T10:00:00Z' }));
    const el = await creer();
    el.querySelector<HTMLInputElement>('app-champ-oui-non input[type="radio"]')!.click();
    fixture.detectChanges();
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Envoyer mes réponses'))!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    const [, soumission] = service.repondre.mock.calls[0];
    expect(soumission.jetonInvitation).toBe('jeton-perso');
    expect(soumission.jetonRepondant).toBeUndefined();
    expect(el.textContent).toContain('Merci, votre réponse a été enregistrée.');
    expect(Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.includes('Nouvelle réponse'))).toBe(false);
  });

  it('409 DEJA_REPONDU à l’envoi : « Lien déjà utilisé », sans marquer l’appareil', async () => {
    service.repondre.mockReturnValue(throwError(() => erreur(409, 'DEJA_REPONDU')));
    const el = await creer();
    el.querySelector<HTMLInputElement>('app-champ-oui-non input[type="radio"]')!.click();
    fixture.detectChanges();
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Envoyer mes réponses'))!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(titre(el)).toBe('Lien déjà utilisé');
    expect(memoireRepondant.dejaRepondu('Ab3x')).toBe(false);
  });
});
