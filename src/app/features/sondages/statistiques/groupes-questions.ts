import { QuestionStat } from '../../../core/models/statistiques.model';

/** Questions d'une même section, dans l'ordre. */
export interface GroupeQuestions {
  section: string;
  questions: { question: QuestionStat; numero: number }[];
}

export function grouperParSection(questions: QuestionStat[]): GroupeQuestions[] {
  const groupes: GroupeQuestions[] = [];
  questions.forEach((question, index) => {
    let groupe = groupes[groupes.length - 1];
    if (!groupe || groupe.section !== question.section) {
      groupe = { section: question.section, questions: [] };
      groupes.push(groupe);
    }
    groupe.questions.push({ question, numero: index + 1 });
  });
  return groupes;
}
