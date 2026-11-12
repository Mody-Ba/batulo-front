import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { DemandeAbonnementService } from './demande-abonnement.service';
import { SuperAdminService } from './super-admin.service';

describe('SuperAdminService et DemandeAbonnementService', () => {
  let serveur: HttpTestingController;
  const url = `${environment.apiUrl}/api/super-admin`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    serveur = TestBed.inject(HttpTestingController);
  });

  afterEach(() => serveur.verify());

  it('actions sur un admin : routes et méthodes', () => {
    const service = TestBed.inject(SuperAdminService);
    service.detailAdmin(3).subscribe();
    service.creerAdmin({ prenom: 'A', nom: 'B', courriel: 'a@b.c', nomEntreprise: null }).subscribe();
    service.modifierAdmin(3, { prenom: 'A', nom: 'B', courriel: 'a@b.c', nomEntreprise: 'E' }).subscribe();
    service.activerAdmin(3).subscribe();
    service.desactiverAdmin(3).subscribe();
    service.renvoyerMotDePasseTemporaire(3).subscribe();
    service.supprimerAdmin(3).subscribe();

    expect(serveur.expectOne({ method: 'GET', url: `${url}/admins/3` })).toBeTruthy();
    expect(serveur.expectOne({ method: 'POST', url: `${url}/admins` }).request.body).toEqual({
      prenom: 'A',
      nom: 'B',
      courriel: 'a@b.c',
      nomEntreprise: null,
    });
    expect(serveur.expectOne({ method: 'PUT', url: `${url}/admins/3` }).request.body.nomEntreprise).toBe('E');
    serveur.expectOne({ method: 'PATCH', url: `${url}/admins/3/activer` });
    serveur.expectOne({ method: 'PATCH', url: `${url}/admins/3/desactiver` });
    serveur.expectOne({ method: 'POST', url: `${url}/admins/3/mot-de-passe-temporaire` });
    serveur.expectOne({ method: 'DELETE', url: `${url}/admins/3` });
  });

  it('abonnements : statut seulement s’il est donné', () => {
    const service = TestBed.inject(SuperAdminService);
    service.listerAbonnements().subscribe();
    const sansFiltre = serveur.expectOne((r) => r.url === `${url}/abonnements`);
    expect(sansFiltre.request.params.keys().sort()).toEqual(['page', 'taille']);
    sansFiltre.flush({ contenu: [], page: 0, taille: 20, totalElements: 0, totalPages: 0 });

    service.listerAbonnements({ statut: 'EXPIRE_BIENTOT', page: 2, taille: 10 }).subscribe();
    const filtre = serveur.expectOne((r) => r.url === `${url}/abonnements`);
    expect(filtre.request.params.get('statut')).toBe('EXPIRE_BIENTOT');
    expect(filtre.request.params.get('page')).toBe('2');
    expect(filtre.request.params.get('taille')).toBe('10');
  });

  it('demandes : liste filtrée et réponse', () => {
    const service = TestBed.inject(DemandeAbonnementService);
    service.lister({ statut: 'EN_ATTENTE' }).subscribe();
    const liste = serveur.expectOne((r) => r.url === `${url}/demandes-abonnement`);
    expect(liste.request.params.get('statut')).toBe('EN_ATTENTE');

    service.traiter(11, { statut: 'REFUSEE', reponse: 'Non' }).subscribe();
    const reponse = serveur.expectOne({ method: 'PATCH', url: `${url}/demandes-abonnement/11` });
    expect(reponse.request.body).toEqual({ statut: 'REFUSEE', reponse: 'Non' });
  });
});
