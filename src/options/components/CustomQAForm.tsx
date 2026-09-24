import React, { useState } from 'react';
import { CustomQuestionAnswer } from '../../types/profile';
import { HelpCircle, Plus, Trash2 } from 'lucide-react';

interface Props {
  data: CustomQuestionAnswer[];
  onChange: (data: CustomQuestionAnswer[]) => void;
}

export default function CustomQAForm({ data, onChange }: Props) {
  const [newPattern, setNewPattern] = useState('');
  const [newAnswer, setNewAnswer] = useState('');

  const handleAdd = () => {
    if (!newPattern.trim() || !newAnswer.trim()) return;

    const newItem: CustomQuestionAnswer = {
      id: `qa-${Date.now()}`,
      questionPattern: newPattern.trim(),
      answer: newAnswer.trim(),
    };

    onChange([...data, newItem]);
    setNewPattern('');
    setNewAnswer('');
  };

  const handleRemove = (id: string) => {
    onChange(data.filter((item) => item.id !== id));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-indigo-600" />
          Custom Questions & Answers
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Have specific questions recurring across applications (e.g., salary expectations, relocation, referral)? Add matching rules here.
        </p>
      </div>

      {/* Add New Rule Form */}
      <div className="bg-white p-5 border border-slate-200 rounded-xl space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Add Custom Matcher Rule</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Question Keyword or Pattern (Regex supported)
            </label>
            <input
              type="text"
              value={newPattern}
              onChange={(e) => setNewPattern(e.target.value)}
              placeholder="e.g. salary expectation|desired compensation"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">
              Your Answer to Autofill
            </label>
            <input
              type="text"
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="e.g. $180,000 - $210,000"
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleAdd}
            disabled={!newPattern.trim() || !newAnswer.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Rule
          </button>
        </div>
      </div>

      {/* Existing Rules List */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
          Configured Rules ({data.length})
        </h3>

        {data.length === 0 ? (
          <div className="bg-slate-100/70 border border-dashed border-slate-300 rounded-xl p-6 text-center text-slate-500 text-sm">
            No custom rules configured yet. Try adding one for "salary expectations" or "relocation".
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2.5">
            {data.map((item) => (
              <div
                key={item.id}
                className="bg-white p-3.5 border border-slate-200 rounded-xl flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Match:</span>
                    <code className="text-xs bg-slate-100 px-2 py-0.5 rounded text-indigo-700 font-mono">
                      {item.questionPattern}
                    </code>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase">Answer:</span>
                    <span className="text-sm font-medium text-slate-800 truncate">{item.answer}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleRemove(item.id)}
                  title="Remove rule"
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
