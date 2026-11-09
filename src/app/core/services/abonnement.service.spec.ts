import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { abonnementDeTest } from '../../testing/donnees-test';
import { abonnementEnAlerte } from '../models/abonnement.model';
import { AbonnementService } from './abonnement.service';

const URL = `${environment.apiUrl}/api/abonnements`;

describe('AbonnementService', () => {
  let service: AbonnementService;
  let serveur: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(AbonnementService);
    serveur = TestBed.inject(HttpTestingController);
  });

  afterEach(() => serveur.verify());

  it('lit les formules', () => {
    service.formules().subscribe();
    expect(serveur.expectOne(`${URL}/formules`).request.method).toBe('GET');
  });

  it('crée une intention pour la formule choisie, sans identifiant d’entreprise', () => {
    service.creerIntention({ formule: 'ANNUEL' }).subscribe();
    const requete = serveur.expectOne(`${URL}/paiement/intention`);
    expect(requete.request.method).toBe('POST');
    expect(requete.request.body).toEqual({ formule: 'ANNUEL' });
    expect(requete.request.params.keys()).toEqual([]);
  });

  it('confirme le paiement et met à jour l’abonnement partagé', () => {
    service.confirmer('pi_123').subscribe();
    const requete = serveur.expectOne(`${URL}/paiement/confirmer`);
    expect(requete.request.body).toEqual({ paymentIntentId: 'pi_123' });
    requete.flush({ message: 'ok', abonnement: abonnementDeTest({ formule: 'ANNUEL' }) });
    expect(service.abonnement()?.formule).toBe('ANNUEL');
  });

  it('actualiser() ignore les erreurs et oublier() vide le signal', () => {
    service.actualiser();
    serveur
      .expectOne(`${URL}/moi`)
      .flush({ code: 'ABONNEMENT_INTROUVABLE', message: 'x' }, { status: 404, statusText: 'Not Found' });
    expect(service.abonnement()).toBeNull();

    service.actualiser();
    serveur.expectOne(`${URL}/moi`).flush(abonnementDeTest());
    expect(service.abonnement()).not.toBeNull();
    service.oublier();
    expect(service.abonnement()).toBeNull();
  });
});

describe('abonnementEnAlerte', () => {
  it('alerte à 7 jours ou moins, ou expiré', () => {
    expect(abonnementEnAlerte(abonnementDeTest({ joursRestants: 23 }))).toBe(false);
    expect(abonnementEnAlerte(abonnementDeTest({ joursRestants: 7 }))).toBe(true);
    expect(abonnementEnAlerte(abonnementDeTest({ statut: 'EXPIRE_BIENTOT', joursRestants: 5 }))).toBe(true);
    expect(abonnementEnAlerte(abonnementDeTest({ statut: 'EXPIRE', joursRestants: 0 }))).toBe(true);
    expect(abonnementEnAlerte(abonnementDeTest({ statut: 'EN_ATTENTE_PAIEMENT', joursRestants: null }))).toBe(false);
    expect(abonnementEnAlerte(null)).toBe(false);
  });
});
