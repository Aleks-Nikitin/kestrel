import { AnalysisRequest } from "@/lib/contracts";
import type { AnalysisRequestDTO, ComparisonRequestDTO } from "@/lib/contracts";

export type AnalysisAction = AnalysisRequestDTO["action"];

/** User-facing actions. `suggest_uses` is a contract action with no S14 control. */
export const ACTIONS: { id: AnalysisAction; label: string; hint: string }[] = [
  { id: "analyze", label: "Analyze", hint: "Full analysis of the baseline and alternatives" },
  { id: "compare", label: "Compare", hint: "Rank the scenarios against each other" },
  { id: "risks", label: "Risks", hint: "What could undermine the preferred scenario" },
  { id: "explain", label: "Explain", hint: "Explain the result, optionally answering your question" },
  { id: "summary", label: "Summary", hint: "A concise investment summary" },
];

export const ACTION_LABEL: Record<AnalysisAction, string> = {
  analyze: "Analyze",
  compare: "Compare",
  risks: "Risks",
  explain: "Explain",
  summary: "Summary",
  suggest_uses: "Suggest uses",
};

export const QUESTION_MAX = 2000;

/** Wraps the editor's validated request; decimals and provenance pass through untouched. */
export function buildAnalysisRequest(
  request: ComparisonRequestDTO,
  action: AnalysisAction,
  question: string,
): AnalysisRequestDTO {
  const q = question.trim();
  return { ...request, action, ...(q ? { question: q } : {}) };
}

/** Why an action cannot be sent right now, or null when it can. */
export function actionBlock(
  request: ComparisonRequestDTO | null,
  problems: number,
  action: AnalysisAction,
  question: string,
): string | null {
  if (!request)
    return problems > 0
      ? `Fix ${problems} ${problems === 1 ? "problem" : "problems"} in the scenario editor first.`
      : "The scenario inputs are not ready to send.";
  if (question.trim().length > QUESTION_MAX)
    return `Keep the question under ${QUESTION_MAX} characters.`;
  const r = AnalysisRequest.safeParse(buildAnalysisRequest(request, action, question));
  return r.success ? null : (r.error.issues[0]?.message ?? "The request is not valid.");
}
