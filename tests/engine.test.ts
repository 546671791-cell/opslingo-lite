import { describe, expect, it } from 'vitest';
import {
  ConversationEngine,
  EntityExtractor,
  IntentMatcher,
  LocalCorrectionEngine,
  ObjectiveTracker,
  effectiveSeconds,
  localDate,
  overallCompletion,
  scoreResponse,
  statusFor,
  streak
} from '../src/engine';
import type { PracticeSession, Scenario } from '../src/types';

const scenario: Scenario = {
  id: 'hotel-email-01',
  version: '1.0.0',
  titleZh: '测试',
  titleEn: 'Test',
  category: 'hotel',
  channel: 'email',
  difficulty: 'beginner',
  duration: 5,
  context: 'x',
  userRole: 'x',
  partnerRole: 'x',
  partnerMessage: 'x',
  translation: 'x',
  requiredObjectives: [
    { id: 'request', label: '请求', keywords: ['could you'], required: true },
    { id: 'identify', label: '订单', keywords: ['booking'], required: true },
    { id: 'confirm', label: '确认', keywords: ['confirm'], required: true }
  ],
  optionalObjectives: [],
  requiredEntities: ['bookingId'],
  keywords: {},
  nodes: [
    { id: '1', speaker: 'partner', text: 'x', next: [] },
    { id: '2', speaker: 'user', text: 'x', next: [] },
    { id: '3', speaker: 'partner', text: 'x', next: [] },
    { id: '4', speaker: 'user', text: 'x', next: [] },
    { id: '5', speaker: 'partner', text: 'x', next: [] }
  ],
  hints: ['x'],
  vocabulary: [],
  phrases: [],
  commonErrors: [],
  reference: { body: 'Dear team\nCould you please confirm booking reference ABCDE?\nBest regards' },
  scoring: { politenessTerms: ['please', 'could you'], minWords: 5, maxChatWords: 80 }
};
const session = (dateKey: string, score = 90): PracticeSession => ({
  id: `${dateKey}-${score}`,
  scenarioId: scenario.id,
  packVersion: '1.0.0',
  channel: 'email',
  startedAt: `${dateKey}T10:00:00`,
  completedAt: `${dateKey}T10:02:00`,
  activeSeconds: 120,
  response: 'x',
  usedHint: false,
  dateKey,
  score: {
    total: score,
    objectiveRate: 100,
    completeness: 100,
    clarity: 100,
    politeness: 100,
    grammar: 100,
    format: 100,
    missingObjectives: [],
    missingEntities: [],
    corrections: []
  }
});
describe('local rules engine', () => {
  it('extracts travel entities', () => {
    const found = EntityExtractor.extract(
      'Booking ABCDE, flight BA 123, ticket 1234567890123, USD 88.00'
    );
    expect(found.map((x) => x.type)).toEqual(
      expect.arrayContaining(['bookingId', 'flightNumber', 'ticketNumber', 'amount'])
    );
  });
  it('matches normalized intents with evidence', () => {
    expect(
      IntentMatcher.match('Could you please check again and confirm in writing?')[0]
    ).toMatchObject({ intent: 'request confirmation' });
  });
  it('finds corrections deterministically', () => {
    expect(
      LocalCorrectionEngine.check('REPLY ME!!', 'email', 'hotel').map((x) => x.ruleId)
    ).toContain('reply-to');
  });
  it('tracks objectives and scores a complete email', () => {
    expect(
      ObjectiveTracker.met('Could you please confirm booking ABCDE?', scenario.requiredObjectives)
    ).toHaveLength(3);
    const result = scoreResponse(
      scenario,
      'Dear team, could you please confirm booking ABCDE? Thank you. Best regards'
    );
    expect(result.total).toBeGreaterThanOrEqual(70);
    expect(result.objectiveRate).toBe(100);
  });
  it('calculates completion and mastery on different dates', () => {
    expect(statusFor([])).toBe('notStarted');
    expect(statusFor([session('2026-08-01', 60)])).toBe('inProgress');
    expect(statusFor([session('2026-08-01', 80)])).toBe('completed');
    expect(statusFor([session('2026-08-01'), session('2026-08-02')])).toBe('mastered');
    expect(overallCompletion(['notStarted', 'inProgress', 'completed', 'mastered'])).toBe(50);
  });
  it('uses local-day streak and bounded active duration', () => {
    const today = localDate(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(streak([session(today), session(localDate(yesterday))], today)).toBe(2);
    expect(effectiveSeconds('2026-08-01T10:00:00Z', '2026-08-01T12:00:00Z', 9000)).toBe(1800);
  });
  it('asks for clarification on low-confidence conversation', () => {
    const engine = new ConversationEngine(scenario);
    const reply = engine.reply('banana');
    expect(reply.needsClarification).toBe(true);
    expect(reply.nextPartnerMeaning).toContain('订单编号');
  });
});
