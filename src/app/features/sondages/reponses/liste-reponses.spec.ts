import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ReponseResponse } from '../../../core/models/statistiques.model';
import { SondageService } from '../../../core/services/sondage.service';
import { StatistiquesService } from '../../../core/services/statistiques.service';
import { sondageDeTest } from '../../../testing/donnees-test';
import { ListeReponses } from './liste-reponses';

const reponse = (modifs: Partial<ReponseResponse> = {}): ReponseResponse => ({
  id: 1,
  sondageId: 3,
  version: 1,
  dateSoumission: '2026-11-20T10:00:00Z',
  langue: 'fr',
  valeurs: [],
  ...modifs,
});

/** Colonne « Invité » de l'onglet Réponses : seulement en mode nominatif. */
describe('Onglet « Réponses » : colonne Invité', () => {
  async function afficher(nominatif: boolean, reponses: ReponseResponse[]): Promise<HTMLElement> {
    TestBed.configureTestingModule({
      imports: [ListeReponses],
      providers: [
        provideRouter([]),
        { provide: SondageService, useValue: { detail: vi.fn(() => of(sondageDeTest({ id: 3, publie: true, statut: 'EN_COURS', reponsesNominatives: nominatif }))), versions: vi.fn(() => of([])) } },
        { provide: StatistiquesService, useValue: { reponses: vi.fn(() => of({ contenu: reponses, page: 0, taille: 20, totalElements: reponses.length, totalPages: 1 })) } },
        { provide: MatDialog, useValue: { open: vi.fn() } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
    const fixture = TestBed.createComponent(ListeReponses);
    fixture.componentRef.setInput('id', '3');
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('mode anonyme : aucune colonne Invité', async () => {
    const el = await afficher(false, [reponse()]);
    expect(el.querySelector('ul.reponses')).not.toBeNull();
    expect(el.querySelector('ul.reponses.nominatives')).toBeNull();
    expect(el.querySelector('.invite')).toBeNull();
  });

  it('mode nominatif : nom et courriel de l’invité ; réponse par le lien public : « Anonyme (lien public) »', async () => {
    const el = await afficher(true, [
      reponse({ id: 1, invite: { invitationId: 9, prenom: 'Aminata', nom: 'Diallo', courriel: 'aminata@exemple.com' } }),
      reponse({ id: 2, invite: null }),
    ]);
    const cellules = Array.from(el.querySelectorAll<HTMLElement>('.invite'));
    expect(cellules.length).toBe(2);
    expect(cellules[0].querySelector('.nom-invite')!.textContent).toContain('Aminata Diallo');
    expect(cellules[0].querySelector('.courriel-invite')!.textContent).toContain('aminata@exemple.com');
    expect(cellules[0].querySelector('.courriel-invite')!.getAttribute('dir')).toBe('ltr');
    expect(cellules[1].textContent).toContain('Anonyme (lien public)');
  });

  it('vue « toutes les versions » : une réponse d’une version nominative fait apparaître la colonne', async () => {
    const el = await afficher(false, [reponse({ invite: { invitationId: 9, prenom: null, nom: null, courriel: 'fatou@exemple.com' } })]);
    expect(el.querySelector('.invite .nom-invite')!.textContent).toContain('fatou@exemple.com');
  });
});
