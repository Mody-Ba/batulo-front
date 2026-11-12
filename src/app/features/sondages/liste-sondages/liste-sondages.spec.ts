import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of } from 'rxjs';
import { Role } from '../../../core/models/role.model';
import { AuthService } from '../../../core/services/auth.service';
import { SondageService } from '../../../core/services/sondage.service';
import { sondageResumeDeTest } from '../../../testing/donnees-test';
import { ListeSondages } from './liste-sondages';

describe('ListeSondages', () => {
  let fixture: ComponentFixture<ListeSondages>;
  let lister: ReturnType<typeof vi.fn>;
  const role = signal<Role>('ADMIN');

  const sondages = [
    sondageResumeDeTest({
      id: 1,
      titre: 'Satisfaction',
      version: 2,
      nombreReponses: 12,
      nombreReponsesLignee: 40,
      gestionnairesAssignes: [
        { id: 7, prenom: 'Moussa', nom: 'Kane', actif: true },
        { id: 8, prenom: 'Fatou', nom: 'Sow', actif: false },
        { id: 9, prenom: 'Ali', nom: 'Ba', actif: true },
      ],
      brouillonEnPreparation: true,
      brouillonEnPreparationId: 15,
    }),
    sondageResumeDeTest({ id: 2, titre: 'Mobilité', nombreReponses: 5, nombreReponsesLignee: 5 }),
  ];

  async function creer(entrees: Record<string, string> = {}): Promise<HTMLElement> {
    fixture = TestBed.createComponent(ListeSondages);
    for (const [nom, valeur] of Object.entries(entrees)) {
      fixture.componentRef.setInput(nom, valeur);
    }
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  function cellules(element: HTMLElement, colonne: string): string[] {
    return Array.from(element.querySelectorAll(`td.mat-column-${colonne}`)).map(
      (c) => c.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    );
  }

  beforeEach(() => {
    role.set('ADMIN');
    lister = vi.fn(() => of({ contenu: sondages, page: 0, taille: 20, totalElements: 2, totalPages: 1 }));
    TestBed.configureTestingModule({
      imports: [ListeSondages],
      providers: [
        provideRouter([]),
        { provide: SondageService, useValue: { lister } },
        { provide: AuthService, useValue: { role, lectureSeule: signal(false), utilisateur: signal(null) } },
      ],
    });
  });

  it('par défaut : une ligne par sondage (dernière version)', async () => {
    await creer();
    expect(lister).toHaveBeenLastCalledWith({ statut: null, derniereVersion: true, page: 0, taille: 20 });
  });

  it('« Toutes les versions » dans l’URL : chaque version, combinable avec le statut', async () => {
    await creer({ versions: 'toutes', statut: 'TERMINE' });
    expect(lister).toHaveBeenLastCalledWith({ statut: 'TERMINE', derniereVersion: false, page: 0, taille: 20 });
  });

  it('la bascule met versions=toutes dans l’URL et revient à la première page', async () => {
    const element = await creer({ page: '2' });
    const naviguer = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const bouton = Array.from(element.querySelectorAll('mat-button-toggle button')).find((b) =>
      b.textContent?.includes('Toutes les versions'),
    ) as HTMLButtonElement;
    bouton.click();
    await fixture.whenStable();
    expect(naviguer).toHaveBeenCalledWith([], {
      queryParams: { versions: 'toutes', page: null },
      queryParamsHandling: 'merge',
    });
  });

  it('réponses : toute la lignée en vue « dernière version », avec la part de la version', async () => {
    const element = await creer();
    expect(cellules(element, 'reponses')).toEqual(['40 dont 12 pour la v2', '5']);
  });

  it('réponses : celles de la version en vue « toutes les versions »', async () => {
    const element = await creer({ versions: 'toutes' });
    expect(cellules(element, 'reponses')).toEqual(['12', '5']);
  });

  it('assignés (admin) : deux noms puis +N, désactivé signalé', async () => {
    const element = await creer();
    const [premier, second] = cellules(element, 'assignes');
    expect(premier).toContain('Moussa Kane, Fatou Sow (désactivé)');
    expect(premier).toContain('+1');
    expect(premier).toContain('Ali Ba');
    expect(second).toBe('Aucun');
  });

  it('gestionnaire : pas de colonne Assignés', async () => {
    role.set('GESTIONNAIRE');
    lister.mockReturnValue(
      of({
        contenu: sondages.map((s) => ({ ...s, gestionnairesAssignes: null })),
        page: 0,
        taille: 20,
        totalElements: 2,
        totalPages: 1,
      }),
    );
    const element = await creer();
    expect(element.querySelector('th.mat-column-assignes')).toBeNull();
    expect(element.querySelector('th.mat-column-reponses')).not.toBeNull();
  });

  it('nouvelle version en préparation : lien vers le brouillon', async () => {
    const element = await creer();
    const liens = Array.from(element.querySelectorAll('a.en-preparation')) as HTMLAnchorElement[];
    expect(liens).toHaveLength(1);
    expect(liens[0].textContent).toContain('Nouvelle version en préparation');
    expect(liens[0].getAttribute('href')).toBe('/sondages/15');
  });
});
