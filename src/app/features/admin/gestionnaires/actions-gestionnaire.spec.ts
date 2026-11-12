import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { GestionnaireService } from '../../../core/services/gestionnaire.service';
import { gestionnaireDeTest } from '../../../testing/donnees-test';
import { ActionsGestionnaire } from './actions-gestionnaire';

describe('ActionsGestionnaire (confirmations)', () => {
  let actions: ActionsGestionnaire;
  let reponseDialogue: unknown;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let service: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    reponseDialogue = true;
    dialog = { open: vi.fn(() => ({ afterClosed: () => of(reponseDialogue) })) };
    service = {
      supprimer: vi.fn(() => of(null)),
      desactiver: vi.fn(() => of(gestionnaireDeTest({ actif: false }))),
      activer: vi.fn(() => of(gestionnaireDeTest({ actif: true }))),
      renvoyerMotDePasseTemporaire: vi.fn(() => of(gestionnaireDeTest({ motDePasseTemporaire: true }))),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
        { provide: GestionnaireService, useValue: service },
      ],
    });
    actions = TestBed.inject(ActionsGestionnaire);
  });

  it('supprime seulement après confirmation', () => {
    reponseDialogue = false;
    const supprime = vi.fn();
    actions.supprimer(gestionnaireDeTest()).subscribe(supprime);
    expect(service['supprimer']).not.toHaveBeenCalled();
    expect(supprime).not.toHaveBeenCalled();

    reponseDialogue = true;
    actions.supprimer(gestionnaireDeTest()).subscribe(supprime);
    expect(service['supprimer']).toHaveBeenCalledWith(7);
    expect(supprime).toHaveBeenCalledWith(true);
  });

  it('désactiver demande confirmation, activer non', () => {
    reponseDialogue = false;
    actions.basculerActif(gestionnaireDeTest({ actif: true })).subscribe();
    expect(service['desactiver']).not.toHaveBeenCalled();

    dialog.open.mockClear();
    actions.basculerActif(gestionnaireDeTest({ actif: false })).subscribe();
    expect(dialog.open).not.toHaveBeenCalled();
    expect(service['activer']).toHaveBeenCalledWith(7);
  });

  it('renvoyer un mot de passe temporaire après confirmation', () => {
    actions.renvoyerMotDePasse(gestionnaireDeTest()).subscribe();
    expect(dialog.open).toHaveBeenCalledTimes(1);
    expect(service['renvoyerMotDePasseTemporaire']).toHaveBeenCalledWith(7);
  });
});
