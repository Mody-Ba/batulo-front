import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { QuestionRequest, SondageResponse } from '../../../core/models/sondage.model';
import { AuthService } from '../../../core/services/auth.service';
import { SondageService } from '../../../core/services/sondage.service';
import { questionDeTest, sectionDeTest, sondageDeTest } from '../../../testing/donnees-test';
import { EditeurSondageStore } from './editeur-sondage.store';

const DEMANDE: QuestionRequest = {
  libelle: 'Nouvelle',
  aide: null,
  type: 'OUI_NON',
  obligatoire: false,
  configuration: {},
  options: [],
};

describe('EditeurSondageStore', () => {
  let store: EditeurSondageStore;
  let service: Record<string, ReturnType<typeof vi.fn>>;
  const lectureSeule = signal(false);

  function erreur(code: string, status = 409): HttpErrorResponse {
    return new HttpErrorResponse({ status, error: { code, message: `Refus ${code}` } });
  }

  beforeEach(() => {
    lectureSeule.set(false);
    service = {
      detail: vi.fn(() => of(sondageDeTest())),
      modifier: vi.fn(),
      ajouterQuestion: vi.fn(),
      modifierQuestion: vi.fn(),
      ordonnerQuestions: vi.fn(),
      ordonnerSections: vi.fn(),
      versions: vi.fn(() => of([])),
      deplacerQuestion: vi.fn(),
      definirCritere: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        EditeurSondageStore,
        { provide: SondageService, useValue: service },
        {
          provide: AuthService,
          useValue: { role: signal('ADMIN'), utilisateur: signal({ id: 1 }), lectureSeule },
        },
      ],
    });
    store = TestBed.inject(EditeurSondageStore);
    store.charger(3).subscribe();
  });

  it('file d’écritures : la seconde ne part qu’une fois la première terminée, et chacune met le sondage à jour', () => {
    const premiere = new Subject<SondageResponse>();
    const seconde = new Subject<SondageResponse>();
    service['modifier'].mockReturnValueOnce(premiere).mockReturnValueOnce(seconde);

    const resultats: string[] = [];
    store.modifierEnTete({ titre: 'Un', description: null, reponseUnique: true }).subscribe((s) => resultats.push(s.titre));
    store.modifierEnTete({ titre: 'Deux', description: null, reponseUnique: true }).subscribe((s) => resultats.push(s.titre));
    expect(service['modifier']).toHaveBeenCalledTimes(1);
    expect(store.etatGlobal()).toBe('enregistrement');

    premiere.next(sondageDeTest({ titre: 'Un' }));
    premiere.complete();
    expect(service['modifier']).toHaveBeenCalledTimes(2);
    expect(store.sondage()?.titre).toBe('Un');

    seconde.next(sondageDeTest({ titre: 'Deux' }));
    seconde.complete();
    expect(resultats).toEqual(['Un', 'Deux']);
    expect(store.sondage()?.titre).toBe('Deux');
    expect(store.etatGlobal()).toBe('enregistre');
  });

  it('une écriture refusée n’arrête pas la file', () => {
    service['modifier']
      .mockReturnValueOnce(throwError(() => erreur('VALIDATION', 400)))
      .mockReturnValueOnce(of(sondageDeTest({ titre: 'Après' })));
    const echec = vi.fn();
    store.modifierEnTete({ titre: 'X', description: null, reponseUnique: true }).subscribe({ error: echec });
    store.modifierEnTete({ titre: 'Après', description: null, reponseUnique: true }).subscribe();
    expect(echec).toHaveBeenCalled();
    expect(store.sondage()?.titre).toBe('Après');
    expect(store.modifiable()).toBe(true);
  });

  it('nouvelle question : la carte garde sa clé une fois la question créée sur le serveur', () => {
    const cle = store.ajouterQuestionLocale(10);
    expect(store.elements().get(10)).toEqual([{ cle, question: null }]);

    const creee = questionDeTest({ id: 555, type: 'OUI_NON', libelle: 'Nouvelle', options: [] });
    service['ajouterQuestion'].mockReturnValue(of(sondageDeTest({ sections: [sectionDeTest({ questions: [creee] })] })));
    const emise = vi.fn();
    store.creerQuestion(10, cle, DEMANDE).subscribe(emise);

    expect(service['ajouterQuestion']).toHaveBeenCalledWith(3, 10, DEMANDE);
    expect(emise).toHaveBeenCalledWith(creee);
    expect(store.elements().get(10)).toEqual([{ cle, question: creee }]);
  });

  it('nouvelle question à la suite d’autres : retrouvée parmi les questions inconnues avant l’envoi', () => {
    const existante = questionDeTest({ id: 101 });
    store.sondage.set(sondageDeTest({ sections: [sectionDeTest({ questions: [existante] })] }));
    const cle = store.ajouterQuestionLocale(10);
    const creee = questionDeTest({ id: 102, ordre: 2 });
    service['ajouterQuestion'].mockReturnValue(
      of(sondageDeTest({ sections: [sectionDeTest({ questions: [existante, creee] })] })),
    );
    store.creerQuestion(10, cle, DEMANDE).subscribe();
    expect(store.elements().get(10)?.map((e) => e.cle)).toEqual(['question-101', cle]);
  });

  it('déplacer une question : ordre changé tout de suite, puis envoyé ; en cas d’échec, recharger rend l’ordre du serveur', () => {
    const q1 = questionDeTest({ id: 1, libelle: 'Un' });
    const q2 = questionDeTest({ id: 2, libelle: 'Deux' });
    const serveur = sondageDeTest({ sections: [sectionDeTest({ questions: [q1, q2] })] });
    store.sondage.set(serveur);
    const reponse = new Subject<SondageResponse>();
    service['ordonnerQuestions'].mockReturnValue(reponse);
    service['detail'].mockReturnValue(of(serveur));

    const echec = vi.fn();
    store.deplacerQuestion(10, 0, 1).subscribe({ error: echec });
    expect(store.sondage()?.sections[0].questions.map((q) => q.id)).toEqual([2, 1]);
    expect(service['ordonnerQuestions']).toHaveBeenCalledWith(3, 10, { ids: [2, 1] });

    reponse.error(erreur('ORDRE_INVALIDE', 400));
    expect(echec).toHaveBeenCalled();
    store.recharger();
    expect(store.sondage()?.sections[0].questions.map((q) => q.id)).toEqual([1, 2]);
  });

  it('déplacer : les questions locales ne comptent pas, la cible est ramenée parmi les enregistrées', () => {
    const q1 = questionDeTest({ id: 1 });
    const q2 = questionDeTest({ id: 2 });
    store.sondage.set(sondageDeTest({ sections: [sectionDeTest({ questions: [q1, q2] })] }));
    store.ajouterQuestionLocale(10);
    service['ordonnerQuestions'].mockReturnValue(of(store.sondage()!));
    store.deplacerQuestion(10, 0, 2).subscribe();
    expect(service['ordonnerQuestions']).toHaveBeenCalledWith(3, 10, { ids: [2, 1] });
  });

  it('déplacer une section : ordre changé tout de suite, toutes les sections envoyées', () => {
    store.sondage.set(sondageDeTest({ sections: [sectionDeTest({ id: 10 }), sectionDeTest({ id: 20 })] }));
    service['ordonnerSections'].mockReturnValue(new Subject());
    store.deplacerSection(1, 0).subscribe();
    expect(store.sondage()?.sections.map((s) => s.id)).toEqual([20, 10]);
    expect(service['ordonnerSections']).toHaveBeenCalledWith(3, { ids: [20, 10] });
  });

  it('refus de droits ou de statut par le serveur : tout l’éditeur passe en lecture seule', () => {
    expect(store.modifiable()).toBe(true);
    service['modifierQuestion'].mockReturnValue(throwError(() => erreur('SONDAGE_PUBLIE')));
    store.modifierQuestion(101, DEMANDE).subscribe({ error: () => undefined });
    expect(store.modifiable()).toBe(false);
    expect(store.raisonLectureSeule()).toBe('Refus SONDAGE_PUBLIE');
  });

  it('abonnement expiré : lecture seule dès le chargement', () => {
    lectureSeule.set(true);
    expect(store.modifiable()).toBe(false);
  });

  it('état global : à enregistrer, à corriger, puis tout enregistré', () => {
    store.signalerEtat('question-1', 'modifie');
    expect(store.etatGlobal()).toBe('a-enregistrer');
    expect(store.modificationsEnAttente()).toBe(true);
    store.signalerEtat('question-2', 'invalide');
    expect(store.etatGlobal()).toBe('erreur');
    expect(store.nombreNonEnregistres()).toBe(2);
    store.oublierEtat('question-2');
    store.signalerEtat('question-1', 'enregistre');
    expect(store.modificationsEnAttente()).toBe(false);
  });

  it('sondage publié : contenu figé, mais critères réglables par qui gère le sondage', () => {
    store.sondage.set(sondageDeTest({ publie: true, statut: 'EN_COURS' }));
    expect(store.modifiable()).toBe(false);
    expect(store.criteresModifiables()).toBe(true);
    service['definirCritere'].mockReturnValue(of(sondageDeTest({ publie: true, statut: 'EN_COURS' })));
    store.definirCritere(101, { estCritere: true, critereConfig: null }).subscribe();
    expect(service['definirCritere']).toHaveBeenCalledWith(3, 101, { estCritere: true, critereConfig: null });
  });

  it('refus de permission du serveur : critères bloqués aussi ; « sondage publié » ne les bloque pas', () => {
    service['modifierQuestion'].mockReturnValue(throwError(() => erreur('SONDAGE_PUBLIE')));
    store.modifierQuestion(101, DEMANDE).subscribe({ error: () => undefined });
    expect(store.criteresModifiables()).toBe(true);
    service['modifierQuestion'].mockReturnValue(throwError(() => erreur('PERMISSION_SONDAGES_REQUISE', 403)));
    store.modifierQuestion(101, DEMANDE).subscribe({ error: () => undefined });
    expect(store.criteresModifiables()).toBe(false);
  });

  it('après une publication : le sondage publié remplace le brouillon, les versions sont relues', () => {
    service['versions'].mockClear();
    store.remplacer(sondageDeTest({ publie: true, statut: 'EN_COURS' }));
    expect(store.modifiable()).toBe(false);
    expect(service['versions']).toHaveBeenCalledWith(3);
  });

  it('changer de section : tout de suite à l’écran, puis PUT avec la position (à partir de 1)', () => {
    const q1 = questionDeTest({ id: 1 });
    const q2 = questionDeTest({ id: 2 });
    const q3 = questionDeTest({ id: 3 });
    store.sondage.set(
      sondageDeTest({
        sections: [sectionDeTest({ id: 10, questions: [q1, q2] }), sectionDeTest({ id: 20, questions: [q3] })],
      }),
    );
    service['deplacerQuestion'].mockReturnValue(new Subject());
    store.changerDeSection(2, 20, 0).subscribe();
    expect(store.sondage()?.sections.map((s) => s.questions.map((q) => q.id))).toEqual([[1], [2, 3]]);
    expect(service['deplacerQuestion']).toHaveBeenCalledWith(3, 2, { sectionId: 20, position: 1 });
    expect(store.elements().get(20)?.map((e) => e.cle)).toEqual(['question-2', 'question-3']);
  });

  it('changer de section : à la fin par défaut ; refusé en cas d’échec, recharger rend l’état du serveur', () => {
    const serveur = sondageDeTest({
      sections: [
        sectionDeTest({ id: 10, questions: [questionDeTest({ id: 1 })] }),
        sectionDeTest({ id: 20, questions: [questionDeTest({ id: 3 })] }),
      ],
    });
    store.sondage.set(serveur);
    service['deplacerQuestion'].mockReturnValue(throwError(() => erreur('LIMITE_ATTEINTE', 400)));
    service['detail'].mockReturnValue(of(serveur));
    const echec = vi.fn();
    store.changerDeSection(1, 20).subscribe({ error: echec });
    expect(service['deplacerQuestion']).toHaveBeenCalledWith(3, 1, { sectionId: 20, position: 2 });
    expect(echec).toHaveBeenCalled();
    store.recharger();
    expect(store.sondage()?.sections.map((s) => s.questions.map((q) => q.id))).toEqual([[1], [3]]);
  });

  it('changer de section : seulement une question enregistrée sans modification, dans un brouillon', () => {
    store.sondage.set(sondageDeTest({ sections: [sectionDeTest({ id: 10, questions: [questionDeTest({ id: 1 })] })] }));
    expect(store.peutChangerDeSection(1)).toBe(true);
    store.signalerEtat('question-1', 'modifie');
    expect(store.peutChangerDeSection(1)).toBe(false);
    store.signalerEtat('question-1', 'enregistre');
    expect(store.peutChangerDeSection(null)).toBe(false);
    store.sondage.set(sondageDeTest({ publie: true, statut: 'EN_COURS' }));
    expect(store.peutChangerDeSection(1)).toBe(false);
  });
});
