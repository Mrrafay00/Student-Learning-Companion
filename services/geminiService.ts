import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AgentType, QuizQuestion, LearningMaterial } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Agent: Assessment Agent ---
// Responsibility: Create micro-quizzes to test mastery.

const quizSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    questionText: { type: Type.STRING },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    correctOptionIndex: { type: Type.INTEGER },
    explanation: { type: Type.STRING },
    difficulty: { type: Type.STRING, enum: ["easy", "medium", "hard"] },
    topic: { type: Type.STRING },
  },
  required: ["questionText", "options", "correctOptionIndex", "explanation", "difficulty", "topic"],
};

export const generateAssessment = async (
  topic: string,
  grade: string,
  previousMastery: number,
  courseContext?: string
): Promise<QuizQuestion> => {
  const difficulty = previousMastery > 70 ? 'hard' : previousMastery > 40 ? 'medium' : 'easy';
  const contextStr = courseContext ? `Context: ${courseContext} (National Curriculum).` : '';
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Create a single multiple-choice question for a Grade ${grade} student about "${topic}".
    ${contextStr}
    The difficulty should be ${difficulty}.
    Ensure the question is strictly aligned with the specified curriculum context if provided.
    Provide 4 options.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: quizSchema,
      systemInstruction: `You are the Assessment Agent. Your goal is to diagnose student gaps accurately based on the local curriculum.`,
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from Assessment Agent");
  return JSON.parse(text) as QuizQuestion;
};

// --- Agent: Adaptation Agent ---
// Responsibility: Analyze results and decide next steps.

export const adaptPath = async (
  isCorrect: boolean,
  currentMastery: number,
  topic: string
): Promise<{ nextAction: 'quiz' | 'content', reasoning: string, suggestedFocus: string }> => {
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `The student just answered a question about "${topic}".
    Result: ${isCorrect ? "Correct" : "Incorrect"}.
    Current Mastery Estimate: ${currentMastery}%.
    
    Decide the next step:
    - If incorrect or low mastery, recommend 'content' (learning material).
    - If correct and high mastery, recommend another 'quiz' (harder) or 'content' (advanced).
    
    Return JSON: { "nextAction": "quiz" | "content", "reasoning": "string", "suggestedFocus": "string" }`,
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from Adaptation Agent");
  return JSON.parse(text);
};

// --- Agent: Content Curator ---
// Responsibility: Retrieve curriculum-aligned content.

const contentSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    content: { type: Type.STRING },
    readingLevel: { type: Type.STRING },
    sourceAttribution: { type: Type.STRING },
    languageMode: { type: Type.STRING, enum: ["english", "urdu_mix"] },
  },
  required: ["title", "content", "readingLevel", "sourceAttribution", "languageMode"],
};

export const curateContent = async (
  topic: string,
  grade: string,
  focusArea: string,
  courseContext?: string
): Promise<LearningMaterial> => {
  const contextStr = courseContext ? `Source Material: ${courseContext} (National Curriculum).` : 'Source Material: General National Curriculum.';
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Provide a short educational passage (max 150 words) about "${topic}", specifically focusing on "${focusArea}".
    Target Grade: ${grade}.
    ${contextStr}
    Align with Pakistan National Curriculum (SNC) or Punjab Textbook standards.
    The content should be in English but simple to understand.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: contentSchema,
      systemInstruction: "You are the Content Curator Agent. You source high-quality, relevant educational text based on specific curriculum documents.",
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from Curator Agent");
  return JSON.parse(text);
};

// --- Agent: Language Bridge ---
// Responsibility: Translate/Explain in local context (Urdu/English code-switching).

export const bridgeLanguage = async (
  material: LearningMaterial,
  targetLanguage: 'urdu_mix'
): Promise<LearningMaterial> => {
  // If already in target mode (simulated), just return. 
  // In reality, this would take English text and rewrite it.
  
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Rewrite the following educational content using Urdu-English Code Switching (Roman Urdu + English technical terms) to make it accessible for a bilingual student in Pakistan.
    
    Title: ${material.title}
    Content: ${material.content}
    
    Keep the same JSON structure.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: contentSchema,
      systemInstruction: "You are the Language Bridge Agent. You help students who speak Urdu at home but study Science/Math in English. Use clear Roman Urdu for explanations but keep keywords in English.",
    },
  });

  const text = response.text;
  if (!text) throw new Error("No response from Language Bridge Agent");
  return JSON.parse(text);
};

// --- Agent: Safety Policy ---
// Responsibility: Ensure content is safe and relevant.

export const safetyCheck = async (content: string): Promise<{ safe: boolean; reason?: string }> => {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `Analyze this content: "${content.substring(0, 500)}...".
    Is this content safe for a minor student and relevant to an educational context?
    Return JSON: { "safe": boolean, "reason": string }`,
    config: {
       responseMimeType: "application/json",
    }
  });
  
  const text = response.text;
  if (!text) return { safe: true };
  return JSON.parse(text);
};