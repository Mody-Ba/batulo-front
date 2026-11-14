import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { NotificationResponse } from '../../core/models/notification.model';
import { Role } from '../../core/models/role.model';
import { AuthService } from '../../core/services/auth.service';
import { NotificationService } from '../../core/services/notification.service';
import { lienNotification } from './liens-notifications';
import { PageNotifications } from './page-notifications';

const n = (modifs: Partial<NotificationResponse>): NotificationResponse => ({
  id: 1,
  type: 'NOUVEAU_MESSAGE',
  titre: 'Nouveau message',
  message: 'Moussa Kane vous a écrit.',
  lue: false,
  dateCreation: '2026-11-14T08:00:00Z',
  ...modifs,
});
const texte = (f: ComponentFixture<unknown>) => (f.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ') ?? '';

describe('Page des notifications', () => {
  let service: Record<string, ReturnType<typeof vi.fn>> & { nombreNonLues: ReturnType<typeof signal<number>> };

  beforeEach(() => {
    const nombre = signal(2);
    service = {
      nombreNonLues: nombre,
      lister: vi.fn(() => of({ contenu: [n({ id: 1 }), n({ id: 2, type: 'STATISTIQUES_RECUES', titre: 'Statistiques reçues', referenceId: 12, conversationId: 4 }), n({ id: 3, lue: true, type: 'PAIEMENT_RECU', titre: 'Paiement reçu' })], page: 0, taille: 20, totalElements: 3, totalPages: 1 })),
      actualiserNombre: vi.fn(() => of({ nonLues: 2 })),
      marquerLue: vi.fn((id: number) => {
        nombre.update((x) => x - 1);
        return of(n({ id, lue: true }));
      }),
      toutMarquerLu: vi.fn(() => {
        nombre.set(0);
        return of({ message: 'ok', nombreMarquees: 2 });
      }),
    } as never;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: NotificationService, useValue: service },
        { provide: AuthService, useValue: { role: signal<Role>('ADMIN') } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
  });

  async function afficher(entrees: Record<string, string> = {}): Promise<ComponentFixture<PageNotifications>> {
    const f = TestBed.createComponent(PageNotifications);
    for (const [cle, valeur] of Object.entries(entrees)) {
      f.componentRef.setInput(cle, valeur);
    }
    await f.whenStable();
    f.detectChanges();
    return f;
  }

  it('liste paginée (?page&taille), non lues signalées, nombre partagé relu', async () => {
    const f = await afficher({ page: '2', taille: '10' });
    expect(service['lister']).toHaveBeenCalledWith(2, 10, null);
    expect(service['actualiserNombre']).toHaveBeenCalled();
    expect(texte(f)).toContain('2 notifications non lues.');
    expect((f.nativeElement as HTMLElement).querySelectorAll('.notification.non-lue').length).toBe(2);
    expect(texte(f)).toContain('Non lue : Nouveau message');
  });

  it('marquer une notification comme lue : la ligne et la pastille partagée sont mises à jour', async () => {
    const f = await afficher();
    (f.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('button[aria-label="Marquer « Nouveau message » comme lue"]')!.click();
    f.detectChanges();
    expect(service['marquerLue']).toHaveBeenCalledWith(1);
    expect(service.nombreNonLues()).toBe(1);
    expect((f.nativeElement as HTMLElement).querySelectorAll('.notification.non-lue').length).toBe(1);
  });

  it('tout marquer comme lu, puis bouton désactivé', async () => {
    const f = await afficher();
    const bouton = Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Tout marquer comme lu'))!;
    bouton.click();
    f.detectChanges();
    expect(service['toutMarquerLu']).toHaveBeenCalled();
    expect((f.nativeElement as HTMLElement).querySelectorAll('.notification.non-lue').length).toBe(0);
    expect(bouton.disabled).toBe(true);
    expect(texte(f)).toContain('Aucune notification non lue.');
  });

  it('ouvrir : marquée lue et page concernée', async () => {
    const f = await afficher();
    const naviguer = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Ouvrir les statistiques'))!.click();
    expect(service['marquerLue']).toHaveBeenCalledWith(2);
    expect(naviguer).toHaveBeenCalledWith(['/admin/statistiques-recues', 12], { queryParams: undefined });
  });

  it('filtre lues / non lues : ?lue= transmis, choix dans l’URL (page remise à zéro), état vide adapté', async () => {
    service['lister'].mockReturnValue(of({ contenu: [], page: 0, taille: 20, totalElements: 0, totalPages: 0 }));
    const f = await afficher({ lue: 'false' });
    expect(service['lister']).toHaveBeenCalledWith(0, 20, false);
    expect(texte(f)).toContain('Aucune notification non lue.');
    const naviguer = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    Array.from((f.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('mat-button-toggle button')).find((b) => b.textContent?.trim() === 'Lues')!.click();
    expect(naviguer).toHaveBeenCalledWith([], { queryParams: { lue: 'true', page: null }, queryParamsHandling: 'merge' });
  });

  it('tout marquer comme lu sous un filtre : la liste est relue', async () => {
    const f = await afficher({ lue: 'false' });
    service['lister'].mockClear();
    Array.from((f.nativeElement as HTMLElement).querySelectorAll('button')).find((b) => b.textContent?.includes('Tout marquer comme lu'))!.click();
    expect(service['lister']).toHaveBeenCalledWith(0, 20, false);
  });

  it('liens précis quand la notification porte sa référence', () => {
    expect(lienNotification({ type: 'NOUVEAU_MESSAGE', referenceId: 80, conversationId: 4 }, 'ADMIN')!.commandes).toEqual(['/messagerie', 4]);
    expect(lienNotification({ type: 'SONDAGE_ASSIGNE', referenceId: 3 }, 'GESTIONNAIRE')!.commandes).toEqual(['/sondages', 3]);
    expect(lienNotification({ type: 'SONDAGE_DESASSIGNE', referenceId: 3 }, 'GESTIONNAIRE')!.commandes).toEqual(['/sondages']);
    expect(lienNotification({ type: 'DEMANDE_ABONNEMENT', referenceId: 12 }, 'SUPER_ADMIN')).toEqual(expect.objectContaining({ commandes: ['/super-admin/demandes-abonnement'], queryParams: { demande: '12' } }));
    expect(lienNotification({ type: 'DEMANDE_ABONNEMENT_TRAITEE', referenceId: 12 }, 'ADMIN')!.queryParams).toEqual({ demande: '12' });
    expect(lienNotification({ type: 'NOUVELLE_INSCRIPTION', referenceId: 5 }, 'SUPER_ADMIN')!.queryParams).toEqual({ statut: 'EN_ATTENTE_PAIEMENT' });
  });

  it('liens par type et par rôle (anciennes notifications, sans référence)', () => {
    expect(lienNotification({ type: 'DEMANDE_ABONNEMENT' }, 'SUPER_ADMIN')).toEqual(expect.objectContaining({ commandes: ['/super-admin/demandes-abonnement'], queryParams: { statut: 'EN_ATTENTE' } }));
    expect(lienNotification({ type: 'DEMANDE_ABONNEMENT_TRAITEE' }, 'ADMIN')!.commandes).toEqual(['/admin/abonnement/demandes']);
    expect(lienNotification({ type: 'PAIEMENT_RECU' }, 'SUPER_ADMIN')!.commandes).toEqual(['/super-admin/abonnements']);
    expect(lienNotification({ type: 'SONDAGE_ASSIGNE' }, 'GESTIONNAIRE')!.commandes).toEqual(['/sondages']);
    expect(lienNotification({ type: 'NOUVEAU_MESSAGE' }, 'GESTIONNAIRE')!.commandes).toEqual(['/messagerie']);
    expect(lienNotification({ type: 'STATISTIQUES_RECUES' }, 'GESTIONNAIRE')).toBeNull();
  });
});
