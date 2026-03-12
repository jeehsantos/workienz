export interface AIApplicant {
  id: string;
  status: string;
  cover_letter: string | null;
  created_at: string;
  ai_score: number | null;
  ai_scoring_status: string;
  ai_reason_summary: string | null;
  ai_score_updated_at: string | null;
  ai_model: string | null;
  ai_prompt_version: string | null;
  application_answers: Record<string, string> | null;
  employee: {
    id: string;
    user_id: string;
    headline: string | null;
    city: string | null;
    experience_years: number | null;
    skills: string[] | null;
    availability: string | null;
    bio: string | null;
    industry: string | null;
    languages: string[] | null;
    visa_status: string | null;
  };
  profile: {
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  } | null;
  conversation_id: string | null;
  top_rank: number | null;
}

export interface QuestionnaireQuestion {
  id: string;
  type: "yes_no" | "single_select" | "short_text";
  prompt: string;
  options?: { value: string; label: string }[];
}

export interface Questionnaire {
  version: string;
  questions: QuestionnaireQuestion[];
}

export type ApplicantTab = "top10" | "all" | "shortlisted" | "hired" | "approved_to_pool" | "rejected";
