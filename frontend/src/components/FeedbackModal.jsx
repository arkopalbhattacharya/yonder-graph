import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

export default function FeedbackModal({ isOpen, onClose, feedbackId, onSubmitSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    corrected_triage_steps: '',
    corrected_sql: '',
    corrected_moca: '',
    root_cause_criteria: '',
  });

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.corrected_triage_steps && !formData.corrected_sql) {
      setError('Please provide at least corrected triage steps or corrected SQL.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const result = await api.submitCorrection({
        feedback_id: feedbackId,
        ...formData
      });
      
      if (result.status === 'approved') {
        onSubmitSuccess(`Correction accepted! Confidence score: ${result.final_confidence}%`);
        onClose();
      } else {
        setError(
          result.errors 
            ? result.errors.join(' ') 
            : `Correction rejected. Final confidence: ${result.final_confidence}%`
        );
      }
    } catch (err) {
      setError(err.message || 'Failed to submit correction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface-light dark:bg-surface-dark rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold">Submit Correction</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        {/* Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          <div className="mb-6 bg-[#CF1F2E]/10 dark:bg-[#CF1F2E]/20 text-[#CF1F2E] dark:text-[#F87171] p-4 rounded-lg text-sm border border-[#CF1F2E]/25 dark:border-[#CF1F2E]/30">
            <h4 className="font-semibold mb-1">Human-in-the-Loop Quality Gate</h4>
            <p>Your corrections will be evaluated by the Enrichment Agent. The updated SOP must achieve a 90% confidence score and pass Oracle SQL Tier 2 validation before it is patched into the Neo4j Knowledge Graph.</p>
          </div>
          
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 p-4 rounded-lg text-sm border border-red-200 dark:border-red-800/50 flex items-start space-x-2">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
          
          <form id="correction-form" onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-1">Corrected Triage Steps</label>
              <textarea
                name="corrected_triage_steps"
                value={formData.corrected_triage_steps}
                onChange={handleChange}
                rows={4}
                className="input-base font-mono text-sm"
                placeholder="1. Verify order status in ORD table&#10;2. Check inventory allocation..."
              ></textarea>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Corrected Diagnostic SQL (Read-Only)</label>
              <textarea
                name="corrected_sql"
                value={formData.corrected_sql}
                onChange={handleChange}
                rows={4}
                className="input-base font-mono text-sm"
                placeholder="SELECT ordnum, adddte FROM ord WHERE ordnum = :ordnum AND ROWNUM <= 100"
              ></textarea>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Corrected MOCA Commands</label>
              <textarea
                name="corrected_moca"
                value={formData.corrected_moca}
                onChange={handleChange}
                rows={2}
                className="input-base font-mono text-sm"
                placeholder="allocate wave override"
              ></textarea>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Root Cause Criteria</label>
              <textarea
                name="root_cause_criteria"
                value={formData.root_cause_criteria}
                onChange={handleChange}
                rows={2}
                className="input-base font-mono text-sm"
                placeholder="Order stuck in planned status due to missing wave template"
              ></textarea>
            </div>
          </form>
        </div>
        
        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-800 flex justify-end space-x-3 bg-gray-50 dark:bg-gray-900/50">
          <button 
            type="button" 
            onClick={onClose} 
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button 
            type="submit" 
            form="correction-form"
            className="btn-primary flex items-center space-x-2"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Evaluating...</span>
              </>
            ) : (
              <span>Submit for Evaluation</span>
            )}
          </button>
        </div>
        
      </div>
    </div>
  );
}
