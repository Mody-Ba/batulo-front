import { moveItemInArray } from '@angular/cdk/drag-drop';
import { computed, inject, Injectable, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, concatMap, EMPTY, finalize, map, Observable, ReplaySubject, Subject, tap } from 'rxjs';
import {
  CritereRequest,
  QuestionRequest,
  QuestionResponse,
  SectionRequest,
  SectionResponse,
  SondageRequest,
  SondageResponse,
  VersionResponse,
} from '../../../core/models/sondage.model';
import { AuthService } from '../../../core/services/auth.service';
import { SondageService } from '../../../core/services/sondage.service';
import { aLeCode, messageErreur } from '../../../core/utils/erreur-http';
import { REGLES_SONDAGE } from '../../../core/utils/regles-question';
import { situationVersions } from '../cycle-de-vie/versions';
import { droitsSondage, raisonLectureSeule } from '../droits-sondage';
import { EtatEnregistrement } from './enregistrement-auto';

/** Refus du serveur qui rendent tout l'éditeur en lecture seule. */
const CODES_VERROU = [
  'SONDAGE_PUBLIE',
  'PERMISSION_SONDAGES_REQUISE',
  'ACTION_RESERVEE_CREATEUR',
  'ABONNEMENT_EXPIRE',
];

/** Question affichée dans une section : enregistrée (`question`) ou encore locale (null). */
export interface ElementQuestion {
  /** Identité stable pour l'affichage : elle ne change pas quand une question locale est enregistrée. */
  cle: string;
  question: QuestionResponse | null;
}

interface Ecriture {
  requete: () => Observable<SondageResponse>;
  resultat: ReplaySubject<SondageResponse>;
}

/**
 * État de l'éditeur d'un sondage (fourni par la page, une instance par sondage ouvert).
 * - Toutes les écritures passent par une file et partent l'une après l'autre : le backend n'a pas de verrouillage
 *   optimiste et chaque écriture recharge le sondage complet.
 * - Chaque réponse (le sondage complet) remplace `sondage` ; les formulaires des cartes ne sont pas recréés, une
 *   saisie en cours n'est donc jamais écrasée.
 * - Les questions pas encore enregistrées sont gardées à part (`locales`), à la fin de leur section.
 */
@Injectable()
export class EditeurSondageStore {
  private readonly service = inject(SondageService);
  private readonly auth = inject(AuthService);

  readonly sondage = signal<SondageResponse | null>(null);
  /** Message du serveur qui a refusé une écriture pour une raison de droits ou de statut. */
  readonly verrou = signal<string | null>(null);

  readonly raisonLectureSeule = computed(() => {
    const sondage = this.sondage();
    if (!sondage) {
      return null;
    }
    return (
      this.verrou() ??
      raisonLectureSeule(sondage, {
        role: this.auth.role(),
        utilisateur: this.auth.utilisateur(),
        lectureSeule: this.auth.lectureSeule(),
      })
    );
  });
  readonly modifiable = computed(() => !!this.sondage() && this.raisonLectureSeule() === null);

  /** Droits du cycle de vie (publier, fermer, nouvelle version, critères), indépendants du statut. */
  readonly droits = computed(() => {
    const sondage = this.sondage();
    return sondage
      ? droitsSondage(sondage, {
          role: this.auth.role(),
          utilisateur: this.auth.utilisateur(),
          lectureSeule: this.auth.lectureSeule(),
        })
      : null;
  });
  /**
   * Critères d'analyse : réglables même sondage publié, par qui gère le sondage. Un refus de droits par le serveur
   * (autre que « sondage publié », qui ne concerne que le contenu) les bloque aussi.
   */
  readonly criteresModifiables = computed(() => !!this.droits()?.gerer && !this.verrouDroits());
  private readonly verrouDroits = signal(false);

  /** Versions de la lignée (pour « Nouvelle version » / « Ouvrir la version en préparation »). */
  readonly versions = signal<VersionResponse[]>([]);
  readonly situation = computed(() => situationVersions(this.sondage()?.id ?? 0, this.versions()));

  /** Questions locales par section (clés, dans l'ordre d'ajout). */
  private readonly locales = signal<ReadonlyMap<number, readonly string[]>>(new Map());
  /** Clé d'affichage des questions enregistrées qui ont commencé localement. */
  private readonly clesQuestions = new Map<number, string>();
  private compteurLocal = 0;

  /** Questions de chaque section : enregistrées dans l'ordre du serveur, puis locales. */
  readonly elements = computed(() => {
    const parSection = new Map<number, ElementQuestion[]>();
    const locales = this.locales();
    for (const section of this.sondage()?.sections ?? []) {
      parSection.set(section.id, [
        ...section.questions.map((q) => ({ cle: this.cleQuestion(q.id), question: q })),
        ...(locales.get(section.id) ?? []).map((cle) => ({ cle, question: null })),
      ]);
    }
    return parSection;
  });

  /** États d'enregistrement signalés par l'en-tête, les sections et les questions. */
  private readonly etats = signal<ReadonlyMap<string, EtatEnregistrement>>(new Map());
  /** Écritures envoyées ou en attente dans la file. */
  private readonly ecrituresEnCours = signal(0);

  readonly nombreNonEnregistres = computed(
    () => [...this.etats().values()].filter((e) => e === 'modifie' || e === 'invalide' || e === 'erreur').length,
  );
  readonly etatGlobal = computed<'enregistre' | 'enregistrement' | 'a-enregistrer' | 'erreur'>(() => {
    const etats = [...this.etats().values()];
    if (this.ecrituresEnCours() > 0 || etats.includes('enregistrement')) {
      return 'enregistrement';
    }
    if (etats.includes('erreur') || etats.includes('invalide')) {
      return 'erreur';
    }
    return etats.includes('modifie') ? 'a-enregistrer' : 'enregistre';
  });
  /** Quitter la page perdrait quelque chose. */
  readonly modificationsEnAttente = computed(() => this.etatGlobal() !== 'enregistre');

  private readonly file = new Subject<Ecriture>();

  constructor() {
    this.file
      .pipe(
        concatMap(({ requete, resultat }) =>
          requete().pipe(
            tap({
              next: (sondage) => {
                this.sondage.set(sondage);
                resultat.next(sondage);
                resultat.complete();
              },
              error: (erreur: unknown) => {
                if (CODES_VERROU.some((code) => aLeCode(erreur, code))) {
                  this.verrou.set(messageErreur(erreur));
                }
                if (CODES_VERROU.some((code) => code !== 'SONDAGE_PUBLIE' && aLeCode(erreur, code))) {
                  this.verrouDroits.set(true);
                }
                resultat.error(erreur);
              },
            }),
            catchError(() => EMPTY),
            finalize(() => this.ecrituresEnCours.update((n) => n - 1)),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  // ---------------------------------------------------------------- Chargement et états

  charger(id: number): Observable<SondageResponse> {
    return this.service.detail(id).pipe(
      tap((sondage) => {
        this.sondage.set(sondage);
        this.chargerVersions(sondage.id);
      }),
    );
  }

  /** Les versions servent seulement à proposer une action : une erreur les laisse vides. */
  chargerVersions(id = this.sondage()?.id): void {
    if (id) {
      this.service.versions(id).subscribe({ next: (v) => this.versions.set(v), error: () => this.versions.set([]) });
    }
  }

  /** Après une action du cycle de vie (publication, dates...) : le sondage à jour remplace l'ancien. */
  remplacer(sondage: SondageResponse): void {
    this.verrou.set(null);
    this.sondage.set(sondage);
    this.chargerVersions(sondage.id);
  }

  /** Question telle qu'enregistrée sur le serveur (type, critère), ou undefined. */
  questionEnregistree(questionId: number | null): QuestionResponse | undefined {
    return questionId === null
      ? undefined
      : this.sondage()?.sections.flatMap((s) => s.questions).find((q) => q.id === questionId);
  }

  /** Relit le sondage (après un échec de réordonnancement : l'écran revient à l'ordre du serveur). */
  recharger(): void {
    const sondage = this.sondage();
    if (sondage) {
      this.executer(() => this.service.detail(sondage.id)).subscribe({ error: () => undefined });
    }
  }

  signalerEtat(cle: string, etat: EtatEnregistrement): void {
    this.etats.update((etats) => new Map(etats).set(cle, etat));
  }

  oublierEtat(cle: string): void {
    this.etats.update((etats) => {
      const copie = new Map(etats);
      copie.delete(cle);
      return copie;
    });
  }

  /** Met une écriture dans la file ; l'observable émet le sondage à jour une fois qu'elle est passée. */
  executer(requete: () => Observable<SondageResponse>): Observable<SondageResponse> {
    const resultat = new ReplaySubject<SondageResponse>(1);
    this.ecrituresEnCours.update((n) => n + 1);
    this.file.next({ requete, resultat });
    return resultat;
  }

  private get id(): number {
    const sondage = this.sondage();
    if (!sondage) {
      throw new Error('Aucun sondage chargé.');
    }
    return sondage.id;
  }

  // ---------------------------------------------------------------- Sondage et sections

  modifierEnTete(demande: SondageRequest): Observable<SondageResponse> {
    const id = this.id;
    return this.executer(() => this.service.modifier(id, demande));
  }

  ajouterSection(demande: SectionRequest): Observable<SondageResponse> {
    const id = this.id;
    return this.executer(() => this.service.ajouterSection(id, demande));
  }

  modifierSection(sectionId: number, demande: SectionRequest): Observable<SondageResponse> {
    const id = this.id;
    return this.executer(() => this.service.modifierSection(id, sectionId, demande));
  }

  supprimerSection(sectionId: number): Observable<SondageResponse> {
    const id = this.id;
    return this.executer(() => this.service.supprimerSection(id, sectionId)).pipe(
      tap(() => this.retirerLocales(sectionId)),
    );
  }

  /** Déplace une section (glisser-déposer ou Monter/Descendre) : tout de suite à l'écran, puis sur le serveur. */
  deplacerSection(de: number, vers: number): Observable<SondageResponse> {
    const sondage = this.sondage();
    if (!sondage || de === vers) {
      return EMPTY;
    }
    const sections = [...sondage.sections];
    moveItemInArray(sections, de, vers);
    this.sondage.set({ ...sondage, sections });
    const ids = sections.map((s) => s.id);
    return this.executer(() => this.service.ordonnerSections(sondage.id, { ids }));
  }

  // ---------------------------------------------------------------- Questions

  /** Ajoute une question locale à la fin de la section ; elle sera créée sur le serveur dès qu'elle est valide. */
  ajouterQuestionLocale(sectionId: number): string {
    const cle = `nouvelle-${++this.compteurLocal}`;
    this.locales.update((locales) => new Map(locales).set(sectionId, [...(locales.get(sectionId) ?? []), cle]));
    return cle;
  }

  retirerQuestionLocale(sectionId: number, cle: string): void {
    this.locales.update((locales) =>
      new Map(locales).set(
        sectionId,
        (locales.get(sectionId) ?? []).filter((c) => c !== cle),
      ),
    );
  }

  /** POST de la question locale `cle` ; émet la question créée. La carte garde son identité (`cle`). */
  creerQuestion(sectionId: number, cle: string, demande: QuestionRequest): Observable<QuestionResponse> {
    const id = this.id;
    const avant = new Set(this.section(sectionId)?.questions.map((q) => q.id) ?? []);
    let creee: QuestionResponse | undefined;
    return this.executer(() =>
      this.service.ajouterQuestion(id, sectionId, demande).pipe(
        tap((sondage) => {
          // Avant que `sondage` ne soit remplacé : la nouvelle question reprend la clé de la carte locale.
          creee = sondage.sections.find((s) => s.id === sectionId)?.questions.find((q) => !avant.has(q.id));
          if (creee) {
            this.clesQuestions.set(creee.id, cle);
            this.retirerQuestionLocale(sectionId, cle);
          }
        }),
      ),
    ).pipe(
      map(() => {
        if (!creee) {
          throw new Error('La question créée est introuvable dans la réponse du serveur.');
        }
        return creee;
      }),
    );
  }

  /** PUT ; émet la question telle qu'enregistrée (configuration normalisée, options avec leurs ids). */
  modifierQuestion(questionId: number, demande: QuestionRequest): Observable<QuestionResponse> {
    const id = this.id;
    return this.executer(() => this.service.modifierQuestion(id, questionId, demande)).pipe(
      map((sondage) => {
        const question = sondage.sections.flatMap((s) => s.questions).find((q) => q.id === questionId);
        if (!question) {
          throw new Error('La question modifiée est introuvable dans la réponse du serveur.');
        }
        return question;
      }),
    );
  }

  supprimerQuestion(questionId: number): Observable<SondageResponse> {
    const id = this.id;
    return this.executer(() => this.service.supprimerQuestion(id, questionId));
  }

  /**
   * Déplace une question enregistrée dans sa section (les questions locales restent à la fin et ne comptent pas
   * dans l'ordre envoyé). Tout de suite à l'écran, puis sur le serveur.
   */
  deplacerQuestion(sectionId: number, de: number, vers: number): Observable<SondageResponse> {
    const sondage = this.sondage();
    const section = this.section(sectionId);
    if (!sondage || !section || de === vers) {
      return EMPTY;
    }
    const questions = [...section.questions];
    const cible = Math.min(Math.max(vers, 0), questions.length - 1);
    if (de === cible) {
      return EMPTY;
    }
    moveItemInArray(questions, de, cible);
    this.sondage.set({
      ...sondage,
      sections: sondage.sections.map((s) => (s.id === sectionId ? { ...s, questions } : s)),
    });
    const ids = questions.map((q) => q.id);
    return this.executer(() => this.service.ordonnerQuestions(sondage.id, sectionId, { ids }));
  }

  /** Critère d'analyse d'une question (PUT .../critere), permis même sondage publié. */
  definirCritere(questionId: number, critere: CritereRequest): Observable<SondageResponse> {
    const id = this.id;
    return this.executer(() => this.service.definirCritere(id, questionId, critere));
  }

  /**
   * Une question peut changer de section si elle est enregistrée sans modification en attente : sa carte est
   * recréée dans la section d'arrivée, une saisie non envoyée serait perdue.
   */
  peutChangerDeSection(questionId: number | null): boolean {
    if (questionId === null || !this.modifiable()) {
      return false;
    }
    const etat = this.etats().get(this.cleQuestion(questionId));
    return etat === undefined || etat === 'enregistre';
  }

  /** La section peut-elle recevoir une question de plus ? */
  sectionPleine(sectionId: number): boolean {
    return (this.elements().get(sectionId)?.length ?? 0) >= REGLES_SONDAGE.questionsMaxParSection;
  }

  /**
   * Déplace une question enregistrée vers une autre section, à la position `index` parmi ses questions enregistrées
   * (à la fin par défaut) : tout de suite à l'écran, puis sur le serveur (PUT .../section). Brouillon seulement.
   */
  changerDeSection(questionId: number, versSectionId: number, index?: number): Observable<SondageResponse> {
    const sondage = this.sondage();
    const depart = sondage?.sections.find((s) => s.questions.some((q) => q.id === questionId));
    const arrivee = this.section(versSectionId);
    if (!sondage || !depart || !arrivee || depart.id === versSectionId) {
      return EMPTY;
    }
    const question = depart.questions.find((q) => q.id === questionId)!;
    const rang = Math.min(Math.max(index ?? arrivee.questions.length, 0), arrivee.questions.length);
    const questionsArrivee = [...arrivee.questions];
    questionsArrivee.splice(rang, 0, question);
    this.sondage.set({
      ...sondage,
      sections: sondage.sections.map((s) =>
        s.id === depart.id
          ? { ...s, questions: s.questions.filter((q) => q.id !== questionId) }
          : s.id === versSectionId
            ? { ...s, questions: questionsArrivee }
            : s,
      ),
    });
    return this.executer(() =>
      this.service.deplacerQuestion(sondage.id, questionId, { sectionId: versSectionId, position: rang + 1 }),
    );
  }

  private section(sectionId: number): SectionResponse | undefined {
    return this.sondage()?.sections.find((s) => s.id === sectionId);
  }

  private cleQuestion(questionId: number): string {
    return this.clesQuestions.get(questionId) ?? `question-${questionId}`;
  }

  private retirerLocales(sectionId: number): void {
    this.locales.update((locales) => {
      const copie = new Map(locales);
      copie.delete(sectionId);
      return copie;
    });
  }
}
