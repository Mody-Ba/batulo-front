import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { EnvoiStatistiqueResponse, StatistiquesResponse } from '../../../core/models/statistiques.model';
import { ExportService } from '../../../core/services/export.service';
import { StatistiquesService } from '../../../core/services/statistiques.service';
import { ListeStatistiquesRecues } from './liste-statistiques-recues';
import { StatistiquesRecues } from './statistiques-recues';

const ENVOI: EnvoiStatistiqueResponse = {
  id: 7,
  sondageId: 3,
  sondageTitre: 'Malnutrition',
  version: 2,
  lignee: true,
  du: null,
  au: null,
  granulariteDate: null,
  criteres: ['region:kayes'],
  gestionnaireId: 9,
  expediteurNom: 'Moussa Kane',
  commentaire: 'Résultats de Kayes',
  dateEnvoi: '2026-11-13T10:00:00Z',
  consulteLe: null,
};

const STATS: StatistiquesResponse = {
  sondageId: 3,
  titre: 'Malnutrition',
  lignee: true,
  versions: [1, 2],
  du: null,
  au: null,
  criteres: [{ cle: 'region', questionId: 1, libelle: 'Région', type: 'CHOIX_UNIQUE', valeurs: [{ valeur: 'kayes', libelle: 'Kayes' }] }],
  resume: { nombreReponses: 42, petitEffectif: false, premiereReponse: null, derniereReponse: null },
  questions: [{ questionId: 1, cle: 'q1', section: 'Profil', libelle: 'Région', type: 'CHOIX_UNIQUE', nombreRepondants: 42, sansReponse: 0, petitEffectif: false, options: [] }],
};

describe('Statistiques reçues (admin)', () => {
  let service: Record<string, ReturnType<typeof vi.fn>>;
  let exports: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    service = { recues: vi.fn(() => of({ contenu: [ENVOI], page: 0, taille: 20, totalElements: 1, totalPages: 1 })), recue: vi.fn(() => of(STATS)), envoi: vi.fn(() => of(ENVOI)), textes: vi.fn() };
    exports = { statistiquesRecues: vi.fn(() => of({ nom: 'malnutrition_statistiques.pdf', contenu: new Blob() })), enregistrer: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: StatistiquesService, useValue: service },
        { provide: ExportService, useValue: exports },
        { provide: MatSnackBar, useValue: { open: vi.fn() } },
      ],
    });
  });

  it('liste : sondage, expéditeur, commentaire, « Nouveau » si pas encore ouvert ; ouverture avec l’envoi', async () => {
    const f = TestBed.createComponent(ListeStatistiquesRecues);
    await f.whenStable();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Malnutrition');
    expect(el.textContent).toContain('Nouveau');
    expect(el.textContent).toContain('De Moussa Kane');
    expect(el.textContent).toContain('toutes les versions · 1 critère');
    const naviguer = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    el.querySelector<HTMLButtonElement>('.envoi')!.click();
    expect(naviguer).toHaveBeenCalledWith(['/admin/statistiques-recues', 7], { state: { envoi: ENVOI } });
  });

  it('ouverture : statistiques recalculées, filtres de l’envoi en clair, PDF', async () => {
    history.replaceState({ envoi: ENVOI }, '');
    const f = TestBed.createComponent(StatistiquesRecues);
    f.componentRef.setInput('envoiId', '7');
    await f.whenStable();
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(service['recue']).toHaveBeenCalledWith(7);
    expect(el.textContent).toContain('Toutes les versions · Région = Kayes');
    expect(el.textContent).toContain('Moussa Kane');
    expect(el.textContent).toContain('Résultats de Kayes');
    expect(el.querySelectorAll('app-carte-question-stat').length).toBe(1);
    Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Rapport PDF'))!.click();
    expect(exports['statistiquesRecues']).toHaveBeenCalledWith(7);
    expect(exports['enregistrer']).toHaveBeenCalled();
    history.replaceState(null, '');
  });

  it('sans état de navigation (rechargement, lien d’un message) : l’envoi est relu seul, expéditeur et commentaire affichés', async () => {
    history.replaceState(null, '');
    const f = TestBed.createComponent(StatistiquesRecues);
    f.componentRef.setInput('envoiId', '7');
    await f.whenStable();
    f.detectChanges();
    expect(service['envoi']).toHaveBeenCalledWith(7);
    const texte = (f.nativeElement as HTMLElement).textContent?.replace(/\s+/g, ' ');
    expect(texte).toContain('42 réponses');
    expect(texte).toContain('Envoyées par Moussa Kane');
    expect(texte).toContain('Résultats de Kayes');
  });

  it('envoi illisible : les statistiques s’affichent quand même', async () => {
    history.replaceState(null, '');
    service['envoi'].mockReturnValue(throwError(() => new Error('404')));
    const f = TestBed.createComponent(StatistiquesRecues);
    f.componentRef.setInput('envoiId', '7');
    await f.whenStable();
    f.detectChanges();
    expect((f.nativeElement as HTMLElement).textContent).toContain('42 réponses');
    expect((f.nativeElement as HTMLElement).textContent).not.toContain('Envoyées par');
  });
});
