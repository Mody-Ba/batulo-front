import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { ReponseResponse } from '../../../core/models/statistiques.model';
import { QuestionResponse, SondageResponse } from '../../../core/models/sondage.model';
import { formaterReponse, ReponseMiseEnForme } from './formater-reponse';
import { DateLPipe } from '../../../core/i18n/formats.pipes';
import { TranslocoPipe } from '@jsverse/transloco';

export interface DonneesDialogueReponse {
  reponse: ReponseResponse;
  /** Contenu de la version qui a reçu la réponse : ordre des questions et libellés des options. */
  sondage: SondageResponse;
}

interface LigneDetail {
  numero: number;
  libelle: string;
  section: string | null;
  valeur: ReponseMiseEnForme | null;
}

/** Détail d'une réponse, question par question, dans l'ordre du sondage ; « Sans réponse » si la question est vide. */
@Component({
  selector: 'app-dialogue-reponse',
  imports: [TranslocoPipe, DateLPipe,  MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ 'sondages.reponse.titre' | transloco: { id: donnees.reponse.id } }}</h2>
    <mat-dialog-content>
      <p class="texte-aide">
        {{ 'sondages.reponse.envoyee' | transloco: { date: (donnees.reponse.dateSoumission | dateL: 'longHeure'), version: donnees.reponse.version } }}
      </p>
      <dl class="detail">
        @for (ligne of lignes; track ligne.numero) {
          @if (ligne.section) {
            <h3 class="section" dir="auto">{{ ligne.section }}</h3>
          }
          <div class="question">
            <dt>{{ ligne.numero }}. <span dir="auto">{{ ligne.libelle }}</span></dt>
            <dd>
              @if (ligne.valeur; as v) {
                @if (v.liste) {
                  <ol>
                    @for (element of v.liste; track $index) {
                      <li dir="auto">{{ element }}</li>
                    }
                  </ol>
                } @else if (v.paires) {
                  <table class="paires">
                    <caption class="visuellement-cache">{{ 'sondages.reponse.parLigne' | transloco }}</caption>
                    <tbody>
                      @for (paire of v.paires; track paire[0]) {
                        <tr>
                          <th scope="row" dir="auto">{{ paire[0] }}</th>
                          <td dir="auto">{{ paire[1] }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                } @else {
                  <span class="texte" dir="auto">{{ v.texte }}</span>
                }
              } @else {
                <span class="sans-reponse">{{ 'sondages.reponse.sansReponse' | transloco }}</span>
              }
            </dd>
          </div>
        }
      </dl>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton="filled" type="button" mat-dialog-close cdkFocusInitial>{{ 'commun.fermer' | transloco }}</button>
    </mat-dialog-actions>
  `,
  styles: `
    .detail {
      margin: 0;
    }

    .section {
      margin: var(--bt-espace-4) 0 var(--bt-espace-2);
      color: var(--mat-sys-on-surface-variant);
      font: var(--mat-sys-label-large);
      text-transform: uppercase;
    }

    .question {
      padding: var(--bt-espace-2) 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }

    dt {
      font: var(--mat-sys-title-small);
    }

    dd {
      margin: var(--bt-espace-1) 0 0;
      overflow-wrap: anywhere;
    }

    .texte {
      white-space: pre-line;
    }

    .sans-reponse {
      color: var(--mat-sys-on-surface-variant);
      font-style: italic;
    }

    ol {
      margin: 0;
      padding-inline-start: var(--bt-espace-6);
    }

    .paires th {
      padding-inline-end: var(--bt-espace-4);
      font-weight: 500;
      text-align: start;
    }
  `,
})
export class DialogueReponse {
  protected readonly donnees = inject<DonneesDialogueReponse>(MAT_DIALOG_DATA);
  protected readonly lignes = this.construire();

  /**
   * Questions du sondage dans l'ordre (titre de section à la première de chaque section), puis les valeurs de
   * questions qui n'y sont plus (autre version), avec leur libellé enregistré.
   */
  private construire(): LigneDetail[] {
    const valeurs = new Map(this.donnees.reponse.valeurs.map((v) => [v.questionId, v]));
    const lignes: LigneDetail[] = [];
    let numero = 0;
    for (const section of this.donnees.sondage.sections) {
      section.questions.forEach((question: QuestionResponse, index) => {
        const valeur = valeurs.get(question.id);
        valeurs.delete(question.id);
        lignes.push({
          numero: ++numero,
          libelle: question.libelle,
          section: index === 0 ? section.titre : null,
          valeur: valeur ? formaterReponse(question.type, valeur.valeur, question) : null,
        });
      });
    }
    for (const autre of valeurs.values()) {
      lignes.push({
        numero: ++numero,
        libelle: autre.libelle,
        section: null,
        valeur: formaterReponse(autre.type, autre.valeur),
      });
    }
    return lignes;
  }
}
