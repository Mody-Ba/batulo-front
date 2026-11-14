import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { DemandeAbonnementService } from './demande-abonnement.service';
import { MessagerieService } from './messagerie.service';
import { NotificationService } from './notification.service';
import { StatistiquesService } from './statistiques.service';

describe('Services de la messagerie, des notifications et des demandes (admin)', () => {
  let serveur: HttpTestingController;
  const api = environment.apiUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    serveur = TestBed.inject(HttpTestingController);
  });

  afterEach(() => serveur.verify());

  it('messagerie : conversations, ouverture, messages paginés, envoi', () => {
    const service = TestBed.inject(MessagerieService);
    service.conversations().subscribe();
    expect(serveur.expectOne(`${api}/api/messagerie/conversations?page=0&taille=50`).request.method).toBe('GET');

    service.ouvrir({ interlocuteurId: 9 }).subscribe();
    const ouverture = serveur.expectOne(`${api}/api/messagerie/conversations`);
    expect(ouverture.request.method).toBe('POST');
    expect(ouverture.request.body).toEqual({ interlocuteurId: 9 });

    service.messages(5, 2, 30).subscribe();
    serveur.expectOne(`${api}/api/messagerie/conversations/5/messages?page=2&taille=30`);

    service.envoyer(5, 'Bonjour').subscribe();
    const envoi = serveur.expectOne(`${api}/api/messagerie/conversations/5/messages`);
    expect(envoi.request.method).toBe('POST');
    expect(envoi.request.body).toEqual({ contenu: 'Bonjour' });
  });

  it('messagerie : compteur partagé relu, puis diminué des messages marqués lus', () => {
    const service = TestBed.inject(MessagerieService);
    service.actualiserNombre().subscribe();
    serveur.expectOne(`${api}/api/messagerie/non-lus`).flush({ nonLues: 5 });
    expect(service.nombreNonLus()).toBe(5);

    service.marquerLue(5).subscribe();
    const lu = serveur.expectOne(`${api}/api/messagerie/conversations/5/lu`);
    expect(lu.request.method).toBe('POST');
    lu.flush({ message: 'ok', nombreMarquees: 3 });
    expect(service.nombreNonLus()).toBe(2);
  });

  it('notifications : pastille partagée (relue, une de moins, toutes lues)', () => {
    const service = TestBed.inject(NotificationService);
    service.actualiserNombre().subscribe();
    serveur.expectOne(`${api}/api/notifications/non-lues/nombre`).flush({ nonLues: 4 });
    expect(service.nombreNonLues()).toBe(4);

    service.marquerLue(7).subscribe();
    const une = serveur.expectOne(`${api}/api/notifications/7/lue`);
    expect(une.request.method).toBe('PATCH');
    une.flush({ id: 7, lue: true });
    expect(service.nombreNonLues()).toBe(3);

    service.toutMarquerLu().subscribe();
    const toutes = serveur.expectOne(`${api}/api/notifications/lues`);
    expect(toutes.request.method).toBe('PATCH');
    toutes.flush({ message: 'ok', nombreMarquees: 3 });
    expect(service.nombreNonLues()).toBe(0);
  });

  it('demandes de l’admin : liste paginée et envoi', () => {
    const service = TestBed.inject(DemandeAbonnementService);
    service.mesDemandes().subscribe();
    serveur.expectOne(`${api}/api/abonnements/demandes?page=0&taille=10`);
    service.demander({ formuleSouhaitee: 'ANNUEL', message: 'Trois enquêtes' }).subscribe();
    const envoi = serveur.expectOne(`${api}/api/abonnements/demandes`);
    expect(envoi.request.method).toBe('POST');
    expect(envoi.request.body).toEqual({ formuleSouhaitee: 'ANNUEL', message: 'Trois enquêtes' });
  });

  it('ajouts F8 : ?lue sur les notifications, détail d’une demande, envoi de statistiques seul', () => {
    const notifications = TestBed.inject(NotificationService);
    notifications.lister(0, 20, false).subscribe();
    serveur.expectOne(`${api}/api/notifications?page=0&taille=20&lue=false`);
    notifications.lister().subscribe();
    serveur.expectOne(`${api}/api/notifications?page=0&taille=20`);

    TestBed.inject(DemandeAbonnementService).detail(12).subscribe();
    serveur.expectOne(`${api}/api/super-admin/demandes-abonnement/12`);

    TestBed.inject(StatistiquesService).envoi(7).subscribe();
    serveur.expectOne(`${api}/api/envois-statistiques/7`);
  });
});
