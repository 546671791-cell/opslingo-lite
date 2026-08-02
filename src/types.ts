export type Category = 'hotel' | 'flight';
export type Channel = 'email' | 'chat';
export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type ScenarioStatus = 'notStarted' | 'inProgress' | 'completed' | 'mastered';

export interface Objective {
  id: string;
  label: string;
  keywords: string[];
  required: boolean;
}

export interface ConversationNode {
  id: string;
  speaker: 'partner' | 'user';
  text: string;
  expectedIntent?: string;
  next: string[];
}

export interface Scenario {
  id: string;
  version: string;
  titleZh: string;
  titleEn: string;
  category: Category;
  channel: Channel;
  difficulty: Difficulty;
  duration: number;
  context: string;
  userRole: string;
  partnerRole: string;
  partnerMessage: string;
  translation: string;
  requiredObjectives: Objective[];
  optionalObjectives: Objective[];
  requiredEntities: string[];
  keywords: Record<string, string[]>;
  nodes: ConversationNode[];
  hints: string[];
  vocabulary: { term: string; meaning: string }[];
  phrases: { text: string; meaning: string }[];
  commonErrors: string[];
  reference: {
    subject?: string;
    body: string;
    dialogue?: { role: 'partner' | 'user'; text: string }[];
  };
  scoring: { politenessTerms: string[]; minWords: number; maxChatWords: number };
}

export interface ContentPack {
  id: string;
  version: string;
  minAppVersion: string;
  releasedAt: string;
  scenarios: Scenario[];
}

export interface CatalogPack {
  id: string;
  version: string;
  minAppVersion: string;
  path: string;
  sha256: string;
  scenarioCount: number;
  releasedAt: string;
  changelog: string[];
}

export interface Catalog {
  catalogVersion: number;
  releasedAt: string;
  packs: CatalogPack[];
}

export interface Score {
  total: number;
  objectiveRate: number;
  completeness: number;
  clarity: number;
  politeness: number;
  grammar: number;
  format: number;
  missingObjectives: string[];
  missingEntities: string[];
  corrections: Correction[];
}

export interface Correction {
  original: string;
  suggestion: string;
  explanation: string;
  severity: 'info' | 'warning';
  ruleId: string;
}

export interface PracticeSession {
  id: string;
  scenarioId: string;
  packVersion: string;
  channel: Channel;
  startedAt: string;
  completedAt: string;
  activeSeconds: number;
  score: Score;
  usedHint: boolean;
  response: string;
  dateKey: string;
}

export interface VocabularyItem {
  id: string;
  text: string;
  meaning: string;
  sourceScenarioId?: string;
  tags: string[];
  favorite: boolean;
  mastered: boolean;
  nextReview: string;
  createdAt: string;
}

export interface Draft {
  id: string;
  scenarioId: string;
  subject: string;
  body: string;
  updatedAt: string;
}
