import { LeadSource, LeadStatus, LeadTemperature } from '@prisma/client';

export interface LeadScoringContext {
  name: string;
  companyName: string | null;
  source: LeadSource;
  status: LeadStatus;
  currentTemperature: LeadTemperature;
  createdAt: Date;
  inboundMessageCount: number;
  outboundMessageCount: number;
  lastInboundAt: Date | null;
  tasksPending: number;
  tasksOverdue: number;
  tasksCompleted: number;
}

export interface LeadScoreResult {
  /** 0-100. The caller clamps/rounds — a provider need not guarantee exact bounds. */
  score: number;
  suggestedTemperature: LeadTemperature;
  /** Short plain-English explanation shown to the salesperson (PRD §27: "suggestions, not decisions"). */
  reasoning: string;
}

export interface LeadSummaryContext extends LeadScoringContext {
  phone: string;
  recentMessages: {
    direction: 'INBOUND' | 'OUTBOUND';
    body: string;
    createdAt: Date;
  }[];
  tasks: { title: string; status: string; dueAt: Date }[];
}

export interface FollowUpSuggestion {
  title: string;
  notes?: string;
  /** ISO 8601 timestamp. */
  suggestedDueAt: string;
  reasoning: string;
}

export interface ReplySuggestionContext {
  recentMessages: { direction: 'INBOUND' | 'OUTBOUND'; body: string }[];
}

export interface AiProvider {
  scoreLead(context: LeadScoringContext): Promise<LeadScoreResult>;
  summarizeLead(context: LeadSummaryContext): Promise<string>;
  suggestFollowUp(context: LeadSummaryContext): Promise<FollowUpSuggestion>;
  /** Returns 2-3 short suggested reply texts for the salesperson to pick from and edit. */
  suggestReplies(context: ReplySuggestionContext): Promise<string[]>;
}

export const AI_PROVIDER = Symbol('AI_PROVIDER');
