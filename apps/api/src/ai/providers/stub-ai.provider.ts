import { Injectable } from '@nestjs/common';
import { LeadSource, LeadTemperature } from '@prisma/client';
import {
  AiProvider,
  FollowUpSuggestion,
  LeadScoreResult,
  LeadScoringContext,
  LeadSummaryContext,
} from './ai-provider.interface';

const SOURCE_BASE_SCORE: Record<LeadSource, number> = {
  REFERRAL: 70,
  WHATSAPP: 60,
  WEBSITE_FORM: 55,
  META_ADS: 50,
  GOOGLE_ADS: 50,
  INDIAMART: 50,
  JUSTDIAL: 45,
  MANUAL: 40,
  IMPORT: 30,
};

const DAY_MS = 24 * 60 * 60 * 1000;

function temperatureForScore(score: number): LeadTemperature {
  if (score >= 70) return LeadTemperature.HOT;
  if (score >= 40) return LeadTemperature.WARM;
  return LeadTemperature.COLD;
}

/**
 * Deterministic, rule-based scoring/summary/suggestion logic — no API key required.
 * The default until a PlatformAdmin activates a real provider (see AiProviderResolver);
 * also the automatic fallback if the configured provider's key is missing or a call fails.
 * Mirrors the WhatsApp stub/real provider split from Sprint 4 (see StubWhatsAppProvider).
 */
@Injectable()
export class StubAiProvider implements AiProvider {
  scoreLead(context: LeadScoringContext): Promise<LeadScoreResult> {
    const reasons: string[] = [];
    let score = SOURCE_BASE_SCORE[context.source];
    reasons.push(
      `Base score for a ${context.source.toLowerCase().replace('_', ' ')} lead: ${score}.`,
    );

    if (context.inboundMessageCount > 0) {
      const bonus = Math.min(context.inboundMessageCount * 5, 20);
      score += bonus;
      reasons.push(
        `+${bonus} for ${context.inboundMessageCount} inbound WhatsApp message(s).`,
      );
    }

    if (context.lastInboundAt) {
      const ageMs = Date.now() - context.lastInboundAt.getTime();
      if (ageMs < DAY_MS) {
        score += 15;
        reasons.push('+15 for a reply within the last 24 hours.');
      } else if (ageMs < 7 * DAY_MS) {
        score += 5;
        reasons.push('+5 for a reply within the last 7 days.');
      }
    } else if (
      context.inboundMessageCount === 0 &&
      Date.now() - context.createdAt.getTime() > 7 * DAY_MS
    ) {
      score -= 10;
      reasons.push('-10 for no engagement in over 7 days.');
    }

    if (context.tasksOverdue > 0) {
      const penalty = Math.min(context.tasksOverdue, 3) * 5;
      score -= penalty;
      reasons.push(
        `-${penalty} for ${context.tasksOverdue} overdue follow-up(s).`,
      );
    }

    if (context.tasksCompleted > 0) {
      score += 5;
      reasons.push('+5 for a history of completed follow-ups.');
    }

    score = Math.max(0, Math.min(100, Math.round(score)));
    const suggestedTemperature = temperatureForScore(score);
    reasons.push(`Total: ${score} → ${suggestedTemperature}.`);

    return Promise.resolve({
      score,
      suggestedTemperature,
      reasoning: reasons.join(' '),
    });
  }

  summarizeLead(context: LeadSummaryContext): Promise<string> {
    const parts: string[] = [];
    const who = context.companyName
      ? `${context.name} (${context.companyName})`
      : context.name;
    parts.push(
      `${who} came in via ${context.source.toLowerCase().replace('_', ' ')} on ${context.createdAt.toLocaleDateString('en-IN')}.`,
    );
    parts.push(
      `Currently ${context.status.toLowerCase().replace('_', ' ')}, marked ${context.currentTemperature}.`,
    );

    if (context.recentMessages.length === 0) {
      parts.push('No WhatsApp conversation yet.');
    } else {
      const last = context.recentMessages[context.recentMessages.length - 1];
      parts.push(
        `${context.inboundMessageCount} inbound / ${context.outboundMessageCount} outbound message(s) exchanged, most recently ${last.direction === 'INBOUND' ? 'from them' : 'from us'} on ${last.createdAt.toLocaleDateString('en-IN')}.`,
      );
    }

    if (context.tasks.length === 0) {
      parts.push('No follow-ups scheduled.');
    } else {
      parts.push(
        `${context.tasksPending} pending follow-up(s)${context.tasksOverdue > 0 ? `, ${context.tasksOverdue} overdue` : ''}, ${context.tasksCompleted} completed.`,
      );
    }

    return Promise.resolve(parts.join(' '));
  }

  suggestFollowUp(context: LeadSummaryContext): Promise<FollowUpSuggestion> {
    const lastMessage =
      context.recentMessages[context.recentMessages.length - 1];
    const unanswered = lastMessage?.direction === 'INBOUND';

    if (unanswered) {
      return Promise.resolve({
        title: `Reply to ${context.name}'s message`,
        suggestedDueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        reasoning: "Their last WhatsApp message hasn't been answered yet.",
      });
    }

    if (context.tasksPending === 0) {
      const dueInDays =
        context.currentTemperature === LeadTemperature.HOT ? 1 : 2;
      return Promise.resolve({
        title: `Follow up with ${context.name}`,
        suggestedDueAt: new Date(Date.now() + dueInDays * DAY_MS).toISOString(),
        reasoning: 'No follow-up is currently scheduled for this lead.',
      });
    }

    return Promise.resolve({
      title: `Check in with ${context.name}`,
      suggestedDueAt: new Date(Date.now() + 3 * DAY_MS).toISOString(),
      reasoning:
        'Keep the conversation warm alongside their existing follow-up(s).',
    });
  }

  suggestReplies(): Promise<string[]> {
    return Promise.resolve([
      "Thanks for reaching out! Could you share a bit more about what you're looking for?",
      'Sure — let me put together a quotation and send it your way shortly.',
      'Would you be available for a quick call to discuss this further?',
    ]);
  }
}
