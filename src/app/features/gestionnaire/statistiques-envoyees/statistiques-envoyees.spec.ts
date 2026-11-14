import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { StatistiquesService } from '../../../core/services/statistiques.service';
import { StatistiquesEnvoyees } from './statistiques-envoyees';

describe('Statistiques envoyées (gestionnaire)', () => {
  it('liste paginée : sondage (lien vers ses statistiques), portée, commentaire, consulté ou non', async () => {
    const envoyees = vi.fn(() =>
      of({
        contenu: [
          { id: 7, sondageId: 3, sondageTitre: 'Malnutrition', version: 2, lignee: false, du: null, au: null, granulariteDate: null, criteres: [], gestionnaireId: 9, expediteurNom: 'Moussa Kane', commentaire: 'Kayes', dateEnvoi: '2026-11-13T10:00:00Z', consulteLe: null },
          { id: 8, sondageId: 4, sondageTitre: 'Eau', version: 1, lignee: true, du: null, au: null, granulariteDate: null, criteres: [], gestionnaireId: 9, expediteurNom: 'Moussa Kane', commentaire: null, dateEnvoi: '2026-11-12T10:00:00Z', consulteLe: '2026-11-12T12:00:00Z' },
        ],
        page: 0,
        taille: 20,
        totalElements: 2,
        totalPages: 1,
      }),
    );
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: StatistiquesService, useValue: { envoyees } }] });
    const f = TestBed.createComponent(StatistiquesEnvoyees);
    f.componentRef.setInput('page', '1');
    await f.whenStable();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(envoyees).toHaveBeenCalledWith(1, 20);
    const envois = el.querySelectorAll('.envoi');
    expect(envois[0].querySelector('a')!.getAttribute('href')).toBe('/sondages/3/statistiques');
    expect(envois[0].textContent).toContain('Pas encore consulté');
    expect(envois[0].textContent).toContain('version 2');
    expect(envois[0].textContent).toContain('« Kayes »');
    expect(envois[1].textContent).toContain('toutes les versions');
    expect(envois[1].textContent).toContain('consulté le');
  });
});
