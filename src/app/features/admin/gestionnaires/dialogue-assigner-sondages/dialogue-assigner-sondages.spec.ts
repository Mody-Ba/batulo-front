import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { SondageResumeResponse } from '../../../../core/models/sondage.model';
import { AssignationService } from '../../../../core/services/assignation.service';
import { GestionnaireService } from '../../../../core/services/gestionnaire.service';
import { SondageService } from '../../../../core/services/sondage.service';
import { gestionnaireDeTest, sondageResumeDeTest } from '../../../../testing/donnees-test';
import { DialogueAssignerSondages } from './dialogue-assigner-sondages';

function sondage(id: number, titre: string, createurId = 1): SondageResumeResponse {
  return sondageResumeDeTest({ id, titre, creePar: { id: createurId, prenom: 'A', nom: 'B' } });
}

describe('DialogueAssignerSondages', () => {
  let assigner: ReturnType<typeof vi.fn>;
  let listerSondages: ReturnType<typeof vi.fn>;
  let fermer: ReturnType<typeof vi.fn>;

  async function creer() {
    const fixture = TestBed.createComponent(DialogueAssignerSondages);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    assigner = vi.fn();
    listerSondages = vi.fn(() =>
      of({
        contenu: [sondage(1, 'Satisfaction'), sondage(2, 'Déjà assigné'), sondage(3, 'Le sien', 7), sondage(4, 'Mobilité')],
        page: 0,
        taille: 100,
        totalElements: 4,
        totalPages: 1,
      }),
    );
    fermer = vi.fn();
    TestBed.configureTestingModule({
      imports: [DialogueAssignerSondages],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { gestionnaire: gestionnaireDeTest({ id: 7 }) } },
        { provide: MatDialogRef, useValue: { close: fermer, disableClose: false } },
        {
          provide: SondageService,
          useValue: { lister: listerSondages },
        },
        {
          provide: GestionnaireService,
          useValue: {
            sondages: () =>
              of({
                contenu: [{ id: 2, titre: 'Déjà assigné', statut: 'EN_COURS', publie: true, version: 1, relation: 'ASSIGNE', dateModification: '' }],
                page: 0,
                taille: 100,
                totalElements: 1,
                totalPages: 1,
              }),
          },
        },
        { provide: AssignationService, useValue: { assigner } },
      ],
    });
  });

  it('ne propose ni les sondages déjà vus ni ceux qu’il a créés', async () => {
    const fixture = await creer();
    const texte = fixture.nativeElement.textContent as string;
    expect(texte).toContain('Satisfaction');
    expect(texte).toContain('Mobilité');
    expect(texte).not.toContain('Déjà assigné');
    expect(texte).not.toContain('Le sien');
  });

  it('un appel par sondage ; un échec n’empêche pas les autres et reste affiché', async () => {
    assigner.mockImplementation((sondageId: number) =>
      sondageId === 4
        ? throwError(
            () =>
              new HttpErrorResponse({
                status: 409,
                error: { code: 'GESTIONNAIRE_CREATEUR', message: 'Moussa Kane a créé une version de ce sondage.' },
              }),
          )
        : of([]),
    );
    const fixture = await creer();
    const composant = fixture.componentInstance as unknown as {
      selection: { set(v: number[]): void };
      assigner(): void;
    };
    composant.selection.set([1, 4]);
    composant.assigner();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(assigner).toHaveBeenCalledWith(1, [7]);
    expect(assigner).toHaveBeenCalledWith(4, [7]);
    const texte = fixture.nativeElement.textContent as string;
    expect(texte).toContain('1 sondage assigné.');
    expect(texte).toContain('Moussa Kane a créé une version de ce sondage.');
    expect(fermer).not.toHaveBeenCalled();
  });

  it('tout réussi : fermeture avec true', async () => {
    assigner.mockReturnValue(of([]));
    const fixture = await creer();
    const composant = fixture.componentInstance as unknown as {
      selection: { set(v: number[]): void };
      assigner(): void;
    };
    composant.selection.set([1, 4]);
    composant.assigner();
    expect(fermer).toHaveBeenCalledWith(true);
  });

  it('ne propose qu’une ligne par sondage (dernière version de chaque lignée)', async () => {
    await creer();
    expect(listerSondages).toHaveBeenCalledWith({ derniereVersion: true, taille: 100 });
  });
});
