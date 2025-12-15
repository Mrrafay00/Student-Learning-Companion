import React, { useState } from 'react';
import { QuizQuestion } from '../types';

interface QuizCardProps {
  question: QuizQuestion;
  onAnswer: (index: number) => void;
  isLowBandwidth: boolean;
  disabled: boolean;
}

const QuizCard: React.FC<QuizCardProps> = ({ question, onAnswer, isLowBandwidth, disabled }) => {
  const [selected, setSelected] = useState<number | null>(null);

  const handleSelect = (idx: number) => {
    if (disabled) return;
    setSelected(idx);
    // Add small delay to show selection
    setTimeout(() => onAnswer(idx), 600);
  };

  return (
    <div className={`w-full max-w-2xl mx-auto p-6 ${isLowBandwidth ? 'bg-white border-2 border-black' : 'bg-white rounded-xl shadow-lg border border-slate-100'}`}>
      <div className="mb-4 flex items-center justify-between">
        <span className={`text-xs font-bold px-2 py-1 ${isLowBandwidth ? 'border border-black' : 'bg-blue-100 text-blue-700 rounded'}`}>
          {question.topic}
        </span>
        <span className="text-xs text-slate-500 uppercase tracking-wide">{question.difficulty}</span>
      </div>
      
      <h3 className="text-xl font-bold text-slate-900 mb-6 leading-relaxed">
        {question.questionText}
      </h3>

      <div className="space-y-3">
        {question.options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => handleSelect(idx)}
            disabled={disabled}
            className={`w-full text-left p-4 transition-all duration-200
              ${isLowBandwidth ? 'border-2 border-black hover:bg-slate-100' : 'border border-slate-200 rounded-lg hover:border-blue-400 hover:bg-blue-50'}
              ${selected === idx ? (isLowBandwidth ? 'bg-black text-white' : 'bg-blue-600 text-white border-blue-600 ring-2 ring-offset-2 ring-blue-600') : ''}
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `}
          >
            <div className="flex items-center">
              <span className={`flex-shrink-0 w-8 h-8 flex items-center justify-center font-bold mr-3 
                ${isLowBandwidth ? 'border border-current' : 'bg-slate-100 rounded-full text-slate-600'}
                ${selected === idx ? 'bg-transparent text-current' : ''}
              `}>
                {String.fromCharCode(65 + idx)}
              </span>
              <span>{option}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default QuizCard;