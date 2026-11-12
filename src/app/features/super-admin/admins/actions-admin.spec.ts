import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { SuperAdminService } from '../../../core/services/super-admin.service';
import { adminDeTest, adminDetailDeTest } from '../../../testing/donnees-test';
import { ActionsAdmin, libelleGestionnaires } from './actions-admin';

describe('ActionsAdmin (confirmations)', () => {
  let actions: ActionsAdmin;
  let reponseDialogue: unknown;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let snackBar: { open: ReturnType<typeof vi.fn> };

  /** Données passées à la dernière boîte de confirmation ouverte. */
  function derniereConfirmation(): { message: string; saisieAttendue?: string; destructive?: boolean } {
    return dialog.open.mock.calls.at(-1)![1].data;
  }

  beforeEach(() => {
    reponseDialogue = true;
    dialog = { open: vi.fn(() => ({ afterClosed: () => of(reponseDialogue) })) };
    snackBar = { open: vi.fn() };
    service = {
      supprimerAdmin: vi.fn(() => of(null)),
      desactiverAdmin: vi.fn(() => of(adminDetailDeTest())),
      activerAdmin: vi.fn(() => of(adminDetailDeTest())),
      renvoyerMotDePasseTemporaire: vi.fn(() =>
        of({ message: 'ok', adminId: 3, courriel: 'fatou@test.local', expireLe: '2026-11-13T12:00:00Z' }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: SuperAdminService, useValue: service },
      ],
    });
    actions = TestBed.inject(ActionsAdmin);
  });

  it('libellé du nombre de gestionnaires', () => {
    expect(libelleGestionnaires(0)).toBe('aucun gestionnaire');
    expect(libelleGestionnaires(1)).toBe('1 gestionnaire');
    expect(libelleGestionnaires(4)).toBe('4 gestionnaires');
  });

  it('supprimer : confirmation forte avec le nom de l’entreprise, rien sans confirmation', () => {
    reponseDialogue = false;
    const supprime = vi.fn();
    actions.supprimer(adminDeTest(), 4).subscribe(supprime);
    expect(derniereConfirmation().saisieAttendue).toBe('Entreprise Test');
    expect(derniereConfirmation().destructive).toBe(true);
    expect(derniereConfirmation().message).toContain('ses 4 gestionnaires');
    expect(service['supprimerAdmin']).not.toHaveBeenCalled();
    expect(supprime).not.toHaveBeenCalled();

    reponseDialogue = true;
    actions.supprimer(adminDeTest(), 4).subscribe(supprime);
    expect(service['supprimerAdmin']).toHaveBeenCalledWith(3);
    expect(supprime).toHaveBeenCalledWith(true);
  });

  it('désactiver prévient que les gestionnaires seront bloqués ; activer sans confirmation', () => {
    reponseDialogue = false;
    actions.basculerActif(adminDeTest({ actif: true }), 4).subscribe();
    expect(derniereConfirmation().message).toContain('Ses 4 gestionnaires seront bloqués aussi.');
    expect(service['desactiverAdmin']).not.toHaveBeenCalled();

    actions.basculerActif(adminDeTest({ actif: true })).subscribe();
    expect(derniereConfirmation().message).toContain('Ses gestionnaires seront bloqués aussi.');

    dialog.open.mockClear();
    actions.basculerActif(adminDeTest({ actif: false })).subscribe();
    expect(dialog.open).not.toHaveBeenCalled();
    expect(service['activerAdmin']).toHaveBeenCalledWith(3);
  });

  it('renvoyer un mot de passe : confirmation, puis courriel et expiration dans le message', () => {
    const resultat = vi.fn();
    actions.renvoyerMotDePasse(adminDeTest()).subscribe(resultat);
    expect(service['renvoyerMotDePasseTemporaire']).toHaveBeenCalledWith(3);
    expect(resultat).toHaveBeenCalledTimes(1);
    expect(snackBar.open.mock.calls.at(-1)![0]).toContain('fatou@test.local');
  });
});
