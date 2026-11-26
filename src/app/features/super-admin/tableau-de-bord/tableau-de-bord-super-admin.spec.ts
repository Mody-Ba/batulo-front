import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationService } from '../../../core/services/notification.service';
import { SuperAdminService } from '../../../core/services/super-admin.service';
import { NOMBRE_NOTIFICATIONS } from '../../../shared/components/dernieres-notifications/dernieres-notifications';
import { tableauDeBordSuperAdminDeTest } from '../../../testing/donnees-test';
import { TableauDeBordSuperAdmin } from './tableau-de-bord-super-admin';

describe('TableauDeBordSuperAdmin', () => {
  let tableauDeBord: ReturnType<typeof vi.fn>;
  let listerNotifications: ReturnType<typeof vi.fn>;

  async function creer(): Promise<HTMLElement> {
    const fixture = TestBed.createComponent(TableauDeBordSuperAdmin);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function tuiles(element: HTMLElement): HTMLAnchorElement[] {
    return Array.from(element.querySelectorAll<HTMLAnchorElement>('a.tuile'));
  }

  function texte(tuile: Element): string {
    return tuile.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  }

  beforeEach(() => {
    tableauDeBord = vi.fn(() => of(tableauDeBordSuperAdminDeTest()));
    listerNotifications = vi.fn(() =>
      of({
        contenu: [
          {
            id: 1,
            type: 'NOUVELLE_INSCRIPTION',
            titre: 'Nouvelle inscription',
            message: 'Entreprise Test vient de s’inscrire.',
            lue: false,
            dateCreation: '2026-11-12T10:00:00Z',
          },
        ],
        page: 0,
        taille: 5,
        totalElements: 1,
        totalPages: 1,
      }),
    );
    TestBed.configureTestingModule({
      imports: [TableauDeBordSuperAdmin],
      providers: [
        provideRouter([]),
        { provide: SuperAdminService, useValue: { tableauDeBord } },
        { provide: NotificationService, useValue: { lister: listerNotifications } },
        { provide: AuthService, useValue: { utilisateur: signal({ prenom: 'Mody' }) } },
      ],
    });
  });

  it('compteurs : total, chaque statut d’abonnement et demandes en attente', async () => {
    const element = await creer();
    expect(tuiles(element).map(texte)).toEqual([
      '12 Au total',
      '6 Actif',
      '2 Expire bientôt 7 jours ou moins',
      '1 Expiré',
      '2 En attente de paiement',
      '1 Désactivé',
      '3 En attente de réponse',
    ]);
  });

  it('chaque compteur mène à la liste filtrée', async () => {
    const liens = tuiles(await creer()).map((a) => a.getAttribute('href'));
    expect(liens).toEqual([
      '/super-admin/admins',
      '/super-admin/admins?statut=ACTIF',
      '/super-admin/admins?statut=EXPIRE_BIENTOT',
      '/super-admin/admins?statut=EXPIRE',
      '/super-admin/admins?statut=EN_ATTENTE_PAIEMENT',
      '/super-admin/admins?statut=DESACTIVE',
      '/super-admin/demandes-abonnement?statut=EN_ATTENTE',
    ]);
  });

  it('met en évidence les expirations proches et les demandes en attente, seulement si non nulles', async () => {
    let element = await creer();
    expect(tuiles(element).filter((t) => t.classList.contains('a-surveiller')).map(texte)).toEqual([
      '2 Expire bientôt 7 jours ou moins',
      '3 En attente de réponse',
    ]);

    tableauDeBord.mockReturnValue(
      of(
        tableauDeBordSuperAdminDeTest({
          entreprises: { total: 1, actif: 1, expireBientot: 0, expire: 0, enAttentePaiement: 0, desactive: 0 },
          demandesAugmentationEnAttente: 0,
        }),
      ),
    );
    element = await creer();
    expect(element.querySelectorAll('.a-surveiller').length).toBe(0);
  });

  it('les 5 dernières notifications, tous types confondus', async () => {
    const element = await creer();
    expect(listerNotifications).toHaveBeenCalledWith(0, NOMBRE_NOTIFICATIONS);
    expect(NOMBRE_NOTIFICATIONS).toBe(5);
    expect(element.textContent).toContain('Entreprise Test vient de s’inscrire.');
  });

  it('erreur : message et nouvel essai', async () => {
    tableauDeBord.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { code: 'ERREUR_INTERNE', message: 'x' } })),
    );
    const element = await creer();
    expect(element.querySelector('[role="alert"]')).toBeTruthy();
    tableauDeBord.mockReturnValue(of(tableauDeBordSuperAdminDeTest()));
    Array.from(element.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Réessayer'))!
      .click();
    expect(tableauDeBord).toHaveBeenCalledTimes(2);
  });

  it('revenus par type (abonnements, achats de sondages), une ligne par devise, et sondages vendus', async () => {
    tableauDeBord.mockReturnValue(
      of(
        tableauDeBordSuperAdminDeTest({
          revenus: {
            lignes: [
              { type: 'ABONNEMENT', devise: 'CAD', montant: 120, nombrePaiements: 12 },
              { type: 'ABONNEMENT', devise: 'MRU', montant: 4000, nombrePaiements: 5 },
              { type: 'ACHAT_SONDAGES', devise: 'CAD', montant: 49.9, nombrePaiements: 1 },
            ],
            sondagesVendus: 10,
          },
        }),
      ),
    );
    const element = await creer();
    const types = Array.from(element.querySelectorAll('.revenus .type-revenus')).map((t) => ({
      type: texte(t.querySelector('dt')!),
      lignes: Array.from(t.querySelectorAll('dd')).map((dd) => texte(dd)),
    }));
    expect(types).toEqual([
      { type: 'Abonnement', lignes: ['120,00 CAD 12 paiements', '4 000 MRU 5 paiements'] },
      { type: 'Achat de sondages', lignes: ['49,90 CAD 1 paiement'] },
    ]);
    expect(texte(element.querySelector('.revenus .sondages-vendus')!)).toBe('10 sondages vendus à l’unité');
  });

  it('aucun achat de sondages : « Aucun paiement » pour ce type ; backend sans revenus : message', async () => {
    tableauDeBord.mockReturnValue(
      of(tableauDeBordSuperAdminDeTest({ revenus: { lignes: [{ type: 'ABONNEMENT', devise: 'CAD', montant: 1, nombrePaiements: 1 }], sondagesVendus: 0 } })),
    );
    let element = await creer();
    expect(texte(element.querySelectorAll('.revenus .type-revenus')[1])).toContain('Aucun paiement');
    tableauDeBord.mockReturnValue(of(tableauDeBordSuperAdminDeTest()));
    element = await creer();
    expect(texte(element.querySelector('.revenus')!)).toContain('Revenus indisponibles.');
  });
});
