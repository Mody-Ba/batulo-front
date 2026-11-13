import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { Role } from '../../../core/models/role.model';
import { AssignationService } from '../../../core/services/assignation.service';
import { AuthService } from '../../../core/services/auth.service';
import { SondageService } from '../../../core/services/sondage.service';
import { DetailSondage } from './detail-sondage';

const SONDAGE = {
  id: 3,
  entrepriseId: 1,
  titre: 'Satisfaction 2026',
  description: null,
  statut: 'EN_COURS',
  publie: true,
  datePublication: '2026-11-01T12:00:00Z',
  dateFermeture: null,
  version: 1,
  sondageOrigineId: null,
  estModele: false,
  reponseUnique: true,
  creePar: { id: 1, prenom: 'Awa', nom: 'Diallo' },
  dateCreation: '2026-11-01T12:00:00Z',
  dateModification: '2026-11-01T12:00:00Z',
  sections: [],
};
const ASSIGNATION = {
  gestionnaireId: 7,
  prenom: 'Moussa',
  nom: 'Kane',
  courriel: 'moussa@test.local',
  actif: true,
  dateAssignation: '2026-11-02T12:00:00Z',
  assignePar: null,
};

describe('DetailSondage', () => {
  let fixture: ComponentFixture<DetailSondage>;
  let reponseDialogue: boolean;
  let assignations: { lister: ReturnType<typeof vi.fn>; retirer: ReturnType<typeof vi.fn> };
  const role = signal<Role>('ADMIN');
  const lectureSeule = signal(false);

  async function creer(): Promise<HTMLElement> {
    fixture = TestBed.createComponent(DetailSondage);
    fixture.componentRef.setInput('id', '3');
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  beforeEach(() => {
    reponseDialogue = true;
    role.set('ADMIN');
    lectureSeule.set(false);
    assignations = { lister: vi.fn(() => of([ASSIGNATION])), retirer: vi.fn(() => of(null)) };
    TestBed.configureTestingModule({
      imports: [DetailSondage],
      providers: [
        provideRouter([]),
        {
          provide: SondageService,
          useValue: {
            detail: () => of(SONDAGE),
            collecte: () =>
              of({ sondageId: 3, version: 1, statut: 'EN_COURS', collecteOuverte: true, raisonFermeture: null, nombreReponses: 12, nombreReponsesTotal: 12, derniereReponse: null }),
            versions: () => of([]),
          },
        },
        { provide: AssignationService, useValue: assignations },
        { provide: AuthService, useValue: { role, lectureSeule, utilisateur: signal({ id: 1, peutCreerSondages: true }) } },
        { provide: MatDialog, useValue: { open: () => ({ afterClosed: () => of(reponseDialogue) }) } },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
  });

  it('admin : informations, collecte et gestionnaires assignés', async () => {
    const element = await creer();
    expect(element.textContent).toContain('Satisfaction 2026');
    expect(element.textContent).toContain('12');
    expect(element.textContent).toContain('Moussa Kane');
    expect(assignations.lister).toHaveBeenCalledWith(3);
  });

  it('gestionnaire : pas de gestion des assignations', async () => {
    role.set('GESTIONNAIRE');
    const element = await creer();
    expect(element.textContent).not.toContain('Gestionnaires assignés');
    expect(assignations.lister).not.toHaveBeenCalled();
  });

  it('retire une assignation seulement après confirmation', async () => {
    reponseDialogue = false;
    const element = await creer();
    const bouton = element.querySelector<HTMLButtonElement>('button[aria-label^="Retirer l’assignation"]')!;
    bouton.click();
    expect(assignations.retirer).not.toHaveBeenCalled();

    reponseDialogue = true;
    bouton.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(assignations.retirer).toHaveBeenCalledWith(3, 7);
    expect(element.textContent).not.toContain('Moussa Kane');
  });

  it('abonnement expiré : assigner et retirer désactivés', async () => {
    lectureSeule.set(true);
    const element = await creer();
    const assigner = Array.from(element.querySelectorAll('button')).find((b) => b.textContent?.includes('Assigner'))!;
    expect(assigner.disabled).toBe(true);
    expect(element.querySelector<HTMLButtonElement>('button[aria-label^="Retirer l’assignation"]')!.disabled).toBe(true);
  });

  it('publié : « Voir le contenu » ; brouillon modifiable : « Modifier », vers l’éditeur', async () => {
    let element = await creer();
    let lien = Array.from(element.querySelectorAll('a')).find((a) => a.textContent?.includes('Voir le contenu'));
    expect(lien?.getAttribute('href')).toBe('/sondages/3/modifier');

    TestBed.inject(SondageService).detail = vi.fn(() => of({ ...SONDAGE, publie: false, statut: 'NON_COMMENCE' })) as never;
    element = await creer();
    lien = Array.from(element.querySelectorAll('a')).find((a) => a.textContent?.includes('Modifier'));
    expect(lien?.getAttribute('href')).toBe('/sondages/3/modifier');
  });
});
