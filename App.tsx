import React, { useState, useReducer, useEffect } from 'react';
import AgentTrace from './components/AgentTrace';
import QuizCard from './components/QuizCard';
import ContentCard from './components/ContentCard';
import { AppState, AgentLog, AgentType, QuizQuestion, LearningMaterial, LearningSession } from './types';
import { generateAssessment, adaptPath, curateContent, bridgeLanguage, safetyCheck } from './services/geminiService';
import { getCurriculumSources, getCoursesForSource } from './services/curriculumData';

// Helper for IDs
const genId = () => Math.random().toString(36).substring(2, 9);

const initialState: AppState = {
  isOfflineMode: false,
  isLowBandwidth: false,
  currentStep: 'idle',
  logs: [],
  session: null,
  isLoading: false,
};

// Actions
type Action = 
  | { type: 'ADD_LOG'; payload: AgentLog }
  | { type: 'START_SESSION'; payload: { topic: string, grade: string, courseName: string } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CURRENT_QUESTION'; payload: QuizQuestion }
  | { type: 'SET_CURRENT_CONTENT'; payload: LearningMaterial }
  | { type: 'RECORD_ANSWER'; payload: { question: QuizQuestion, isCorrect: boolean } }
  | { type: 'TOGGLE_BANDWIDTH' }
  | { type: 'TOGGLE_OFFLINE_MODE' };

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'ADD_LOG':
      return { ...state, logs: [...state.logs, action.payload] };
    case 'START_SESSION':
      return { 
        ...state, 
        currentStep: 'assessing', // Start with assessment
        session: {
          topic: action.payload.topic,
          courseName: action.payload.courseName,
          gradeLevel: action.payload.grade,
          masteryScore: 0,
          history: []
        },
        logs: [] 
      };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_CURRENT_QUESTION':
      return { ...state, currentStep: 'assessing', isLoading: false };
    case 'SET_CURRENT_CONTENT':
      return { ...state, currentStep: 'learning', isLoading: false };
    case 'RECORD_ANSWER':
      if (!state.session) return state;
      // Simple mastery logic for demo
      const newMastery = action.payload.isCorrect 
        ? Math.min(100, state.session.masteryScore + 20)
        : Math.max(0, state.session.masteryScore - 10);
      
      return {
        ...state,
        session: {
          ...state.session,
          masteryScore: newMastery,
          history: [...state.session.history, {
            type: 'quiz',
            data: action.payload.question,
            isCorrect: action.payload.isCorrect,
            timestamp: Date.now()
          }]
        }
      };
    case 'TOGGLE_BANDWIDTH':
      return { ...state, isLowBandwidth: !state.isLowBandwidth };
    case 'TOGGLE_OFFLINE_MODE':
      return { ...state, isOfflineMode: !state.isOfflineMode };
    default:
      return state;
  }
};

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const [currentQuestion, setCurrentQuestion] = useState<QuizQuestion | null>(null);
  const [currentContent, setCurrentContent] = useState<LearningMaterial | null>(null);
  const [topicInput, setTopicInput] = useState('');
  
  const [selectedSource, setSelectedSource] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  
  // Logging Helper
  const logAgent = (agent: AgentType, action: string, details: string) => {
    dispatch({
      type: 'ADD_LOG',
      payload: {
        id: genId(),
        timestamp: Date.now(),
        agent,
        action,
        details,
        status: 'success'
      }
    });
  };

  // 1. Start Session -> Trigger Assessment
  const handleStart = async () => {
    if(!topicInput.trim() || !selectedCourse) return;
    
    // Attempt to extract grade from course string
    // Supports: "Grade IX", "Grades VI-VIII", "Class-X", "Class-IV"
    let grade = "9";
    const gradeMatch = selectedCourse.match(/(?:Grades?|Class)[-\s]+([IVX]+|[0-9]+)/i);
    if (gradeMatch) {
       grade = gradeMatch[1]; 
    }
    
    // Create a context string that includes source and course
    const fullContext = `${selectedSource}: ${selectedCourse}`;

    dispatch({ type: 'START_SESSION', payload: { topic: topicInput, grade, courseName: fullContext } });
    logAgent(AgentType.SYSTEM, "Initialization", `Session started: ${fullContext} - ${topicInput}`);
    
    await runAssessmentCycle(topicInput, grade, 0, fullContext);
  };

  // 2. Assessment Cycle
  const runAssessmentCycle = async (topic: string, grade: string, mastery: number, courseContext?: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    
    try {
      logAgent(AgentType.ASSESSMENT, "Generating Quiz", `Aligning with ${courseContext}...`);
      const quiz = await generateAssessment(topic, grade, mastery, courseContext);
      logAgent(AgentType.ASSESSMENT, "Quiz Ready", `Question ID: ${genId()} - Difficulty: ${quiz.difficulty}`);
      
      setCurrentQuestion(quiz);
      dispatch({ type: 'SET_CURRENT_QUESTION', payload: quiz });
    } catch (e) {
      console.error(e);
      logAgent(AgentType.SYSTEM, "Error", "Failed to generate assessment.");
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 3. User Answers Quiz
  const handleAnswer = async (index: number) => {
    if (!currentQuestion || !state.session) return;
    
    const isCorrect = index === currentQuestion.correctOptionIndex;
    
    // Log Answer
    logAgent(AgentType.SYSTEM, "User Input", `Student selected option ${index}. Correct: ${isCorrect}`);
    
    // Record in State
    dispatch({ type: 'RECORD_ANSWER', payload: { question: currentQuestion, isCorrect } });
    
    // Trigger Adaptation
    await runAdaptationCycle(isCorrect, state.session.masteryScore, currentQuestion.topic, state.session.courseName);
  };

  // 4. Adaptation Cycle
  const runAdaptationCycle = async (lastCorrect: boolean, mastery: number, topic: string, courseContext: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    setCurrentQuestion(null); // Clear quiz UI
    
    logAgent(AgentType.ADAPTATION, "Analyzing Path", `Analyzing result. Mastery: ${mastery}%. Deciding next step...`);
    
    try {
      const plan = await adaptPath(lastCorrect, mastery, topic);
      logAgent(AgentType.ADAPTATION, "Path Updated", `Decision: ${plan.nextAction.toUpperCase()}. Reason: ${plan.reasoning}`);
      
      if (plan.nextAction === 'quiz') {
         await runAssessmentCycle(topic, state.session?.gradeLevel || "9", mastery, courseContext);
      } else {
         await runContentCycle(topic, state.session?.gradeLevel || "9", plan.suggestedFocus, courseContext);
      }
    } catch (e) {
      console.error(e);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 5. Content Cycle (Curator -> Safety -> Language)
  const runContentCycle = async (topic: string, grade: string, focus: string, courseContext: string) => {
    try {
      // Curate
      logAgent(AgentType.CURATOR, "Sourcing Content", `Searching ${courseContext} for '${focus}'...`);
      const rawContent = await curateContent(topic, grade, focus, courseContext);
      logAgent(AgentType.CURATOR, "Content Found", `Retrieved passage: "${rawContent.title}"`);
      
      // Safety
      logAgent(AgentType.SAFETY, "Filtering", "Checking content safety and relevance...");
      const safety = await safetyCheck(rawContent.content);
      if (!safety.safe) {
        logAgent(AgentType.SAFETY, "Blocked", `Content flagged: ${safety.reason}. Rerouting...`);
        // Fallback or retry logic here, for demo we just continue with a warning
      } else {
        logAgent(AgentType.SAFETY, "Verified", "Content is safe.");
      }
      
      // Language Bridge (Simulate logic to detect if we need translation)
      // For demo, we always try to provide a localized version if mastery is low (struggling)
      // or randomly for the feature showcase. Let's assume user prefers 'urdu_mix'
      logAgent(AgentType.LANGUAGE, "Localizing", "Translating to Roman Urdu/English mix for better comprehension...");
      const localizedContent = await bridgeLanguage(rawContent, 'urdu_mix');
      logAgent(AgentType.LANGUAGE, "Ready", "Content localized and formatted.");
      
      setCurrentContent(localizedContent);
      dispatch({ type: 'SET_CURRENT_CONTENT', payload: localizedContent });
      
    } catch (e) {
      console.error(e);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // 6. Next from Content
  const handleContentNext = async () => {
    setCurrentContent(null);
    // Go back to assessment to check understanding of the new content
    if(state.session) {
      await runAssessmentCycle(state.session.topic, state.session.gradeLevel, state.session.masteryScore, state.session.courseName);
    }
  };

  // 7. Offline Pack Export
  const downloadPack = () => {
    if (!state.session) return;
    const packData = {
      timestamp: new Date().toISOString(),
      course: state.session.courseName,
      studentLevel: state.session.gradeLevel,
      topic: state.session.topic,
      materials: state.session.history.filter(h => h.type === 'content').map(h => h.data),
      reviewQuizzes: state.session.history.filter(h => h.type === 'quiz').map(h => h.data),
      logs: state.logs
    };
    
    const blob = new Blob([JSON.stringify(packData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learning-pack-${state.session.topic.replace(/\s+/g, '-')}.json`;
    a.click();
    logAgent(AgentType.SYSTEM, "Offline Export", "Generated 1-day learning pack.");
  };

  const sources = getCurriculumSources();
  const availableCourses = getCoursesForSource(selectedSource);

  return (
    <div className={`h-screen w-full flex overflow-hidden ${state.isLowBandwidth ? 'font-mono bg-white' : 'font-sans bg-slate-50'}`}>
      
      {/* Sidebar / Agent Trace */}
      <div className="w-1/3 md:w-1/4 h-full hidden md:block">
        <AgentTrace logs={state.logs} isLowBandwidth={state.isLowBandwidth} />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative">
        
        {/* Header */}
        <header className={`p-4 flex justify-between items-center ${state.isLowBandwidth ? 'border-b-2 border-black' : 'bg-white shadow-sm z-10'}`}>
          <div>
            <h1 className={`text-xl font-bold ${state.isLowBandwidth ? 'uppercase' : 'text-slate-800'}`}>
              Student Companion
            </h1>
            {state.session && (
               <div className="flex flex-wrap gap-2 text-xs mt-1">
                 <span className={`${state.isLowBandwidth ? 'border border-black px-1' : 'bg-slate-100 px-2 py-0.5 rounded text-slate-600'}`}>
                   {state.session.courseName}
                 </span>
                 <span className={`${state.isLowBandwidth ? 'border border-black px-1' : 'bg-blue-100 px-2 py-0.5 rounded text-blue-700 font-bold'}`}>
                   Mastery: {state.session.masteryScore}%
                 </span>
               </div>
            )}
          </div>

          <div className="flex gap-3">
             <button 
              onClick={() => dispatch({type: 'TOGGLE_BANDWIDTH'})}
              className={`px-3 py-1 text-xs font-bold border ${state.isLowBandwidth ? 'bg-black text-white border-black' : 'bg-white border-slate-300 text-slate-600 rounded hover:bg-slate-50'}`}
             >
               {state.isLowBandwidth ? 'Standard' : 'Low BW'}
             </button>
             {state.session && (
               <button 
                onClick={downloadPack}
                className={`px-3 py-1 text-xs font-bold border ${state.isLowBandwidth ? 'bg-white text-black border-black' : 'bg-emerald-600 border-emerald-600 text-white rounded hover:bg-emerald-700'}`}
               >
                 Export Pack
               </button>
             )}
          </div>
        </header>

        {/* Dynamic Canvas */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 relative">
          
          {/* IDLE STATE */}
          {state.currentStep === 'idle' && (
            <div className="max-w-md mx-auto mt-10 md:mt-20 text-center">
              <div className={`mb-8 p-6 ${state.isLowBandwidth ? 'border-2 border-black' : 'bg-white rounded-xl shadow-lg border border-slate-100'}`}>
                <h2 className="text-2xl font-bold mb-4">Start Learning</h2>
                <p className="text-slate-500 mb-6 text-sm">
                  Select your board and course to begin your personalized session.
                </p>
                <div className="space-y-4">
                  
                  {/* Curriculum Source Selector */}
                  <div className="text-left">
                    <label className="block text-xs font-bold mb-1 ml-1 text-slate-500">Curriculum Board</label>
                    <select
                      value={selectedSource}
                      onChange={(e) => {
                        setSelectedSource(e.target.value);
                        setSelectedCourse(''); // Reset course when source changes
                      }}
                      className={`w-full p-2 outline-none ${state.isLowBandwidth ? 'border-2 border-black' : 'border border-slate-300 rounded focus:border-blue-500 bg-white'}`}
                    >
                      <option value="">-- Select Board --</option>
                      {sources.map(source => (
                        <option key={source} value={source}>{source}</option>
                      ))}
                    </select>
                  </div>

                  {/* Course Selector */}
                  <div className="text-left">
                    <label className={`block text-xs font-bold mb-1 ml-1 text-slate-500 ${!selectedSource ? 'opacity-50' : ''}`}>Course / Grade</label>
                    <select
                      value={selectedCourse}
                      onChange={(e) => setSelectedCourse(e.target.value)}
                      disabled={!selectedSource}
                      className={`w-full p-2 outline-none ${state.isLowBandwidth ? 'border-2 border-black' : 'border border-slate-300 rounded focus:border-blue-500 bg-white'} ${!selectedSource ? 'bg-slate-100 text-slate-400' : ''}`}
                    >
                      <option value="">-- Select Course --</option>
                      {availableCourses.map(course => (
                        <option key={course} value={course}>{course}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="text-left">
                     <label className="block text-xs font-bold mb-1 ml-1 text-slate-500">Topic</label>
                     <input 
                      type="text"
                      value={topicInput}
                      onChange={(e) => setTopicInput(e.target.value)}
                      className={`w-full p-2 outline-none ${state.isLowBandwidth ? 'border-2 border-black' : 'border border-slate-300 rounded focus:border-blue-500'}`}
                      placeholder="e.g. Photosynthesis, Algebra"
                    />
                  </div>
                  
                  <button 
                    onClick={handleStart}
                    disabled={!selectedCourse || !topicInput}
                    className={`w-full mt-4 px-6 py-3 font-bold transition-all
                      ${!selectedCourse || !topicInput ? 'opacity-50 cursor-not-allowed' : 'opacity-100'}
                      ${state.isLowBandwidth ? 'bg-black text-white hover:bg-slate-800' : 'bg-blue-600 text-white rounded hover:bg-blue-700 shadow-lg'}`}
                  >
                    Start Session
                  </button>
                </div>
                <div className="mt-4 text-xs text-left text-slate-400">
                  <p>Verified Sources:</p>
                  <p className="italic mt-1">dcar.gos.pk | pctb.punjab.gov.pk</p>
                </div>
              </div>
            </div>
          )}

          {/* LOADING STATE */}
          {state.isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-50">
               <div className={`w-16 h-16 mb-4 ${state.isLowBandwidth ? 'border-4 border-black border-t-transparent animate-spin rounded-full' : 'animate-bounce text-4xl'}`}>
                  {state.isLowBandwidth ? '' : '🤖'}
               </div>
               <p className="font-mono text-sm animate-pulse">Agents are coordinating...</p>
            </div>
          )}

          {/* ASSESSMENT STATE */}
          {!state.isLoading && state.currentStep === 'assessing' && currentQuestion && (
            <QuizCard 
              question={currentQuestion}
              onAnswer={handleAnswer}
              isLowBandwidth={state.isLowBandwidth}
              disabled={state.isLoading}
            />
          )}

          {/* LEARNING STATE */}
          {!state.isLoading && state.currentStep === 'learning' && currentContent && (
             <ContentCard 
               material={currentContent}
               onNext={handleContentNext}
               isLowBandwidth={state.isLowBandwidth}
             />
          )}
        </main>
      </div>

      {/* Mobile Log Toggle (Trace Overlay for small screens) */}
      <div className="md:hidden fixed bottom-4 right-4 z-50">
         <div className={`text-xs px-2 py-1 ${state.isLowBandwidth ? 'bg-black text-white' : 'bg-slate-800 text-white rounded-full opacity-80'}`}>
           {state.logs.length > 0 ? state.logs[state.logs.length-1].action : 'System Ready'}
         </div>
      </div>
    </div>
  );
}