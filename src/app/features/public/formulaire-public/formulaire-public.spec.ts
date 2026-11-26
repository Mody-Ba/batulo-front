import { environment } from '../../../../environments/environment';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { of, Subject, throwError } from 'rxjs';
import { FormulairePublicResponse } from '../../../core/models/formulaire-public.model';
import { FormulairePublicService } from '../../../core/services/formulaire-public.service';
import { questionDeTest, sectionDeTest } from '../../../testing/donnees-test';
import { DELAI_BROUILLON_MS, FormulairePublic } from './formulaire-public';
import { memoireRepondant } from './memoire-repondant';
import { CLE_STOCKAGE_LANGUE } from '../../../core/i18n/langues';

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
    // Interface en français (le contenu est demandé dans cette langue).
    localStorage.setItem(CLE_STOCKAGE_LANGUE, '"fr"');
    service = { lire: vi.fn(() => of(FORMULAIRE)), repondre: vi.fn() };
    TestBed.configureTestingModule({
      imports: [FormulairePublic],
      providers: [{ provide: FormulairePublicService, useValue: service }],
    });
  });

  afterEach(() => vi.useRealTimers());

  it('affiche le formulaire, sa fermeture prévue et le titre de la page ; aucun Angular Material', async () => {
    const element = await creer();
    // Premier passage : pas encore de jeton sur l'appareil, rien n'est envoyé.
    expect(service.lire).toHaveBeenCalledWith('Ab3x', null, 'fr', null);
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

    // Revenir sur le lien : le jeton est envoyé, le serveur répond dejaRepondu.
    service.lire.mockReturnValue(of({ ...FORMULAIRE, dejaRepondu: true }));
    const retour = await creer();
    expect(service.lire).toHaveBeenLastCalledWith('Ab3x', memoireRepondant.jetonRepondant('Ab3x'), 'fr', null);
    expect(retour.textContent).toContain('Vous avez déjà répondu');
  });

  it('dejaRepondu du serveur : écran dédié avant la saisie, brouillon effacé', async () => {
    const jeton = memoireRepondant.jetonRepondant('Ab3x');
    memoireRepondant.ecrireBrouillon('Ab3x', 0, { 1: true });
    service.lire.mockReturnValue(of({ ...FORMULAIRE, dejaRepondu: true }));
    const element = await creer();
    expect(service.lire).toHaveBeenCalledWith('Ab3x', jeton, 'fr', null);
    expect(element.querySelector('h1')!.textContent).toContain('Vous avez déjà répondu');
    expect(element.querySelector('app-formulaire-sondage')).toBeNull();
    expect(memoireRepondant.dejaRepondu('Ab3x')).toBe(true);
    expect(memoireRepondant.lireBrouillon('Ab3x')).toBeNull();
  });

  it('le serveur fait foi : drapeau local oublié si dejaRepondu = false ; gardé en repli si le serveur est injoignable', async () => {
    memoireRepondant.marquerRepondu('Ab3x');
    service.lire.mockReturnValue(of({ ...FORMULAIRE, dejaRepondu: false }));
    let element = await creer();
    expect(element.textContent).toContain('Section 1 sur 2');
    expect(memoireRepondant.dejaRepondu('Ab3x')).toBe(false);

    memoireRepondant.marquerRepondu('Ab3x');
    service.lire.mockReturnValue(throwError(() => erreurHttp(0)));
    element = await creer();
    expect(element.querySelector('h1')!.textContent).toContain('Vous avez déjà répondu');
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

  describe('page d’accueil', () => {
    const ACCUEIL: FormulairePublicResponse = {
      ...FORMULAIRE,
      objetEnquete: 'Mesurer l’état nutritionnel.',
      texteConfidentialite: 'Réponses anonymes.',
      consentementRequis: true,
      texteConsentement: 'J’accepte de participer.',
    };

    function cocherConsentement(element: HTMLElement): void {
      element.querySelector<HTMLInputElement>('app-accueil-sondage input[type="checkbox"]')!.click();
      fixture.detectChanges();
    }

    it('sans texte d’accueil ni consentement : directement le questionnaire', async () => {
      const element = await creer();
      expect(element.querySelector('app-accueil-sondage')).toBeNull();
      expect(element.textContent).toContain('Section 1 sur 2');
    });

    it('d’abord l’accueil (titre focalisé), « Commencer » après la case, puis consentement: true à l’envoi', async () => {
      service.lire.mockReturnValue(of(ACCUEIL));
      service.repondre.mockReturnValue(of({ message: 'Merci', dateSoumission: '2026-11-14T10:00:00Z' }));
      const element = await creer();
      await fixture.whenStable();
      expect(element.querySelector('app-formulaire-sondage')).toBeNull();
      expect(document.activeElement).toBe(element.querySelector('app-accueil-sondage h1'));
      expect(element.textContent).toContain('Ce sondage ferme le');
      const commencer = Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes('Commencer'))!;
      expect(commencer.disabled).toBe(true);
      cocherConsentement(element);
      commencer.click();
      fixture.detectChanges();

      remplirEtAvancer(element);
      cliquer(element, 'Envoyer mes réponses');
      expect(service.repondre.mock.calls[0][1]).toEqual(expect.objectContaining({ consentement: true }));
    });

    it('sans consentement exigé : rien de tel dans le corps', async () => {
      service.lire.mockReturnValue(of({ ...ACCUEIL, consentementRequis: false }));
      service.repondre.mockReturnValue(of({ message: 'Merci', dateSoumission: '2026-11-14T10:00:00Z' }));
      const element = await creer();
      cliquer(element, 'Commencer');
      remplirEtAvancer(element);
      cliquer(element, 'Envoyer mes réponses');
      expect(service.repondre.mock.calls[0][1]).not.toHaveProperty('consentement');
    });

    it('brouillon : proposé sur l’accueil (case à recocher), « Reprendre » le remet, « Recommencer à zéro » l’efface', async () => {
      service.lire.mockReturnValue(of(ACCUEIL));
      memoireRepondant.ecrireBrouillon('Ab3x', 1, { 1: true });
      let element = await creer();
      expect(element.querySelector('app-formulaire-sondage')).toBeNull();
      expect(element.textContent).not.toContain('Vos réponses en cours ont été reprises');
      cocherConsentement(element);
      cliquer(element, 'Reprendre');
      expect(element.textContent).toContain('Section 2 sur 2');

      element = await creer();
      cocherConsentement(element);
      cliquer(element, 'Recommencer à zéro');
      expect(element.textContent).toContain('Section 1 sur 2');
      expect(memoireRepondant.lireBrouillon('Ab3x')).toBeNull();
    });

    it('refus du serveur faute de consentement : retour à l’accueil avec le message, réponses gardées', async () => {
      service.lire.mockReturnValue(of(ACCUEIL));
      service.repondre.mockReturnValue(throwError(() => erreurHttp(400, 'CONSENTEMENT_REQUIS', 'Le consentement est obligatoire.')));
      const element = await creer();
      cocherConsentement(element);
      cliquer(element, 'Commencer');
      remplirEtAvancer(element);
      cliquer(element, 'Envoyer mes réponses');
      expect(element.querySelector('app-accueil-sondage [role="alert"]')!.textContent).toContain('Le consentement est obligatoire.');
      cocherConsentement(element);
      cliquer(element, 'Reprendre');
      expect(element.textContent).toContain('Section 2 sur 2');
    });

    it('collecte terrain : « Nouvelle réponse » revient à l’accueil, case décochée', async () => {
      service.lire.mockReturnValue(of({ ...ACCUEIL, reponseUnique: false }));
      service.repondre.mockReturnValue(of({ message: 'Merci', dateSoumission: '2026-11-14T10:00:00Z' }));
      const element = await creer();
      cocherConsentement(element);
      cliquer(element, 'Commencer');
      remplirEtAvancer(element);
      cliquer(element, 'Envoyer mes réponses');
      cliquer(element, 'Nouvelle réponse');
      expect(element.querySelector('app-accueil-sondage')).not.toBeNull();
      expect(element.querySelector<HTMLInputElement>('app-accueil-sondage input[type="checkbox"]')!.checked).toBe(false);
    });
  });

  describe('apparence de l’entreprise', () => {
    const page = (element: HTMLElement) => element.querySelector<HTMLElement>('main.page-publique')!;

    it('personnalisée : logo (texte alternatif = nom affiché, taille limitée) et couleurs en variables CSS', async () => {
      service.lire.mockReturnValue(
        of({
          ...FORMULAIRE,
          apparence: {
            nomAffiche: 'Coopérative de Kaolack',
            logoUrl: 'http://localhost:4200/api/public/logos/2f1c',
            couleurPrincipale: '#ffd600',
            couleurTexte: '#000000',
          },
        }),
      );
      const element = await creer();
      expect(page(element).style.getPropertyValue('--bt-marque')).toBe('#FFD600');
      expect(page(element).style.getPropertyValue('--bt-sur-marque')).toBe('#000000');
      const logo = element.querySelector<HTMLImageElement>('app-bandeau-apparence img')!;
      // Hôte reçu ignoré : le chemin du logo est chargé depuis l'API.
      expect(logo.getAttribute('src')).toBe(`${environment.apiUrl}/api/public/logos/2f1c`);
      expect(logo.getAttribute('alt')).toBe('Coopérative de Kaolack');
      expect(logo.classList).toContain('logo-apparence');
      expect(element.querySelector('app-bandeau-apparence .nom-apparence')!.getAttribute('aria-hidden')).toBe('true');
    });

    it('sans personnalisation (couleur Batulo, pas de logo) : aucune variable ni bandeau, apparence inchangée', async () => {
      service.lire.mockReturnValue(
        of({ ...FORMULAIRE, apparence: { nomAffiche: 'Sahel Data', couleurPrincipale: '#005CBB', couleurTexte: '#FFFFFF' } }),
      );
      const element = await creer();
      expect(page(element).getAttribute('style') ?? '').not.toContain('--bt-marque');
      expect(element.querySelector('app-bandeau-apparence img')).toBeNull();
      expect(element.textContent).not.toContain('Sahel Data');
    });

    it('valeurs dangereuses ignorées : couleur hors format, logo javascript:', async () => {
      service.lire.mockReturnValue(
        of({
          ...FORMULAIRE,
          apparence: { nomAffiche: 'X', logoUrl: 'javascript:alert(1)', couleurPrincipale: 'red;background:url(x)', couleurTexte: '#FFFFFF' },
        }),
      );
      const element = await creer();
      expect(page(element).getAttribute('style') ?? '').toBe('');
      expect(element.querySelector('app-bandeau-apparence img')).toBeNull();
    });
  });
});
