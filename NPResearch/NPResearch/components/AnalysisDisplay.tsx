
import React, { useRef } from 'react';
import { AnalysisResult, FinancialYear } from '../types';

interface AnalysisDisplayProps {
  result: AnalysisResult;
  onSave?: () => void;
}

const AnalysisDisplay: React.FC<AnalysisDisplayProps> = ({ result, onSave }) => {
  const reportRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const downloadPDF = () => {
    if (!reportRef.current) return;

    const element = reportRef.current;

    // Hide blur elements before PDF generation (they render as black boxes)
    const blurElements = element.querySelectorAll('[class*="blur-"]');
    blurElements.forEach(el => (el as HTMLElement).style.display = 'none');

    const opt = {
      margin: [10, 10, 10, 10],
      filename: `Lead_Dossier_${result.targetName.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        backgroundColor: '#f8fafc'
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };

    // @ts-ignore
    html2pdf().set(opt).from(element).save().then(() => {
      // Restore blur elements after PDF generation
      blurElements.forEach(el => (el as HTMLElement).style.display = '');
    });
  };

  const exportToCSV = () => {
    const headers = ['Target Name', 'Year', 'Revenue', 'Expenses', 'Net Income', 'Total Assets', 'Service Types'];
    const serviceTypesStr = result.serviceTypes?.join("; ") || "N/A";
    const rows = result.financialHistory.map(h => [
      `"${result.targetName}"`,
      h.year,
      h.revenue.replace(/[^0-9.-]+/g,""),
      h.expenses.replace(/[^0-9.-]+/g,""),
      h.netIncome.replace(/[^0-9.-]+/g,""),
      h.assets.replace(/[^0-9.-]+/g,""),
      `"${serviceTypesStr}"`
    ]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${result.targetName.replace(/\s+/g, '_')}_Data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Clean up blob URL to prevent memory leak
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 animate-in slide-in-from-bottom duration-700 pb-12">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
           <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
           <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Intelligence Verified</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onSave} className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg font-bold text-xs transition-all border border-indigo-100 flex items-center gap-2" aria-label="Save lead to your list">
            <i className="fa-solid fa-bookmark" aria-hidden="true"></i> Save Lead
          </button>
          <button onClick={exportToCSV} className="px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg font-bold text-xs transition-all border border-emerald-100 flex items-center gap-2" aria-label="Export data to CSV file">
            <i className="fa-solid fa-file-excel" aria-hidden="true"></i> CSV Export
          </button>
          <button onClick={downloadPDF} className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg font-bold text-xs transition-all flex items-center gap-2 shadow-lg" aria-label="Download full dossier as PDF">
            <i className="fa-solid fa-file-pdf" aria-hidden="true"></i> Download PDF Dossier
          </button>
        </div>
      </div>

      {/* PDF Content Area */}
      <div ref={reportRef} className="space-y-8 p-1 bg-slate-50 rounded-3xl">
        {/* Dossier Cover / Header */}
        <div className="bg-slate-900 rounded-3xl shadow-xl overflow-hidden text-white border border-slate-800">
          <div className="p-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl -mr-32 -mt-32"></div>
            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-[10px] font-black uppercase tracking-widest mb-4">
                <i className="fa-solid fa-shield-halved text-indigo-400"></i>
                Executive Briefing Dossier
              </div>
              <h2 className="text-4xl font-black tracking-tight flex items-center gap-4">
                {result.targetName}
              </h2>
              <div className="flex items-center gap-6 mt-4 text-slate-400 font-medium text-xs">
                 <span className="flex items-center gap-2"><i className="fa-solid fa-calendar text-slate-600"></i> Analysis Date: {new Date(result.timestamp).toLocaleDateString()}</span>
                 <span className="flex items-center gap-2"><i className="fa-solid fa-fingerprint text-slate-600"></i> Record ID: {result.id}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 border-t border-slate-800 bg-slate-950/30">
            <StatBox label="LATEST REVENUE" value={result.financialHealth.revenue} />
            <StatBox label="EST. BURN RATE" value={result.financialHealth.burnRate} />
            <StatBox label="OPERATING RUNWAY" value={result.financialHealth.runway} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            
            {/* Deep Research Section */}
            {result.deepResearchData && (
              <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                  <i className="fa-solid fa-bolt text-indigo-500"></i>
                  Qualitative Intelligence
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-2">Public Sentiment</h4>
                      <p className="text-sm text-slate-700 leading-relaxed italic border-l-2 border-indigo-100 pl-4">{result.deepResearchData.sentiment}</p>
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-2">Reputation Profile</h4>
                      <p className="text-sm text-slate-700 leading-relaxed">{result.deepResearchData.reputation}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-2">Recent News & Signals</h4>
                      <ul className="space-y-2">
                        {result.deepResearchData.recentNews.map((news, i) => (
                          <li key={i} className="text-xs text-slate-600 flex gap-2">
                            <i className="fa-solid fa-newspaper text-slate-300 mt-1"></i>
                            <span>{news}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                      <h4 className="text-[10px] font-black uppercase text-indigo-600 tracking-widest mb-2">Strategic Context</h4>
                      <p className="text-xs text-slate-600 leading-relaxed">{result.deepResearchData.strategicContext}</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Quality Scorecard */}
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                  <i className="fa-solid fa-square-poll-vertical text-indigo-500"></i>
                  Quality Performance Scorecard
                </h3>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">State Review Data</div>
              </div>
              
              <div className="grid grid-cols-1 gap-3">
                {result.qualityAssessment.allFocusAreas?.map((area, i) => (
                  <div key={i} className="group p-4 rounded-2xl border border-slate-100 bg-slate-50/30 hover:bg-white hover:border-indigo-100 hover:shadow-sm transition-all flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-1.5 h-10 rounded-full ${
                        area.status === 'low' ? 'bg-red-500' : area.status === 'medium' ? 'bg-orange-400' : 'bg-emerald-500'
                      }`}></div>
                      <div>
                        <h5 className="font-bold text-slate-700 text-sm">{area.description}</h5>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Focus Area {i+1}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-xl font-black ${
                        area.status === 'low' ? 'text-red-600' : area.status === 'medium' ? 'text-orange-600' : 'text-emerald-600'
                      }`}>
                        {area.percentMet}
                      </div>
                      {area.status === 'low' && (
                        <span className="text-[9px] font-black text-red-400 uppercase tracking-tight bg-red-50 px-1.5 py-0.5 rounded leading-none">High Priority</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Financial History Table */}
            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-3">
                <i className="fa-solid fa-chart-line text-indigo-500"></i>
                5-Year Financial Intelligence
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="text-[10px] text-slate-400 uppercase font-black border-b border-slate-100">
                    <tr>
                      <th className="py-4 pr-4">Year</th>
                      <th className="py-4 px-4 text-right">Revenue</th>
                      <th className="py-4 px-4 text-right">Expenses</th>
                      <th className="py-4 px-4 text-right">Net Income</th>
                      <th className="py-4 pl-4 text-right">Total Assets</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {result.financialHistory.map((h, i) => (
                      <tr key={i} className="hover:bg-slate-50/50">
                        <td className="py-4 pr-4 font-black text-slate-700">{h.year || 'N/A'}</td>
                        <td className="py-4 px-4 text-right font-bold text-emerald-600">{h.revenue || 'N/A'}</td>
                        <td className="py-4 px-4 text-right text-slate-600">{h.expenses || 'N/A'}</td>
                        <td className={`py-4 px-4 text-right font-bold ${(h.netIncome?.includes('-') || h.netIncome?.includes('(')) ? 'text-red-500' : 'text-blue-600'}`}>
                          {h.netIncome || 'N/A'}
                        </td>
                        <td className="py-4 pl-4 text-right font-medium text-slate-500">{h.assets || 'N/A'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Pain Points */}
            <section className="space-y-4">
              <h3 className="text-xl font-bold text-slate-800 flex items-center gap-3 px-1">
                <i className="fa-solid fa-fire-flame-curved text-orange-500"></i>
                Critical Entry Points & Pitch Angles
              </h3>
              {result.painPoints.map((point, i) => (
                <div key={i} className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500 group-hover:w-2 transition-all"></div>
                  <h4 className="font-black text-slate-800 mb-2 uppercase text-[10px] tracking-widest text-indigo-500">{point.symptom}</h4>
                  <p className="text-sm text-slate-600 mb-6 leading-relaxed font-medium italic">"{point.evidence}"</p>
                  <div className="bg-slate-900 text-white p-5 rounded-2xl flex items-center gap-6 shadow-inner">
                    <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-lg">
                       <i className="fa-solid fa-lightbulb"></i>
                    </div>
                    <div className="text-sm font-bold leading-snug">{point.pitch}</div>
                  </div>
                </div>
              ))}
            </section>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-8">
            <section className="bg-white p-8 rounded-3xl shadow-lg border border-slate-200 overflow-hidden relative">
              <div className="absolute top-0 right-0 p-4 opacity-5 grayscale select-none">
                 <i className="fa-solid fa-award text-8xl"></i>
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <i className="fa-solid fa-magnifying-glass-chart text-indigo-500"></i>
                Quality Assessment
              </h3>
              <div className="space-y-6 text-sm">
                <div className="text-slate-600 leading-relaxed font-medium border-l-2 border-slate-100 pl-4 py-1 italic">
                  {result.qualityAssessment?.summary || 'Quality assessment summary not available.'}
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-600 mb-3">Key Strengths</h5>
                    <ul className="space-y-2">
                      {(result.qualityAssessment?.strengths?.length > 0) ? (
                        result.qualityAssessment.strengths.map((s, i) => (
                          <li key={i} className="text-[11px] text-slate-700 flex gap-3 font-medium">
                            <i className="fa-solid fa-circle-check text-emerald-500 mt-0.5"></i> {s}
                          </li>
                        ))
                      ) : (
                        <li className="text-[11px] text-slate-400 italic">No strengths identified</li>
                      )}
                    </ul>
                  </div>
                  <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100">
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-3">Concerns</h5>
                    <ul className="space-y-2">
                      {(result.qualityAssessment?.concerns?.length > 0) ? (
                        result.qualityAssessment.concerns.map((c, i) => (
                          <li key={i} className="text-[11px] text-slate-700 flex gap-3 font-medium">
                            <i className="fa-solid fa-circle-exclamation text-red-400 mt-0.5"></i> {c}
                          </li>
                        ))
                      ) : (
                        <li className="text-[11px] text-slate-400 italic">No concerns identified</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                <i className="fa-solid fa-bullseye text-indigo-500"></i>
                Target Decision Maker
              </h3>
              <div className="text-center p-6 bg-slate-50 rounded-2xl border border-slate-100 mb-6">
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-200">
                  <i className="fa-solid fa-user-secret text-3xl text-slate-300"></i>
                </div>
                <div className="font-black text-slate-800 text-lg">{result.decisionMaker.name}</div>
                <div className="text-indigo-600 text-xs font-black uppercase tracking-widest mt-1">{result.decisionMaker.role}</div>
              </div>
              <p className="text-xs text-slate-500 text-center leading-relaxed italic px-2">
                "{result.decisionMaker.why}"
              </p>
            </section>

            <section className="bg-indigo-600 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden">
              <div className="absolute bottom-0 right-0 opacity-10 -mr-8 -mb-8">
                 <i className="fa-solid fa-paper-plane text-9xl transform -rotate-12"></i>
              </div>
              <h3 className="text-lg font-bold mb-6 flex items-center gap-2 relative z-10">
                <i className="fa-solid fa-comment-dots text-indigo-300"></i>
                Outreach Hook
              </h3>
              <div className="bg-indigo-700/50 p-6 rounded-2xl border border-indigo-400/30 text-sm font-medium italic leading-relaxed relative z-10">
                "{result.coldEmailHook}"
              </div>
              <button onClick={() => copyToClipboard(result.coldEmailHook)} className="w-full mt-6 py-4 bg-white text-indigo-600 hover:bg-indigo-50 rounded-2xl text-xs font-black transition-all shadow-lg uppercase tracking-widest relative z-10" aria-label="Copy outreach hook to clipboard">
                Copy Hook
              </button>
            </section>
          </div>
        </div>

        <div className="pt-12 pb-6 text-center border-t border-slate-200">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Confidential Business Intelligence Briefing • Internal Use Only</p>
        </div>
      </div>
    </div>
  );
};

const StatBox: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-8 text-center border-r border-slate-800 last:border-0 hover:bg-white/5 transition-colors">
    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">{label}</div>
    <div className="text-2xl font-black tracking-tight">{value}</div>
  </div>
);

export default AnalysisDisplay;
