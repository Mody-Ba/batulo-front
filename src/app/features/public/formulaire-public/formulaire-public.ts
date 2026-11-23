import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { debounceTime, Subject } from 'rxjs';
import { ErreurQuestion } from '../../../core/models/erreur.model';
import { ConfirmationReponseResponse, FormulairePublicResponse } from '../../../core/models/formulaire-public.model';
import { FormulairePublicService } from '../../../core/services/formulaire-public.service';
import { codeErreur, corpsErreur, messageErreur } from '../../../core/utils/erreur-http';
import { accueilNecessaire } from '../../../core/models/sondage.model';
import { AccueilSondage, DepartQuestionnaire, RepriseBrouillon } from '../../../shared/formulaire/accueil/accueil-sondage';
import { BandeauApparence } from '../../../shared/formulaire/apparence/bandeau-apparence';
import { variablesApparence } from '../../../shared/formulaire/apparence/apparence';
import { FormulaireSondage, ReponsesParQuestion } from '../../../shared/formulaire/formulaire-sondage';
import { ReponseQuestionRequest } from '../../../shared/formulaire/reponses';
import { memoireRepondant } from './memoire-repondant';
import { DateLPipe } from '../../../core/i18n/formats.pipes';

/** Délai après la dernière saisie avant d'écrire le brouillon dans le navigateur. */
export const DELAI_BROUILLON_MS = 500;

/** Pourquoi le formulaire ne peut pas être rempli. */
export type RaisonIndisponible =
  | 'non-ouvert'
  | 'ferme'
  | 'deja-repondu'
  | 'introuvable'
  | 'trop-de-requetes'
  | 'injoignable'
  | 'inattendu';

type Etat =
  | { type: 'chargement' }
  | { type: 'accueil'; formulaire: FormulairePublicResponse }
  | { type: 'formulaire'; formulaire: FormulairePublicResponse }
  | { type: 'confirmation'; formulaire: FormulairePublicResponse; confirmation: ConfirmationReponseResponse }
  | { type: 'indisponible'; raison: RaisonIndisponible; message: string | null };

export const TITRES_INDISPONIBLE: Record<RaisonIndisponible, string> = {
  'non-ouvert': 'Ce sondage n’est pas encore ouvert',
  ferme: 'Ce sondage est fermé',
  'deja-repondu': 'Vous avez déjà répondu',
  introuvable: 'Lien introuvable',
  'trop-de-requetes': 'Trop de demandes',
  injoignable: 'Connexion impossible',
  inattendu: 'Le sondage ne peut pas être affiché',
};

/**
 * Refus de l'envoi faute de consentement. Code exact à confirmer dans l'OpenAPI (backend en cours) : tout code qui
 * parle de consentement, hors TEXTE_CONSENTEMENT_REQUIS (réglage de l'éditeur).
 */
export function estRefusConsentement(erreur: unknown): boolean {
  const code = codeErreur(erreur) ?? '';
  return code.includes('CONSENTEMENT') && code !== 'TEXTE_CONSENTEMENT_REQUIS';
}

/** Raison selon l'erreur du serveur (GET ou POST), ou null si elle ne rend pas le formulaire indisponible. */
export function raisonSelonErreur(erreur: unknown, lecture: boolean): RaisonIndisponible | null {
  switch (codeErreur(erreur)) {
    case 'SONDAGE_NON_OUVERT':
      return 'non-ouvert';
    case 'SONDAGE_FERME':
      return 'ferme';
    case 'DEJA_REPONDU':
      return 'deja-repondu';
    case 'SONDAGE_INTROUVABLE':
      return 'introuvable';
  }
  const statut = (erreur as { status?: number } | null)?.status;
  if (statut === 404) {
    return 'introuvable';
  }
  if (!lecture) {
    // À l'envoi, les autres erreurs (429, réseau...) gardent le formulaire et les réponses.
    return null;
  }
  if (statut === 429 || codeErreur(erreur) === 'TROP_DE_REQUETES') {
    return 'trop-de-requetes';
  }
  return statut === 0 ? 'injoignable' : 'inattendu';
}

/**
 * Formulaire public du répondant (/s/:jeton), sans compte et hors de la mise en page connectée. Mobile d'abord et
 * léger : composants partagés en éléments natifs, sans Angular Material. Le brouillon des réponses est gardé dans le
 * navigateur pendant la saisie et effacé après l'envoi. Page d'accueil d'abord (objet, confidentialité, consentement),
 * sautée si elle n'a rien à dire ; le consentement n'est jamais gardé : il est redonné à chaque visite.
 */
@Component({
  selector: 'app-formulaire-public',
  imports: [DateLPipe,  AccueilSondage, FormulaireSondage, BandeauApparence],
  templateUrl: './formulaire-public.html',
  styleUrl: './formulaire-public.scss',
})
export class FormulairePublic {
  private readonly service = inject(FormulairePublicService);
  private readonly titre = inject(Title);
  private readonly hote = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly titres = TITRES_INDISPONIBLE;

  /** Paramètre de route :jeton (le lien public, le même pour toutes les versions). */
  readonly jeton = input.required<string>();

  protected readonly etat = signal<Etat>({ type: 'chargement' });
  /** Apparence de l'entreprise, une fois le sondage lu (aucune avant : écrans de chargement et d'erreur Batulo). */
  protected readonly apparence = computed(() => {
    const e = this.etat();
    return 'formulaire' in e ? (e.formulaire.apparence ?? null) : null;
  });
  /** Couleur de l'entreprise (variables CSS), seulement si elle est valide et personnalisée. */
  protected readonly variablesApparence = computed(() => variablesApparence(this.apparence()));
  protected readonly envoiEnCours = signal(false);
  /** Erreur d'envoi qui garde le formulaire (429, réseau, inattendue). */
  protected readonly erreurEnvoi = signal<string | null>(null);
  protected readonly erreursServeur = signal<readonly ErreurQuestion[] | null>(null);
  /** Brouillon repris à l'ouverture (bandeau « Vos réponses en cours ont été reprises »). */
  protected readonly brouillonRepris = signal(false);
  protected readonly reponsesInitiales = signal<ReponsesParQuestion | null>(null);
  protected readonly sectionInitiale = signal(0);
  /** Brouillon à proposer sur la page d'accueil (« Reprendre »). */
  protected readonly reprise = signal<RepriseBrouillon | null>(null);
  /** Case cochée sur la page d'accueil, pour cette visite seulement (jamais dans le brouillon). */
  private consentementDonne = false;
  /** Refus du serveur à l'envoi faute de consentement : rappel sur la page d'accueil. */
  protected readonly erreurConsentement = signal<string | null>(null);

  private readonly formulaireSondage = viewChild(FormulaireSondage);
  private readonly saisies = new Subject<ReponsesParQuestion>();
  private derniereSaisie: ReponsesParQuestion = {};
  private sectionCourante = 0;

  constructor() {
    effect(() => {
      const jeton = this.jeton();
      untracked(() => this.charger(jeton));
    });
    this.saisies
      .pipe(debounceTime(DELAI_BROUILLON_MS), takeUntilDestroyed())
      .subscribe((reponses) => memoireRepondant.ecrireBrouillon(this.jeton(), this.sectionCourante, reponses));
  }

  protected charger(jeton = this.jeton()): void {
    this.etat.set({ type: 'chargement' });
    this.service
      // Le jeton de l'appareil, s'il existe déjà, permet au serveur de dire « déjà répondu » avant la saisie.
      .lire(jeton, memoireRepondant.jetonExistant(jeton))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (formulaire) => {
          if (formulaire.reponseUnique && formulaire.dejaRepondu) {
            memoireRepondant.marquerRepondu(jeton);
            memoireRepondant.effacerBrouillon(jeton);
            this.afficherIndisponible('deja-repondu', null);
            return;
          }
          // Le serveur fait foi : pas encore répondu (ou collecte terrain) -> le drapeau local est oublié.
          memoireRepondant.oublierRepondu(jeton);
          this.titre.setTitle(`${formulaire.titre} · Batulo`);
          const brouillon = memoireRepondant.lireBrouillon(jeton);
          this.reponsesInitiales.set(brouillon?.reponses ?? null);
          this.sectionInitiale.set(brouillon?.section ?? 0);
          this.sectionCourante = brouillon?.section ?? 0;
          this.derniereSaisie = brouillon?.reponses ?? {};
          this.erreurConsentement.set(null);
          this.consentementDonne = false;
          if (accueilNecessaire(formulaire)) {
            // Le brouillon est proposé sur la page d'accueil (« Reprendre » ou « Recommencer à zéro »).
            this.brouillonRepris.set(false);
            this.reprise.set(brouillon ? { section: brouillon.section, nombreSections: this.nombreSections(formulaire) } : null);
            this.etat.set({ type: 'accueil', formulaire });
            this.focaliserTitre();
            return;
          }
          this.brouillonRepris.set(!!brouillon);
          this.etat.set({ type: 'formulaire', formulaire });
        },
        error: (erreur: unknown) => {
          const raison = raisonSelonErreur(erreur, true) ?? 'inattendu';
          // Serveur injoignable mais envoi déjà fait depuis cet appareil : on le dit plutôt que « connexion impossible ».
          if (raison === 'injoignable' && memoireRepondant.dejaRepondu(jeton)) {
            this.afficherIndisponible('deja-repondu', null);
            return;
          }
          this.afficherIndisponible(raison, corpsErreur(erreur)?.message ?? null);
        },
      });
  }

  /** Page d'accueil -> questionnaire, en reprenant le brouillon ou à zéro (le brouillon est alors effacé). */
  protected commencer(formulaire: FormulairePublicResponse, depart: DepartQuestionnaire): void {
    this.consentementDonne = depart.consentement;
    this.erreurConsentement.set(null);
    if (!depart.reprendre) {
      memoireRepondant.effacerBrouillon(this.jeton());
      this.reponsesInitiales.set(null);
      this.sectionInitiale.set(0);
      this.sectionCourante = 0;
      this.derniereSaisie = {};
    }
    this.reprise.set(null);
    this.etat.set({ type: 'formulaire', formulaire });
  }

  protected surSaisie(reponses: ReponsesParQuestion): void {
    this.derniereSaisie = reponses;
    this.erreurEnvoi.set(null);
    this.saisies.next(reponses);
  }

  protected surSection(index: number): void {
    this.sectionCourante = index;
    memoireRepondant.ecrireBrouillon(this.jeton(), index, this.derniereSaisie);
  }

  /** « Tout effacer » : brouillon oublié, formulaire vide. */
  protected effacerBrouillon(): void {
    memoireRepondant.effacerBrouillon(this.jeton());
    this.brouillonRepris.set(false);
    this.derniereSaisie = {};
    this.sectionCourante = 0;
    this.formulaireSondage()?.recommencer();
  }

  protected envoyer(formulaire: FormulairePublicResponse, reponses: ReponseQuestionRequest[]): void {
    const jeton = this.jeton();
    this.envoiEnCours.set(true);
    this.erreurEnvoi.set(null);
    this.erreursServeur.set(null);
    this.service
      .repondre(jeton, {
        ...(formulaire.reponseUnique ? { jetonRepondant: memoireRepondant.jetonRepondant(jeton) } : {}),
        ...(formulaire.consentementRequis ? { consentement: this.consentementDonne } : {}),
        reponses,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (confirmation) => {
          this.envoiEnCours.set(false);
          memoireRepondant.effacerBrouillon(jeton);
          if (formulaire.reponseUnique) {
            memoireRepondant.marquerRepondu(jeton);
          }
          this.etat.set({ type: 'confirmation', formulaire, confirmation });
          this.focaliserTitre();
        },
        error: (erreur: unknown) => {
          this.envoiEnCours.set(false);
          if (codeErreur(erreur) === 'REPONSES_INVALIDES') {
            // Chaque refus sur sa question (nouveau tableau : l'effet du formulaire repasse).
            this.erreursServeur.set([...(corpsErreur(erreur)?.erreurs ?? [])]);
            return;
          }
          if (formulaire.consentementRequis && estRefusConsentement(erreur)) {
            // Réponses gardées : retour à la page d'accueil pour cocher la case, puis « Reprendre ».
            this.consentementDonne = false;
            this.reponsesInitiales.set(this.derniereSaisie);
            this.sectionInitiale.set(this.sectionCourante);
            this.reprise.set({ section: this.sectionCourante, nombreSections: this.nombreSections(formulaire) });
            this.erreurConsentement.set(messageErreur(erreur));
            this.etat.set({ type: 'accueil', formulaire });
            this.focaliserTitre();
            return;
          }
          const raison = raisonSelonErreur(erreur, false);
          if (raison) {
            if (raison === 'deja-repondu') {
              memoireRepondant.marquerRepondu(jeton);
            }
            if (raison !== 'non-ouvert') {
              memoireRepondant.effacerBrouillon(jeton);
            }
            this.afficherIndisponible(raison, corpsErreur(erreur)?.message ?? null);
            return;
          }
          this.erreurEnvoi.set(
            (erreur as { status?: number }).status === 0
              ? 'Vos réponses n’ont pas pu être envoyées : vérifiez votre connexion, puis réessayez. Elles sont gardées sur cet appareil.'
              : `${messageErreur(erreur)} Vos réponses sont gardées sur cet appareil.`,
          );
          this.focaliser('.erreur-envoi');
        },
      });
  }

  /** Collecte terrain : formulaire vide pour la personne suivante, qui donne son propre consentement. */
  protected nouvelleReponse(formulaire: FormulairePublicResponse): void {
    this.reponsesInitiales.set(null);
    this.sectionInitiale.set(0);
    this.sectionCourante = 0;
    this.derniereSaisie = {};
    this.brouillonRepris.set(false);
    this.consentementDonne = false;
    this.reprise.set(null);
    this.erreurConsentement.set(null);
    this.etat.set({ type: accueilNecessaire(formulaire) ? 'accueil' : 'formulaire', formulaire });
    this.focaliserTitre();
  }

  private nombreSections(formulaire: FormulairePublicResponse): number {
    return formulaire.sections.filter((s) => s.questions.length > 0).length;
  }

  private afficherIndisponible(raison: RaisonIndisponible, message: string | null): void {
    this.titre.setTitle(`${TITRES_INDISPONIBLE[raison]} · Batulo`);
    this.etat.set({ type: 'indisponible', raison, message });
    this.focaliserTitre();
  }

  private focaliserTitre(): void {
    this.focaliser('h1');
  }

  private focaliser(selecteur: string): void {
    afterNextRender(() => this.hote.nativeElement.querySelector<HTMLElement>(selecteur)?.focus(), {
      injector: this.injector,
    });
  }
}
