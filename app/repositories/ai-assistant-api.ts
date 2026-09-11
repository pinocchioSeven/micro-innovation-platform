export type AssistantIntent = 'search_adopted_ideas' | 'search_my_ideas' | 'create_or_refine_idea' | 'general_knowledge' | 'out_of_scope';

export type AssistantIdea = {
  id: string;
  title: string;
  status: string;
  created_at: string;
  latest_feedback?: string | null;
  latest_feedback_at?: string | null;
};

export type AssistantNavigation = {
  page: string;
  filter?: string | null;
  idea_id?: string | null;
  label: string;
};

export type AssistantIdeaForm = {
  title?: string | null;
  description?: string | null;
  plan?: string | null;
  phase: 'extracting' | 'collecting' | 'refining' | 'awaiting_confirmation' | 'submitting' | 'submitted' | 'cancelled';
};

export type AssistantResponse = {
  intent: AssistantIntent;
  phase: string;
  message: string;
  idea_form?: AssistantIdeaForm | null;
  my_ideas: AssistantIdea[];
  search_results: Array<Record<string, unknown>>;
  navigation?: AssistantNavigation | null;
  requires_confirmation: boolean;
  submitted_idea_id?: string | null;
};

const AI_API = process.env.NEXT_PUBLIC_AI_SERVICE_URL || 'http://127.0.0.1:8000';

export async function chatWithAssistant(userId: string, message: string, ideaForm?: AssistantIdeaForm | null, recentMessages: Array<{ role: 'user' | 'assistant'; content: string }> = []): Promise<AssistantResponse> {
  const response = await fetch(`${AI_API}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
    body: JSON.stringify({ message, idea_form: ideaForm || null, recent_messages: recentMessages.slice(-12) }),
  });
  const data = await response.json() as AssistantResponse & { detail?: string };
  if (!response.ok) throw new Error(data.detail || 'AI 助理暂时无法响应');
  return data;
}
