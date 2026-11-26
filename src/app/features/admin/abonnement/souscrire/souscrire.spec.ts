import { HttpErrorResponse } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localeFrCa from '@angular/common/locales/fr-CA';
import { LOCALE_ID, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import {
  AbonnementResponse,
  FormuleResponse,
  IntentionPaiementResponse,
} from '../../../../core/models/abonnement.model';
import { AbonnementService } from '../../../../core/services/abonnement.service';
import {
  abonnementDeTest,
  creditsDeTest,
  FORMULES_DE_TEST,
  formulesDeTest,
  sessionMobileDeTest,
  statutMobileDeTest,
} from '../../../../testing/donnees-test';
import { AuthService } from '../../../../core/services/auth.service';
import { StripeService } from '../../../../core/services/stripe.service';
import { DELAI_REDIRECTION_MS, messageCarteIncomplete, MESSAGE_RECONNEXION, Souscrire } from './souscrire';

registerLocaleData(localeFrCa);

const FORMULES: FormuleResponse[] = FORMULES_DE_TEST;
const INTENTION: IntentionPaiementResponse = {
  paymentIntentId: 'pi_123',
  clientSecret: 'pi_123_secret_abc',
  clePublique: 'pk_test_123',
  formule: 'ANNUEL',
  montant: 2,
  devise: 'CAD',
};

/** Faux élément Stripe : garde les gestionnaires d'événements pour simuler la saisie. */
function fauxElement() {
  const gestionnaires: Record<string, (evenement?: unknown) => void> = {};
  const element = {
    gestionnaires,
    on: vi.fn((nom: string, gestionnaire: (evenement?: unknown) => void) => {
      gestionnaires[nom] = gestionnaire;
      return element;
    }),
    mount: vi.fn(),
    update: vi.fn(),
    destroy: vi.fn(),
  };
  return element;
}

describe('Souscrire (parcours de paiement)', () => {
  let fixture: ComponentFixture<Souscrire>;
  let element: HTMLElement;
  let abonnementService: {
    abonnement: ReturnType<typeof signal<AbonnementResponse | null>>;
    formules: ReturnType<typeof vi.fn>;
    actualiser: ReturnType<typeof vi.fn>;
    creerIntention: ReturnType<typeof vi.fn>;
    confirmer: ReturnType<typeof vi.fn>;
    payerMobile: ReturnType<typeof vi.fn>;
    statutMobile: ReturnType<typeof vi.fn>;
    creerIntentionAchat: ReturnType<typeof vi.fn>;
    acheterMobile: ReturnType<typeof vi.fn>;
  };
  let auth: {
    utilisateur: ReturnType<typeof signal>;
    mettreAJourStatutAbonnement: ReturnType<typeof vi.fn>;
    rafraichir: ReturnType<typeof vi.fn>;
    terminerSession: ReturnType<typeof vi.fn>;
    mettreAJourCredits: ReturnType<typeof vi.fn>;
  };
  let elementsCrees: Record<string, ReturnType<typeof fauxElement>>;
  let stripe: { elements: ReturnType<typeof vi.fn>; confirmCardPayment: ReturnType<typeof vi.fn> };
  let stripeService: { charger: ReturnType<typeof vi.fn> };
  let router: Router;

  /** Laisse finir les promesses (Stripe, intention) puis le rendu. */
  const stable = async () => {
    await new Promise((resolve) => setTimeout(resolve));
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const bouton = (texte: string) =>
    Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes(texte));
  // Espaces insécables du format fr-CA (« 1,00 $ ») ramenées à des espaces simples.
  const texte = () => (element.textContent ?? '').replace(/\s+/g, ' ');

  async function allerAuPaiement(): Promise<void> {
    fixture.componentRef.setInput('formule', 'ANNUEL');
    await stable();
    bouton('Continuer vers le paiement')!.click();
    await stable();
    await stable();
  }

  async function remplirCarte(): Promise<void> {
    (element.querySelector('input[autocomplete="cc-name"]') as HTMLInputElement).value = 'Awa Diallo';
    element.querySelector('input[autocomplete="cc-name"]')!.dispatchEvent(new Event('input'));
    for (const type of ['cardNumber', 'cardExpiry', 'cardCvc']) {
      elementsCrees[type].gestionnaires['change']({ complete: true });
    }
    await stable();
  }

  async function payer(): Promise<void> {
    bouton('Payer')!.click();
    await stable();
    await stable();
  }

  beforeEach(async () => {
    abonnementService = {
      abonnement: signal<AbonnementResponse | null>(null),
      formules: vi.fn(() => of(FORMULES)),
      actualiser: vi.fn(),
      creerIntention: vi.fn(() => of(INTENTION)),
      confirmer: vi.fn(() =>
        of({ message: 'ok', abonnement: abonnementDeTest({ formule: 'ANNUEL', dateExpiration: '2027-11-09T12:00:00Z' }) }),
      ),
      payerMobile: vi.fn(() => of(sessionMobileDeTest())),
      statutMobile: vi.fn(() => of(statutMobileDeTest())),
      creerIntentionAchat: vi.fn((quantite: number) =>
        of({ ...INTENTION, formule: null, type: 'ACHAT_SONDAGES', quantite, montant: quantite * 4.99 }),
      ),
      acheterMobile: vi.fn((quantite: number) =>
        of(sessionMobileDeTest({ formule: null, type: 'ACHAT_SONDAGES', quantite, montant: quantite * 200 })),
      ),
    };
    auth = {
      utilisateur: signal({ courriel: 'awa@test.local' }),
      mettreAJourStatutAbonnement: vi.fn(),
      rafraichir: vi.fn(() => of('nouveau-jeton')),
      terminerSession: vi.fn(),
      mettreAJourCredits: vi.fn(),
    };
    elementsCrees = {};
    stripe = {
      elements: vi.fn(() => ({
        create: vi.fn((type: string) => (elementsCrees[type] = fauxElement())),
      })),
      confirmCardPayment: vi.fn(),
    };
    stripeService = { charger: vi.fn(() => Promise.resolve(stripe)) };

    await TestBed.configureTestingModule({
      imports: [Souscrire],
      providers: [
        provideRouter([]),
        { provide: LOCALE_ID, useValue: 'fr-CA' },
        { provide: AbonnementService, useValue: abonnementService },
        { provide: AuthService, useValue: auth },
        { provide: StripeService, useValue: stripeService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Souscrire);
    element = fixture.nativeElement;
  });

  afterEach(() => vi.useRealTimers());

  it('affiche les formules en CAD et présélectionne celle du lien', async () => {
    fixture.componentRef.setInput('formule', 'ANNUEL');
    await stable();
    expect(texte()).toContain('1,00 $');
    expect(texte()).toContain('2,00 $');
    expect(texte()).toContain('Économisez 10,00 $');
    const choisie = element.querySelector('.formules:not(.moyens) .formule.choisie');
    expect(choisie?.textContent).toContain('Abonnement annuel');
  });

  it('crée l’intention, charge Stripe avec la clé publique et monte les 3 champs de carte', async () => {
    await allerAuPaiement();
    expect(abonnementService.creerIntention).toHaveBeenCalledWith({ formule: 'ANNUEL' });
    expect(stripeService.charger).toHaveBeenCalledWith('pk_test_123');
    expect(Object.keys(elementsCrees).sort()).toEqual(['cardCvc', 'cardExpiry', 'cardNumber']);
    for (const champ of Object.values(elementsCrees)) {
      expect(champ.mount).toHaveBeenCalledTimes(1);
    }
    expect(texte()).toContain('Payer 2,00 $');
  });

  it('refuse de payer tant que la carte est incomplète', async () => {
    await allerAuPaiement();
    await payer();
    expect(stripe.confirmCardPayment).not.toHaveBeenCalled();
    expect(texte()).toContain(messageCarteIncomplete());
  });

  it('succès : confirmation Stripe, puis Batulo, rafraîchissement du jeton et redirection', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { id: 'pi_123', status: 'succeeded' } });
    await allerAuPaiement();
    await remplirCarte();
    await payer();

    expect(stripe.confirmCardPayment).toHaveBeenCalledWith('pi_123_secret_abc', {
      payment_method: {
        card: elementsCrees['cardNumber'],
        billing_details: { name: 'Awa Diallo', email: 'awa@test.local' },
      },
    });
    expect(abonnementService.confirmer).toHaveBeenCalledWith('pi_123');
    expect(auth.mettreAJourStatutAbonnement).toHaveBeenCalledWith('ACTIF');
    expect(auth.rafraichir).toHaveBeenCalled();
    expect(texte()).toContain('Vous êtes bien abonné');
    expect(texte()).toContain('9 novembre 2027');

    vi.advanceTimersByTime(DELAI_REDIRECTION_MS);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
  });

  it('carte refusée : message en français, Batulo n’est pas appelé', async () => {
    stripe.confirmCardPayment.mockResolvedValue({
      error: { type: 'card_error', code: 'card_declined', decline_code: 'insufficient_funds', message: 'Your card has insufficient funds.' },
    });
    await allerAuPaiement();
    await remplirCarte();
    await payer();

    expect(abonnementService.confirmer).not.toHaveBeenCalled();
    expect(texte()).toContain('Votre carte a été refusée : fonds insuffisants.');
    expect(texte()).not.toContain('insufficient funds');
    expect(bouton('Payer')).toBeTruthy();
  });

  it('payé chez Stripe mais non confirmé par Batulo : pas de second paiement, « Vérifier à nouveau »', async () => {
    stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { id: 'pi_123', status: 'succeeded' } });
    abonnementService.confirmer.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { code: 'PAIEMENT_NON_REUSSI', message: 'Le paiement n’est pas encore validé par Stripe.' },
          }),
      ),
    );
    await allerAuPaiement();
    await remplirCarte();
    await payer();

    expect(texte()).toContain('Le paiement n’est pas encore validé par Stripe.');
    expect(bouton('Payer')).toBeUndefined();
    expect(texte()).not.toContain('Changer de formule');

    bouton('Vérifier à nouveau')!.click();
    await stable();
    expect(abonnementService.confirmer).toHaveBeenCalledTimes(2);
    expect(stripe.confirmCardPayment).toHaveBeenCalledTimes(1);
    expect(texte()).toContain('Vous êtes bien abonné');
  });

  it('jeton non rafraîchi après le paiement : reconnexion demandée', async () => {
    stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { id: 'pi_123', status: 'succeeded' } });
    auth.rafraichir.mockReturnValue(throwError(() => new Error('refus')));
    await allerAuPaiement();
    await remplirCarte();
    await payer();

    expect(auth.terminerSession).toHaveBeenCalledWith(MESSAGE_RECONNEXION);
  });

  it('deux moyens de paiement, carte par défaut ; mobile : prix en MRU (économie comprise), moyen gardé dans l’URL', async () => {
    const naviguer = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentRef.setInput('formule', 'ANNUEL');
    await stable();
    const moyens = element.querySelectorAll<HTMLInputElement>('input[name="moyen"]');
    expect(moyens).toHaveLength(2);
    expect(moyens[0].checked).toBe(true);
    expect(texte()).toContain('Carte bancaire');
    expect(texte()).toContain('Application mobile (Bankily, Masrvi, Sedad…)');

    moyens[1].click();
    await stable();
    expect(naviguer).toHaveBeenCalledWith([], { queryParams: { moyen: 'mobile' }, queryParamsHandling: 'merge', replaceUrl: true });
    expect(texte()).toContain('40 MRU');
    expect(texte()).toContain('80 MRU');
    expect(texte()).toContain('Économisez 400 MRU');
    expect(texte()).not.toContain('2,00 $');
  });

  it('mobile : pas de Stripe ; le paiement mobile de la formule choisie, puis succès, nouveau jeton et redirection', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    abonnementService.statutMobile.mockReturnValue(
      of(
        statutMobileDeTest({
          statut: 'REUSSI',
          abonnement: abonnementDeTest({ formule: 'ANNUEL', dateExpiration: '2027-11-15T12:00:00Z' }),
        }),
      ),
    );
    fixture.componentRef.setInput('formule', 'ANNUEL');
    fixture.componentRef.setInput('moyen', 'mobile');
    await stable();
    bouton('Continuer vers le paiement mobile')!.click();
    await stable();
    await stable();

    expect(abonnementService.creerIntention).not.toHaveBeenCalled();
    expect(stripeService.charger).not.toHaveBeenCalled();
    expect(abonnementService.payerMobile).toHaveBeenCalledWith('ANNUEL');
    expect(auth.mettreAJourStatutAbonnement).toHaveBeenCalledWith('ACTIF');
    expect(auth.rafraichir).toHaveBeenCalled();
    expect(texte()).toContain('Vous êtes bien abonné');
    vi.advanceTimersByTime(DELAI_REDIRECTION_MS);
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
  });

  it('mobile : « Changer de formule » ramène au choix (le suivi s’arrête avec le composant)', async () => {
    fixture.componentRef.setInput('moyen', 'mobile');
    await stable();
    bouton('Continuer vers le paiement mobile')!.click();
    await stable();
    expect(element.querySelector('app-paiement-mobile')).not.toBeNull();
    bouton('Changer de formule')!.click();
    await stable();
    expect(element.querySelector('app-paiement-mobile')).toBeNull();
    expect(element.querySelectorAll<HTMLInputElement>('input[name="moyen"]')[1].checked).toBe(true);
  });

  it('Stripe.js injoignable : message clair, on reste au choix de la formule', async () => {
    stripeService.charger.mockResolvedValue(null);
    await allerAuPaiement();
    expect(texte()).toContain('Le service de paiement est injoignable');
    expect(bouton('Continuer vers le paiement')).toBeTruthy();
  });

  describe('achat de sondages', () => {
    const champNombre = () => element.querySelector<HTMLInputElement>('app-quantite-sondages input[type="number"]')!;
    async function saisirNombre(valeur: string): Promise<void> {
      champNombre().value = valeur;
      champNombre().dispatchEvent(new Event('input'));
      champNombre().dispatchEvent(new Event('blur'));
      await stable();
    }

    /** Le composant lit /formules à sa création : il est recréé avec l'offre d'achat. */
    function recreer(): void {
      fixture.destroy();
      fixture = TestBed.createComponent(Souscrire);
      element = fixture.nativeElement;
    }

    beforeEach(() => {
      abonnementService.formules.mockReturnValue(of(formulesDeTest()));
      recreer();
    });

    it('3e offre « Achat de sondages » (prix d’un sondage), choisie par ?offre= ; nombre et total en direct', async () => {
      fixture.componentRef.setInput('offre', 'ACHAT_SONDAGES');
      fixture.componentRef.setInput('quantite', '10');
      await stable();
      const offres = Array.from(element.querySelectorAll('.formules:not(.moyens) .formule'));
      expect(offres.map((o) => o.querySelector('.formule-libelle')?.textContent?.trim())).toEqual([
        'Abonnement mensuel',
        'Abonnement annuel',
        'Achat de sondages',
      ]);
      const achat = element.querySelector('.offre-achat.choisie')!;
      expect(achat.querySelector('.prix')?.textContent?.replace(/\s+/g, ' ')).toBe('4,99 $');
      expect(achat.querySelector('.duree')?.textContent?.trim()).toBe('par sondage');
      expect(champNombre().value).toBe('10');
      expect(element.querySelector('.montant-carte')?.textContent?.replace(/\s+/g, ' ')).toBe('49,90 $');
      await saisirNombre('1000');
      expect(element.querySelector('.montant-carte')?.textContent?.replace(/\s+/g, ' ')).toBe('4 990,00 $');
    });

    it('bornes : 0 et 1001 refusés (« Continuer » désactivé), 1 et 1000 acceptés', async () => {
      fixture.componentRef.setInput('offre', 'ACHAT_SONDAGES');
      await stable();
      for (const [valeur, desactive] of [['0', true], ['1001', true], ['1', false], ['1000', false]] as const) {
        await saisirNombre(valeur);
        expect(bouton('Continuer vers le paiement')!.disabled).toBe(desactive);
      }
    });

    it('carte : intention d’achat avec le nombre, puis succès « N sondages ajoutés » et le nouveau solde', async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      abonnementService.confirmer.mockReturnValue(
        of({ message: 'ok', abonnement: abonnementDeTest(), type: 'ACHAT_SONDAGES', quantite: 10, credits: creditsDeTest({ solde: 12 }) }),
      );
      stripe.confirmCardPayment.mockResolvedValue({ paymentIntent: { id: 'pi_123', status: 'succeeded' } });
      fixture.componentRef.setInput('offre', 'ACHAT_SONDAGES');
      fixture.componentRef.setInput('quantite', '10');
      await stable();
      bouton('Continuer vers le paiement')!.click();
      await stable();
      await stable();
      expect(abonnementService.creerIntentionAchat).toHaveBeenCalledWith(10);
      expect(abonnementService.creerIntention).not.toHaveBeenCalled();
      expect(element.querySelector('.resume-formule')?.textContent?.trim()).toBe('10 sondages');
      await remplirCarte();
      await payer();
      expect(abonnementService.confirmer).toHaveBeenCalledWith('pi_123');
      expect(texte()).toContain('Achat confirmé');
      expect(texte()).toContain('10 sondages ont été ajoutés à votre solde.');
      expect(texte()).toContain('Sondages disponibles : 12');
      vi.advanceTimersByTime(DELAI_REDIRECTION_MS);
      expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
    });

    it('mobile : total en MRU, paiement mobile de l’achat, solde gardé dans la session', async () => {
      abonnementService.statutMobile.mockReturnValue(
        of(statutMobileDeTest({ statut: 'REUSSI', type: 'ACHAT_SONDAGES', quantite: 3, formule: null, credits: creditsDeTest({ solde: 3 }) })),
      );
      fixture.componentRef.setInput('offre', 'ACHAT_SONDAGES');
      fixture.componentRef.setInput('quantite', '3');
      fixture.componentRef.setInput('moyen', 'mobile');
      await stable();
      expect(element.querySelector('.montant-mobile')?.textContent?.replace(/\s+/g, ' ')).toBe('600 MRU');
      expect(element.querySelector('.montant-carte')).toBeNull();
      bouton('Continuer vers le paiement mobile')!.click();
      await stable();
      await stable();
      expect(abonnementService.acheterMobile).toHaveBeenCalledWith(3);
      expect(abonnementService.payerMobile).not.toHaveBeenCalled();
      expect(auth.mettreAJourCredits).toHaveBeenCalledWith(creditsDeTest({ solde: 3 }));
      expect(texte()).toContain('3 sondages ont été ajoutés à votre solde.');
    });

    it('premier paiement après l’inscription : offre et nombre choisis à l’inscription proposés d’abord', async () => {
      abonnementService.abonnement.set(
        abonnementDeTest({ statut: 'EN_ATTENTE_PAIEMENT', formule: null, offreChoisie: 'ACHAT_SONDAGES', nombreSondagesChoisi: 25 }),
      );
      await stable();
      expect(element.querySelector('.offre-achat.choisie')).not.toBeNull();
      expect(champNombre().value).toBe('25');
    });

    it('backend sans offre d’achat : seulement les deux abonnements', async () => {
      abonnementService.formules.mockReturnValue(of(FORMULES_DE_TEST));
      recreer();
      await stable();
      expect(element.querySelector('.offre-achat')).toBeNull();
      expect(element.querySelectorAll('.formules:not(.moyens) .formule')).toHaveLength(2);
    });
  });
});
