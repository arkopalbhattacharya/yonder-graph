import React, { useEffect, useState } from 'react';
import { BookOpen, Check, X, Search, Database, Clock, ShieldCheck, FileText, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import CodeCard from './CodeCard';

export default function KnowledgeStudio({ isActive }) {
  const [activeTab, setActiveTab] = useState('browse');
  const [sops, setSops] = useState([]);
  const [pendingReviews, setPendingReviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isActive) {
      if (activeTab === 'browse') fetchSOPs();
      else fetchPending();
    }
  }, [isActive, activeTab]);

  const fetchSOPs = async () => {
    setLoading(true);
    try {
      const data = await api.getSOPs();
      setSops(data.sops || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPending = async () => {
    setLoading(true);
    try {
      const data = await api.getPendingReviews();
      setPendingReviews(data.pending_reviews || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async (filename, approved) => {
    try {
      await api.processReview({ review_filename: filename, approved });
      fetchPending();
    } catch (err) {
      console.error(err);
    }
  };

  const filteredSOPs = sops.filter(s => 
    s.sop_id?.toLowerCase().includes(search.toLowerCase()) || 
    s.issue_pattern?.toLowerCase().includes(search.toLowerCase()) ||
    s.domain?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full w-full flex flex-col bg-surface-light dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 font-mono text-xs overflow-hidden">
      
      {/* Studio Header Bar */}
      <div className="px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white/80 dark:bg-[#111114]/80 backdrop-blur z-10 flex-shrink-0">
        <div className="flex items-center space-x-2">
          <BookOpen size={16} className="text-blue-500" />
          <span className="font-bold text-sm">knowledge_studio</span>
        </div>

        <div className="flex bg-zinc-100 dark:bg-zinc-900 rounded-xl p-0.5 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <button 
            onClick={() => setActiveTab('browse')}
            className={`px-3.5 py-1 text-xs rounded-lg transition-all ${
              activeTab === 'browse' 
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold' 
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            browse_graph
          </button>
          <button 
            onClick={() => setActiveTab('pending')}
            className={`px-3.5 py-1 text-xs rounded-lg transition-all flex items-center space-x-1.5 ${
              activeTab === 'pending' 
                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold' 
                : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
            }`}
          >
            <span>sme_review_queue</span>
            {pendingReviews.length > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-purple-100 dark:bg-purple-950 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800">
                {pendingReviews.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-zinc-500">
            <span>loading_sops...</span>
          </div>
        ) : activeTab === 'browse' ? (
          <div className="max-w-5xl mx-auto space-y-4">
            
            {/* Search Box */}
            <div className="relative max-w-md">
              <Search className="absolute left-3.5 top-2.5 text-zinc-400" size={14} />
              <input 
                type="text" 
                placeholder="search by sop_id, issue pattern, or domain..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 focus:outline-none focus:border-zinc-400 dark:focus:border-zinc-600 shadow-2xs"
              />
            </div>
            
            {/* SOP Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {filteredSOPs.map(sop => (
                <div 
                  key={sop.sop_id} 
                  className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#111114] shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex flex-col justify-between"
                >
                  <div>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-xs text-blue-600 dark:text-blue-400 font-mono">{sop.sop_id}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
                        {sop.domain?.toLowerCase()}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-800 dark:text-zinc-200 font-medium mb-3 leading-relaxed">
                      {sop.issue_pattern}
                    </p>
                    
                    {sop.diagnostic_sql && (
                      <div className="mb-3">
                        <CodeCard title="Diagnostic SQL Template" code={sop.diagnostic_sql} />
                      </div>
                    )}
                    
                    {sop.triage_steps && (
                      <div className="bg-zinc-50 dark:bg-[#16161a] p-3 rounded-lg border border-zinc-100 dark:border-zinc-800/80 text-[10px] mb-3">
                        <div className="text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-1 font-bold">Triage Logic</div>
                        <p className="text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap leading-relaxed font-mono">{sop.triage_steps}</p>
                      </div>
                    )}
                  </div>
                  
                  <div className="pt-2.5 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
                    <span className="flex items-center"><Database size={11} className="mr-1 text-zinc-400" /> {sop.source || 'Canonical SOP'}</span>
                    {sop.confidence_score && (
                      <span className="font-semibold text-zinc-600 dark:text-zinc-300">Confidence: {sop.confidence_score}%</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-3">
            {pendingReviews.length === 0 ? (
              <div className="text-center py-20 text-zinc-400 dark:text-zinc-500">
                <Check className="mx-auto h-9 w-9 text-emerald-500 mb-2 opacity-80" />
                <div className="font-bold text-sm text-zinc-800 dark:text-zinc-200">Review Queue Clear</div>
                <p className="text-xs text-zinc-500 mt-1">All staged knowledge entries have been processed into Neo4j.</p>
              </div>
            ) : (
              pendingReviews.map((review, idx) => (
                <div 
                  key={idx} 
                  className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 shadow-xs"
                >
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center space-x-1.5 text-amber-600 dark:text-amber-400 font-bold">
                      <Clock size={13} />
                      <span>Pending SME Review</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">{review.source_file}</span>
                  </div>
                  
                  <div className="mb-3.5">
                    <div className="text-xs text-zinc-800 dark:text-zinc-200 font-medium">
                      Confidence Score: <strong className="text-amber-600 dark:text-amber-400">{review.evaluation?.confidence_score}%</strong> (Threshold: 90%)
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleReview(review.source_file, true)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-2xs"
                    >
                      <Check size={13} />
                      <span>Approve & Ingest</span>
                    </button>
                    <button
                      onClick={() => handleReview(review.source_file, false)}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center space-x-1.5 shadow-2xs"
                    >
                      <X size={13} />
                      <span>Reject</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
