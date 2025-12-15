export enum AgentType {
  ASSESSMENT = 'Assessment Agent',
  ADAPTATION = 'Adaptation Agent',
  CURATOR = 'Content Curator Agent',
  LANGUAGE = 'Language Bridge Agent',
  SAFETY = 'Safety Agent',
  SYSTEM = 'System'
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model'
}

export interface AgentLog {
  id: string;
  timestamp: number;
  agent: AgentType;
  action: string;
  details: string;
  status: 'pending' | 'success' | 'warning' | 'error';
}

export interface QuizQuestion {
  id: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  topic: string;
}

export interface LearningMaterial {
  title: string;
  content: string; // Markdown supported
  readingLevel: string;
  sourceAttribution: string; // e.g. "Punjab Curriculum Grade 9"
  languageMode: 'english' | 'urdu_mix';
}

export interface LearningSession {
  topic: string;
  courseName: string; // New field
  gradeLevel: string;
  masteryScore: number; // 0-100
  history: Array<{
    type: 'quiz' | 'content';
    data: QuizQuestion | LearningMaterial;
    userResponse?: number; // for quiz
    isCorrect?: boolean;
    timestamp: number;
  }>;
}

export interface AppState {
  isOfflineMode: boolean;
  isLowBandwidth: boolean;
  currentStep: 'idle' | 'assessing' | 'learning' | 'summary';
  logs: AgentLog[];
  session: LearningSession | null;
  isLoading: boolean;
}