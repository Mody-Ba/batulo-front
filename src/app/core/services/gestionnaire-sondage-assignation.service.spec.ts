import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { AssignationService } from './assignation.service';
import { GestionnaireService } from './gestionnaire.service';
import { SondageService } from './sondage.service';

const API = environment.apiUrl;

describe('services F4 (gestionnaires, sondages, assignations)', () => {
  let serveur: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    serveur = TestBed.inject(HttpTestingController);
  });

  afterEach(() => serveur.verify());

  it('GestionnaireService : routes et corps exacts', () => {
    const service = TestBed.inject(GestionnaireService);
    const base = `${API}/api/admin/gestionnaires`;

    service.lister({ page: 2, taille: 10 }).subscribe();
    expect(serveur.expectOne(`${base}?page=2&taille=10`).request.method).toBe('GET');

    service.creer({ prenom: 'Awa', nom: 'Diallo', courriel: 'awa@test.local' }).subscribe();
    const creation = serveur.expectOne(base);
    expect(creation.request.method).toBe('POST');
    expect(creation.request.body).toEqual({ prenom: 'Awa', nom: 'Diallo', courriel: 'awa@test.local' });

    service.modifier(7, { prenom: 'A', nom: 'B', courriel: 'c@d.e' }).subscribe();
    expect(serveur.expectOne(`${base}/7`).request.method).toBe('PUT');

    service.supprimer(7).subscribe();
    expect(serveur.expectOne(`${base}/7`).request.method).toBe('DELETE');

    service.activer(7).subscribe();
    expect(serveur.expectOne(`${base}/7/activer`).request.method).toBe('PATCH');
    service.desactiver(7).subscribe();
    expect(serveur.expectOne(`${base}/7/desactiver`).request.method).toBe('PATCH');

    service.renvoyerMotDePasseTemporaire(7).subscribe();
    expect(serveur.expectOne(`${base}/7/mot-de-passe-temporaire`).request.method).toBe('POST');

    service.changerPermissionSondages(7, true).subscribe();
    const permission = serveur.expectOne(`${base}/7/permission-sondages`);
    expect(permission.request.method).toBe('PATCH');
    expect(permission.request.body).toEqual({ peutCreerSondages: true });

    service.sondages(7, 1, 10).subscribe();
    expect(serveur.expectOne(`${base}/7/sondages?page=1&taille=10`).request.method).toBe('GET');
  });

  it('GestionnaireService : recherche et actif envoyés seulement s’ils sont donnés', () => {
    const service = TestBed.inject(GestionnaireService);
    const base = `${API}/api/admin/gestionnaires`;
    service.lister({ recherche: '  Éloïse ', actif: false }).subscribe();
    serveur.expectOne(`${base}?page=0&taille=20&recherche=%C3%89lo%C3%AFse&actif=false`);
    service.lister({ actif: true, taille: 100 }).subscribe();
    serveur.expectOne(`${base}?page=0&taille=100&actif=true`);
    service.lister({ recherche: '   ', actif: null }).subscribe();
    serveur.expectOne(`${base}?page=0&taille=20`);
  });

  it('SondageService : filtre par statut seulement s’il est donné', () => {
    const service = TestBed.inject(SondageService);
    service.lister({ statut: 'EN_COURS', page: 1, taille: 10 }).subscribe();
    serveur.expectOne(`${API}/api/sondages?page=1&taille=10&statut=EN_COURS`);
    service.lister().subscribe();
    serveur.expectOne(`${API}/api/sondages?page=0&taille=20`);
    service.lister({ derniereVersion: true, statut: 'TERMINE' }).subscribe();
    serveur.expectOne(`${API}/api/sondages?page=0&taille=20&statut=TERMINE&derniereVersion=true`);
    service.lister({ derniereVersion: false }).subscribe();
    serveur.expectOne(`${API}/api/sondages?page=0&taille=20`);
    service.collecte(3).subscribe();
    serveur.expectOne(`${API}/api/sondages/3/collecte`);
    service.versions(3).subscribe();
    serveur.expectOne(`${API}/api/sondages/3/versions`);
  });

  it('AssignationService : assigner plusieurs gestionnaires et retirer', () => {
    const service = TestBed.inject(AssignationService);
    service.assigner(3, [7, 8]).subscribe();
    const assignation = serveur.expectOne(`${API}/api/sondages/3/assignations`);
    expect(assignation.request.method).toBe('POST');
    expect(assignation.request.body).toEqual({ gestionnaireIds: [7, 8] });

    service.retirer(3, 7).subscribe();
    expect(serveur.expectOne(`${API}/api/sondages/3/assignations/7`).request.method).toBe('DELETE');
  });
});
