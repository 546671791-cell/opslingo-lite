import type {
  Correction,
  Objective,
  PracticeSession,
  Scenario,
  ScenarioStatus,
  Score
} from './types';

export const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[.,!?;:()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const distance = (a: string, b: string): number => {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const temp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = temp;
    }
  }
  return row[b.length];
};
const matches = (text: string, term: string) => {
  const clean = normalize(text);
  const target = normalize(term);
  return (
    clean.includes(target) ||
    clean.split(' ').some((word) => target.length > 4 && distance(word, target) <= 1)
  );
};

export interface EntityMatch {
  type: string;
  value: string;
  confidence: number;
}
export class EntityExtractor {
  static extract(input: string): EntityMatch[] {
    const checks: [string, RegExp][] = [
      ['bookingId', /\b(?:booking|ref(?:erence)?)[#:\s-]*([A-Z0-9]{5,})\b/gi],
      ['hotelConfirmation', /\b(?:confirmation|conf)[#:\s-]*([A-Z0-9]{5,})\b/gi],
      ['flightNumber', /\b[A-Z]{2}\s?\d{1,4}\b/g],
      ['ticketNumber', /\b\d{13}\b/g],
      [
        'date',
        /\b(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*)\b/gi
      ],
      ['time', /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/g],
      ['amount', /(?:USD|EUR|CNY|RMB|\$|€|¥)\s?\d+(?:\.\d{1,2})?/gi],
      ['email', /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g],
      ['phone', /\+?\d[\d\s-]{6,}\d/g],
      ['placeholder', /\[[A-Z_]+\]/g]
    ];
    return checks.flatMap(([type, re]) =>
      [...input.matchAll(re)].map((m) => ({ type, value: m[0], confidence: 0.95 }))
    );
  }
}
const intents: Record<string, string[]> = {
  'request confirmation': ['confirm', 'verify', 'check', 'written confirmation'],
  'provide information': ['booking', 'reference', 'ticket', 'attached'],
  'request modification': ['change', 'modify', 'update'],
  'request cancellation': ['cancel', 'cancellation'],
  'request refund': ['refund', 'reimburse'],
  'query progress': ['status', 'progress', 'update'],
  'request recheck': ['check again', 'review again'],
  urgent: ['urgent', 'as soon as possible', 'immediately'],
  'request written confirmation': [
    'written confirmation',
    'confirm in writing',
    'email confirmation'
  ],
  agree: ['agree', 'accept', 'proceed'],
  refuse: ['do not agree', 'cannot accept', 'decline'],
  'request clarification': ['clarify', 'could you explain', 'what do you mean'],
  apology: ['sorry', 'apologise', 'apologize'],
  complaint: ['complaint', 'unacceptable', 'issue'],
  escalation: ['supervisor', 'manager', 'escalate']
};
export class IntentMatcher {
  static match(input: string) {
    const evidence = Object.entries(intents).flatMap(([intent, terms]) =>
      terms.filter((term) => matches(input, term)).map((term) => ({ intent, term }))
    );
    const grouped = evidence.reduce<Record<string, string[]>>((acc, hit) => {
      (acc[hit.intent] ??= []).push(hit.term);
      return acc;
    }, {});
    return Object.entries(grouped)
      .map(([intent, terms]) => ({
        intent,
        confidence: Math.min(0.95, 0.45 + terms.length * 0.2),
        evidence: terms
      }))
      .sort((a, b) => b.confidence - a.confidence);
  }
}
export class LocalCorrectionEngine {
  static check(
    input: string,
    channel: 'email' | 'chat',
    category: 'hotel' | 'flight'
  ): Correction[] {
    const rules: [RegExp, string, string, string][] = [
      [/\breply me\b/i, 'reply to us', 'reply 后需使用 to。', 'reply-to'],
      [
        /\bwait your reply\b/i,
        'look forward to your reply',
        '商务邮件中用 look forward to 更自然。',
        'wait-reply'
      ],
      [
        /please check it again/i,
        'could you please review this again',
        '可用更礼貌的请求句式。',
        'natural-recheck'
      ],
      [
        /\bcustomer\b/i,
        category === 'hotel' ? 'guest' : 'passenger',
        `${category === 'hotel' ? '酒店' : '航班'}场景中该称呼更准确。`,
        'role-term'
      ],
      [/!!+/, '.', '连续感叹号不适合商务沟通。', 'exclamation'],
      [/\b(?:pls|thx|u)\b/i, 'please / thank you / you', '避免不专业缩写。', 'abbreviation']
    ];
    const output: Correction[] = rules
      .filter(([pattern]) => pattern.test(input))
      .map(([pattern, suggestion, explanation, ruleId]) => ({
        original: input.match(pattern)?.[0] ?? '',
        suggestion,
        explanation,
        severity: 'warning' as const,
        ruleId
      }));
    if (!/\b(please|could you|would you|thank you)\b/i.test(input))
      output.push({
        original: '',
        suggestion: '加入 please、could you 或 thank you',
        explanation: '礼貌表达不足。',
        severity: 'info',
        ruleId: 'politeness'
      });
    if (channel === 'email' && !/\b(dear|hello|hi)\b/i.test(input))
      output.push({
        original: '',
        suggestion: '以 Dear … 或 Hello … 开头',
        explanation: '邮件缺少称呼。',
        severity: 'warning',
        ruleId: 'email-greeting'
      });
    if (channel === 'email' && !/\b(regards|thank you|sincerely)\b/i.test(input))
      output.push({
        original: '',
        suggestion: '加入 Best regards 或 Thank you',
        explanation: '邮件缺少商务结尾。',
        severity: 'warning',
        ruleId: 'email-closing'
      });
    if (channel === 'chat' && input.trim().split(/\s+/).length > 80)
      output.push({
        original: '',
        suggestion: '将聊天回复精简为 1–3 句',
        explanation: '即时聊天应简洁。',
        severity: 'info',
        ruleId: 'chat-length'
      });
    if (input.length > 8 && input === input.toUpperCase())
      output.push({
        original: input,
        suggestion: '使用正常大小写',
        explanation: '全大写容易显得强硬。',
        severity: 'warning',
        ruleId: 'all-caps'
      });
    return output;
  }
}
export class ObjectiveTracker {
  static met(text: string, objectives: Objective[]) {
    return objectives
      .filter((objective) => objective.keywords.some((term) => matches(text, term)))
      .map((objective) => objective.id);
  }
}
export function scoreResponse(scenario: Scenario, response: string): Score {
  const required = scenario.requiredObjectives;
  const met = ObjectiveTracker.met(response, required);
  const entities = EntityExtractor.extract(response);
  const entityTypes = new Set(entities.map((entity) => entity.type));
  const objectiveRate = required.length ? met.length / required.length : 1;
  const missingObjectives = required
    .filter((item) => !met.includes(item.id))
    .map((item) => item.label);
  const missingEntities = scenario.requiredEntities.filter((item) => !entityTypes.has(item));
  const corrections = LocalCorrectionEngine.check(response, scenario.channel, scenario.category);
  const words = normalize(response).split(' ').filter(Boolean).length;
  const completeness = Math.max(
    0,
    Math.min(
      1,
      objectiveRate * 0.7 +
        ((scenario.requiredEntities.length - missingEntities.length) /
          Math.max(1, scenario.requiredEntities.length)) *
          0.3
    )
  );
  const clarity =
    words >= scenario.scoring.minWords ? 1 : Math.max(0.3, words / scenario.scoring.minWords);
  const polite = scenario.scoring.politenessTerms.some((term) => matches(response, term));
  const politeness = polite ? 1 : 0.4;
  const grammar = Math.max(
    0,
    1 - corrections.filter((item) => item.severity === 'warning').length * 0.13
  );
  const format =
    scenario.channel === 'email'
      ? corrections.some(
          (item) => item.ruleId === 'email-greeting' || item.ruleId === 'email-closing'
        )
        ? 0.4
        : 1
      : words <= scenario.scoring.maxChatWords
        ? 1
        : 0.6;
  return {
    total: Math.round(
      objectiveRate * 30 +
        completeness * 25 +
        clarity * 15 +
        politeness * 15 +
        grammar * 10 +
        format * 5
    ),
    objectiveRate: Math.round(objectiveRate * 100),
    completeness: Math.round(completeness * 100),
    clarity: Math.round(clarity * 100),
    politeness: Math.round(politeness * 100),
    grammar: Math.round(grammar * 100),
    format: Math.round(format * 100),
    missingObjectives,
    missingEntities,
    corrections
  };
}
export function localDate(value: string | Date) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function statusFor(sessions: PracticeSession[]): ScenarioStatus {
  if (!sessions.length) return 'notStarted';
  const sorted = [...sessions].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
  const completed = sessions.filter((s) => s.score.total >= 70 && s.score.objectiveRate >= 80);
  const last = sorted[0];
  const days = new Set(completed.map((s) => s.dateKey));
  return days.size >= 2 &&
    last.score.total >= 85 &&
    last.score.objectiveRate === 100 &&
    last.score.completeness >= 90
    ? 'mastered'
    : completed.length
      ? 'completed'
      : 'inProgress';
}
export function overallCompletion(statuses: ScenarioStatus[]) {
  const values: Record<ScenarioStatus, number> = {
    notStarted: 0,
    inProgress: 0.25,
    completed: 0.75,
    mastered: 1
  };
  return statuses.length
    ? Math.round(
        (statuses.reduce((sum, status) => sum + values[status], 0) / statuses.length) * 100
      )
    : 0;
}
export function streak(sessions: PracticeSession[], today = localDate(new Date())) {
  const days = [...new Set(sessions.filter((s) => s.activeSeconds >= 10).map((s) => s.dateKey))]
    .sort()
    .reverse();
  let cursor = today;
  let result = 0;
  for (const day of days) {
    if (day === cursor) {
      result += 1;
      const d = new Date(`${cursor}T12:00:00`);
      d.setDate(d.getDate() - 1);
      cursor = localDate(d);
    } else if (day < cursor) break;
  }
  return result;
}
export function effectiveSeconds(started: string, completed: string, activeSeconds: number) {
  const elapsed = Math.max(0, (new Date(completed).getTime() - new Date(started).getTime()) / 1000);
  return Math.min(1800, Math.max(10, Math.min(elapsed, activeSeconds)));
}
export class ConversationEngine {
  constructor(private readonly scenario: Scenario) {}
  reply(input: string) {
    const intents = IntentMatcher.match(input);
    const entities = EntityExtractor.extract(input);
    const needsClarification = !intents.length && !entities.length;
    return {
      intents,
      entities,
      needsClarification,
      nextPartnerMessage: needsClarification
        ? 'Could you please clarify the booking reference or the action you need?'
        : 'Thank you. We are checking this and will send written confirmation shortly.'
    };
  }
  get reference() {
    return this.scenario.reference.dialogue ?? [];
  }
}
