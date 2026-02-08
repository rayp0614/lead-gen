
import React from 'react';
import { AnalysisResult } from '../types';

interface LeadListProps {
  leads: AnalysisResult[];
  onRemove: (id: string) => void;
  onSelect: (lead: AnalysisResult) => void;
}

const LeadList: React.FC<LeadListProps> = ({ leads, onRemove, onSelect }) => {
  if (leads.length === 0) {
    return (
      <div className="bg-white p-12 rounded-3xl border border-dashed border-slate-300 text-center">
        <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="fa-solid fa-folder-open text-slate-300 text-2xl"></i>
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Your Lead List is Empty</h3>
        <p className="text-sm text-slate-500">Run an analysis and click "Save to Lead List" to store them here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <i className="fa-solid fa-database text-indigo-600"></i>
          Saved Lead List
        </h3>
        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{leads.length} Leads</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {leads.map((lead) => (
          <div key={lead.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group overflow-hidden">
            <div className="p-5">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-indigo-50 text-indigo-600 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">
                  {lead.financialHealth.verdict}
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); onRemove(lead.id); }}
                  className="text-slate-300 hover:text-red-500 transition-colors"
                >
                  <i className="fa-solid fa-trash-can"></i>
                </button>
              </div>
              <h4 className="font-bold text-slate-800 line-clamp-1 mb-1">{lead.targetName}</h4>
              <p className="text-xs text-slate-500 flex items-center gap-1 mb-4">
                <i className="fa-solid fa-calendar-days"></i>
                Analyzed {new Date(lead.timestamp).toLocaleDateString()}
              </p>
              
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Revenue:</span>
                  <span className="font-bold text-slate-700">{lead.financialHealth.revenue}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-400">Runway:</span>
                  <span className="font-bold text-slate-700">{lead.financialHealth.runway}</span>
                </div>
              </div>

              <button 
                onClick={() => onSelect(lead)}
                className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-indigo-600 transition-colors flex items-center justify-center gap-2"
              >
                View Full Dossier
                <i className="fa-solid fa-arrow-right text-[10px]"></i>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LeadList;
