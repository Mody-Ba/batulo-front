import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { SondageService } from '../../../core/services/sondage.service';
import { sondageDeTest } from '../../../testing/donnees-test';
import { ActionsSondage } from './actions-sondage';

describe('ActionsSondage', () => {
  let actions: ActionsSondage;
  let reponseDialogue: unknown;
  let dialog: { open: ReturnType<typeof vi.fn> };
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let snackBar: { open: ReturnType<typeof vi.fn> };
  let naviguer: ReturnType<typeof vi.spyOn>;
  const publie = sondageDeTest({ publie: true, statut: 'EN_COURS' });

  beforeEach(() => {
    reponseDialogue = true;
    dialog = { open: vi.fn(() => ({ afterClosed: () => of(reponseDialogue) })) };
    snackBar = { open: vi.fn() };
    service = {
      fermer: vi.fn(() => of({ ...publie, statut: 'TERMINE' })),
      nouvelleVersion: vi.fn(() => of(sondageDeTest({ id: 9, version: 2 }))),
      versions: vi.fn(() => of([])),
      dupliquer: vi.fn(() => of(sondageDeTest({ id: 12, titre: 'Copie de Satisfaction 2026' }))),
      marquerModele: vi.fn(() => of({ ...publie, estModele: true })),
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: MatDialog, useValue: dialog },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: SondageService, useValue: service },
      ],
    });
    actions = TestBed.inject(ActionsSondage);
    naviguer = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  it('fermer : seulement après une confirmation qui dit que c’est définitif', () => {
    reponseDialogue = false;
    actions.fermer(publie).subscribe();
    expect(dialog.open.mock.calls[0][1].data.message).toContain('C’est définitif');
    expect(service['fermer']).not.toHaveBeenCalled();
    reponseDialogue = true;
    const ferme = vi.fn();
    actions.fermer(publie).subscribe(ferme);
    expect(service['fermer']).toHaveBeenCalledWith(3);
    expect(ferme).toHaveBeenCalledWith(expect.objectContaining({ statut: 'TERMINE' }));
  });

  it('nouvelle version : le brouillon créé s’ouvre dans l’éditeur', () => {
    actions.nouvelleVersion(publie).subscribe();
    expect(naviguer).toHaveBeenCalledWith(['/sondages', 9, 'modifier']);
  });

  it('nouvelle version déjà en préparation : c’est elle qui s’ouvre', () => {
    service['nouvelleVersion'].mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { code: 'BROUILLON_EXISTANT', message: 'Une nouvelle version est déjà en préparation.' },
          }),
      ),
    );
    service['versions'].mockReturnValue(
      of([
        { id: 3, version: 1, titre: 'S', statut: 'EN_COURS', publie: true, datePublication: null, dateFermeture: null, dateCreation: '', nombreReponses: 0 },
        { id: 8, version: 2, titre: 'S', statut: 'NON_COMMENCE', publie: false, datePublication: null, dateFermeture: null, dateCreation: '', nombreReponses: 0 },
      ]),
    );
    actions.nouvelleVersion(publie).subscribe();
    expect(naviguer).toHaveBeenCalledWith(['/sondages', 8, 'modifier']);
    expect(snackBar.open.mock.calls.at(-1)![0]).toContain('déjà en préparation');
  });

  it('dupliquer : la copie s’ouvre dans l’éditeur', () => {
    actions.dupliquer(publie).subscribe();
    expect(service['dupliquer']).toHaveBeenCalledWith(3);
    expect(naviguer).toHaveBeenCalledWith(['/sondages', 12, 'modifier']);
  });

  it('modèle : bascule et message', () => {
    actions.basculerModele(publie).subscribe();
    expect(service['marquerModele']).toHaveBeenCalledWith(3, true);
    expect(snackBar.open.mock.calls.at(-1)![0]).toContain('Marqué comme modèle');
  });

  it('refus du serveur : message, rien n’est émis', () => {
    service['marquerModele'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, error: { code: 'ACTION_RESERVEE_CREATEUR', message: 'Réservé.' } })),
    );
    const emis = vi.fn();
    actions.basculerModele(publie).subscribe(emis);
    expect(emis).not.toHaveBeenCalled();
    expect(snackBar.open.mock.calls.at(-1)![0]).toBe('Réservé.');
  });
});
