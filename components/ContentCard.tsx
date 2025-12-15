import React from 'react';
import { LearningMaterial } from '../types';

interface ContentCardProps {
  material: LearningMaterial;
  onNext: () => void;
  isLowBandwidth: boolean;
}

const ContentCard: React.FC<ContentCardProps> = ({ material, onNext, isLowBandwidth }) => {
  return (
    <div className={`w-full max-w-2xl mx-auto ${isLowBandwidth ? 'border-2 border-black bg-white' : 'bg-white rounded-xl shadow-lg border border-slate-100'} overflow-hidden`}>
      <div className={`p-6 ${isLowBandwidth ? 'border-b-2 border-black bg-slate-100' : 'bg-green-50 border-b border-green-100'}`}>
        <div className="flex justify-between items-start mb-2">
          <span className={`text-xs font-bold px-2 py-1 ${isLowBandwidth ? 'border border-black bg-white' : 'bg-green-200 text-green-800 rounded'}`}>
            Study Material
          </span>
          <span className="text-xs font-mono text-slate-500">{material.readingLevel}</span>
        </div>
        <h3 className="text-2xl font-bold text-slate-900">{material.title}</h3>
        <p className="text-xs text-slate-500 mt-1 italic">Source: {material.sourceAttribution}</p>
      </div>

      <div className="p-6">
        <div className={`prose prose-slate max-w-none mb-8 ${material.languageMode === 'urdu_mix' ? 'font-urdu leading-loose text-lg' : ''}`}>
          <p>{material.content}</p>
        </div>

        <button
          onClick={onNext}
          className={`w-full py-3 font-bold text-center transition-colors
            ${isLowBandwidth 
              ? 'bg-black text-white hover:bg-slate-800 border-2 border-transparent' 
              : 'bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-md hover:shadow-lg'
            }`}
        >
          Continue Learning
        </button>
      </div>
    </div>
  );
};

export default ContentCard;