import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of } from 'rxjs';
import { AssignationService } from '../../../core/services/assignation.service';
import { GestionnaireService } from '../../../core/services/gestionnaire.service';
import { gestionnaireDeTest } from '../../../testing/donnees-test';
import { DialogueAssignerGestionnaires, LIMITE_GESTIONNAIRES } from './dialogue-assigner-gestionnaires';

describe('DialogueAssignerGestionnaires', () => {
  it('ne demande que les gestionnaires actifs et écarte les déjà assignés et le créateur', async () => {
    const lister = vi.fn(() =>
      of({
        contenu: [
          gestionnaireDeTest({ id: 7, prenom: 'Moussa' }),
          gestionnaireDeTest({ id: 8, prenom: 'Déjà' }),
          gestionnaireDeTest({ id: 9, prenom: 'Créateur' }),
          gestionnaireDeTest({ id: 10, prenom: 'Fatou' }),
        ],
        page: 0,
        taille: LIMITE_GESTIONNAIRES,
        totalElements: 4,
        totalPages: 1,
      }),
    );
    TestBed.configureTestingModule({
      imports: [DialogueAssignerGestionnaires],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { sondageId: 3, titre: 'Satisfaction', dejaAssignes: [8], createurId: 9 } },
        { provide: MatDialogRef, useValue: { close: vi.fn(), disableClose: false } },
        { provide: GestionnaireService, useValue: { lister } },
        { provide: AssignationService, useValue: { assigner: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(DialogueAssignerGestionnaires);
    await fixture.whenStable();
    fixture.detectChanges();

    expect(lister).toHaveBeenCalledWith({ actif: true, taille: LIMITE_GESTIONNAIRES });
    const options = Array.from(fixture.nativeElement.querySelectorAll('mat-list-option')).map(
      (o) => (o as HTMLElement).textContent ?? '',
    );
    expect(options).toHaveLength(2);
    expect(options[0]).toContain('Moussa');
    expect(options[1]).toContain('Fatou');
  });
});
