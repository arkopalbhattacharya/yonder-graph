import React, { useState, useRef, useEffect } from 'react';
import { 
  CornerDownLeft, 
  ThumbsUp, 
  ThumbsDown, 
  ShieldAlert, 
  BookOpen, 
  Terminal, 
  Sparkles, 
  AlertCircle,
  Square,
  Loader2,
  Paperclip,
  BrainCircuit,
  ChevronDown,
  ChevronUp,
  Layers,
  CheckCircle2
} from 'lucide-react';
import { api } from '../services/api';
import { useSettings } from '../context/SettingsContext';
import CodeCard from './CodeCard';
import FeedbackModal from './FeedbackModal';
import MermaidDiagram from './MermaidDiagram';
import StepFlowchart from './StepFlowchart';
import InvestigationStepper from './InvestigationStepper';
import EnrichmentAgentModal from './EnrichmentAgentModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { syncUrl } from '../utils/navigation';

const RESOLVE_HIERARCHY_STEPS = [
  {
    id: 'intent',
    agent: 'IntentClassifierAgent',
    title: 'Cognitive Intent & Domain Gate',
    items: [
      { name: 'domain_intent_classifier', type: 'skill' },
      { name: 'operational_taxonomy', type: 'tool' }
    ],
    subSteps: [
      'Analyzing query structure and operational semantics',
      'Verifying incident triage vs. conceptual inquiry',
      'Detecting target domain (Inbound, Outbound, Inventory)'
    ]
  },
  {
    id: 'routing',
    agent: 'TriageRoutingAgent',
    title: 'Incident Parameter Extraction & Routing',
    items: [
      { name: 'entity_regex_extractor', type: 'tool' },
      { name: 'wms_key_parser', type: 'tool' },
      { name: 'domain_router', type: 'skill' }
    ],
    subSteps: [
      'Extracting business keys (Order Number, Warehouse ID, Load/LPN, Wave)',
      'Classifying incident pattern and failure classification'
    ]
  },
  {
    id: 'graphrag',
    agent: 'GraphRAGDiagnosticAgent',
    title: 'GraphRAG Knowledge Retrieval & Runbook Traversal',
    items: [
      { name: 'SOP-OUT-001', type: 'sop' },
      { name: 'neo4j_vector_search', type: 'tool' },
      { name: 'sop_embeddings', type: 'sop' },
      { name: 'schema_traversal', type: 'skill' }
    ],
    subSteps: [
      'Searching vector embeddings for matching Standard Operating Procedures (SOP)',
      'Traversing graph schema to map tables, columns, foreign keys & diagnostic templates'
    ]
  },
  {
    id: 'sql_binding',
    agent: 'SQLParameterBindingAgent',
    title: 'SQL Parameter Binding & AST Guardrail Validation',
    items: [
      { name: 'oracle_ast_validator', type: 'tool' },
      { name: 'bind_sanitizer', type: 'tool' },
      { name: 'sql_readonly_guard', type: 'skill' }
    ],
    subSteps: [
      'Sanitizing and binding extracted keys into diagnostic SQL templates',
      'Executing Tier 2 AST safety validation (SELECT only, ROWNUM <= 100 boundaries)'
    ]
  },
  {
    id: 'governance',
    agent: 'GovernanceSafetyAgent',
    title: 'Tier 1 Governance & Safety Policy Evaluation',
    items: [
      { name: 'tier1_policy_engine', type: 'skill' },
      { name: 'moca_rule_evaluator', type: 'tool' },
      { name: 'remediation_guard', type: 'skill' }
    ],
    subSteps: [
      'Classifying MOCA governance tier and risk level',
      'Evaluating safety preconditions, rollback safeguards & approval requirements'
    ]
  },
  {
    id: 'stepper',
    agent: 'ResolveTriageAgent',
    title: 'Structured Investigation Stepper Decomposition',
    items: [
      { name: 'stepper_sequencer', type: 'tool' },
      { name: 'sql_script_consolidator', type: 'tool' },
      { name: 'diagnostic_card_builder', type: 'skill' }
    ],
    subSteps: [
      'Sequencing diagnostic investigation cards and root cause checks',
      'Assembling consolidated AST-validated Oracle diagnostic SQL script'
    ]
  },
  {
    id: 'humanizing',
    agent: 'HumanizingAgent',
    title: 'Multi-Persona Summaries & Reasoning Synthesis',
    items: [
      { name: 'multi_persona_synthesizer', type: 'skill' },
      { name: 'l1_l2_l3_adapters', type: 'skill' },
      { name: 'cognitive_reasoning_trace', type: 'skill' }
    ],
    subSteps: [
      'Synthesizing operational summaries for L1 Floor Ops, L2 Support, and L3 Architect',
      'Constructing deep multi-agent triage reasoning and decision trace'
    ]
  }
];

export default function CopilotChat({ isActive, initialPersona = 'ask', sessionId, onSessionUpdated }) {
  const { enableAskMode, enableFileUpload, enableShowReasoning } = useSettings();
  const [persona, setPersona] = useState(() => (enableAskMode ? initialPersona : 'resolve'));
  const activeSessionId = sessionId || 'default-session';
  
  useEffect(() => {
    if (!enableAskMode && persona === 'ask') {
      setPersona('resolve');
    }
  }, [enableAskMode, persona]);

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [liveStepIndex, setLiveStepIndex] = useState(0);
  const [activeFeedbackId, setActiveFeedbackId] = useState(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // Document Ingestion & Enrichment State
  const [isEnrichmentModalOpen, setIsEnrichmentModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressStep, setUploadProgressStep] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [uploadError, setUploadError] = useState(null);
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const splashTextareaRef = useRef(null);
  const abortControllerRef = useRef(null);
  const splashFileInputRef = useRef(null);

  const askProgressMessages = [
    "🔍 Querying Neo4j domain graph & WMS entity schemas...",
    "📊 Mapping table relationships across INBORD, RCVTRK, LOCMST, INVDTL...",
    "📐 Structuring sequential process flowchart & step definitions...",
    "✨ Finalizing markdown architecture guide...",
  ];

  // Sync initialPersona prop if changed from parent tabs
  useEffect(() => {
    if (initialPersona && initialPersona !== persona) {
      setPersona(initialPersona);
      setMessages([]);
    }
  }, [initialPersona]);

  // Load session messages when sessionId changes
  useEffect(() => {
    const loadSession = async () => {
      if (!sessionId) return;
      try {
        const data = await api.getChatSession(sessionId);
        if (data && data.messages && data.messages.length > 0) {
          const loaded = data.messages.map(m => {
            const rawUserText = typeof m.content === 'object' && m.content?.text ? m.content.text : m.content;
            const prevUserMsg = data.messages.find(prev => prev.id < m.id && prev.role === 'user');
            const prevUserText = prevUserMsg 
              ? (typeof prevUserMsg.content === 'object' && prevUserMsg.content?.text ? prevUserMsg.content.text : prevUserMsg.content)
              : null;
            return {
              id: m.id,
              role: m.role,
              content: m.role === 'user' ? rawUserText : m.content,
              userQuery: m.role === 'assistant' ? prevUserText : null
            };
          });
          setMessages(loaded);
          if (data.persona) {
            setPersona(data.persona);
          }
        } else {
          setMessages([]);
        }
      } catch (err) {
        setMessages([]);
      }
    };

    if (isActive) {
      loadSession();
    }
  }, [sessionId, isActive]);

  useEffect(() => {
    let interval;
    if (isLoading) {
      setProgressStep(0);
      setLiveStepIndex(0);
      interval = setInterval(() => {
        setProgressStep(prev => (prev + 1) % askProgressMessages.length);
        setLiveStepIndex(prev => {
          if (prev < RESOLVE_HIERARCHY_STEPS.length - 1) return prev + 1;
          return prev;
        });
      }, 700);
    }
    return () => clearInterval(interval);
  }, [isLoading, persona]);

  useEffect(() => {
    if (isActive && messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isActive]);

  // Auto-adjust Textarea Height
  useEffect(() => {
    const targetRef = messages.length === 0 ? splashTextareaRef : textareaRef;
    if (targetRef.current) {
      targetRef.current.style.height = 'auto';
      const scrollHeight = targetRef.current.scrollHeight;
      targetRef.current.style.height = `${Math.min(scrollHeight, messages.length === 0 ? 100 : 76)}px`;
    }
  }, [input, messages.length]);

  const handleSwitchPersona = (newPersona) => {
    if (newPersona === persona) return;
    setPersona(newPersona);
    syncUrl(newPersona, messages.length > 0 ? activeSessionId : null);
    if (messages.length === 0) {
      // stay on clean splash
    } else {
      setMessages([]);
    }
  };

  const handleStopProcess = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
  };

  const handleSubmit = async (e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    if (!input.trim() || isLoading) return;

    const queryToSend = input;
    const userMessage = { id: Date.now().toString(), role: 'user', content: queryToSend };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    syncUrl(persona, activeSessionId);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await api.runTriage(queryToSend, activeSessionId, persona, controller.signal);
      
      const assistantMessage = {
        id: response.session_id || Date.now().toString(),
        role: 'assistant',
        content: response,
        userQuery: queryToSend,
        feedbackStatus: null
      };
      syncUrl(persona, activeSessionId);
      
      // Accumulate tokens for the current session in localStorage
      try {
        const sessionKey = `yg_session_tokens_${activeSessionId}`;
        const rawPrev = localStorage.getItem(sessionKey);
        const prev = rawPrev ? JSON.parse(rawPrev) : { total: 0, prompt: 0, completion: 0, agents: {} };
        
        const usage = response.token_usage || {};
        const turnTotal = usage.total_tokens || 0;
        const turnPrompt = usage.prompt_tokens || 0;
        const turnCompletion = usage.completion_tokens || 0;
        const turnAgents = usage.agents || {};

        const nextAgents = { ...prev.agents };
        for (const [agName, agData] of Object.entries(turnAgents)) {
          const prevAg = nextAgents[agName] || { total: 0, prompt: 0, completion: 0 };
          nextAgents[agName] = {
            total: prevAg.total + (agData.total || 0),
            prompt: prevAg.prompt + (agData.prompt || 0),
            completion: prevAg.completion + (agData.completion || 0),
          };
        }

        const nextSessionTokens = {
          total: prev.total + turnTotal,
          prompt: prev.prompt + turnPrompt,
          completion: prev.completion + turnCompletion,
          agents: nextAgents,
        };

        localStorage.setItem(sessionKey, JSON.stringify(nextSessionTokens));
        localStorage.setItem('yg_current_session_tokens', JSON.stringify(nextSessionTokens));
        localStorage.setItem('yg_active_session_id', activeSessionId);
      } catch (e) {
        console.warn("Could not save session tokens to localStorage:", e);
      }

      setMessages(prev => [...prev, assistantMessage]);
      if (onSessionUpdated) {
        onSessionUpdated();
      }
    } catch (error) {
      if (error.name === 'AbortError' || controller.signal.aborted) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: '⚠ Process cancelled by user.'
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: `Error: ${error.message}`
        }]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    setIsEnrichmentModalOpen(true);
    setIsUploading(true);
    setUploadError(null);
    setUploadResult(null);
    setUploadProgressStep(0);

    // Dynamic step animation ticker
    const ticker = setInterval(() => {
      setUploadProgressStep((prev) => (prev < 5 ? prev + 1 : prev));
    }, 700);

    try {
      const data = await api.uploadAndEnrichDocument(file);
      clearInterval(ticker);
      setUploadProgressStep(7);
      setUploadResult(data);
    } catch (err) {
      clearInterval(ticker);
      setUploadError(err.message || 'Document upload and enrichment failed');
    } finally {
      setIsUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleFeedback = async (messageId, type, messageData) => {
    try {
      await api.submitFeedback({
        session_id: messageData.id,
        user_query: messageData.userQuery,
        generated_response: messageData.content,
        feedback_type: type,
        matched_sop: messageData.content?.matched_sop?.sop_id
      });
      setMessages(prev => prev.map(m => {
        if (m.id === messageId) {
          return { ...m, feedbackStatus: type };
        }
        return m;
      }));
    } catch (error) {
      console.error('Failed to submit feedback', error);
    }
  };

  const openFeedbackModal = (messageId) => {
    setActiveFeedbackId(messageId);
    setIsFeedbackModalOpen(true);
  };

  const renderMessageContent = (msg) => {
    if (msg.role === 'user') {
      const userText = typeof msg.content === 'string' ? msg.content : (msg.content?.text || JSON.stringify(msg.content));
      return (
        <div className="text-xs font-mono text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
          {userText}
        </div>
      );
    }

    if (msg.role === 'system') {
      return (
        <div className="flex items-center space-x-2 text-xs font-mono text-rose-500 dark:text-rose-400">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{msg.content}</span>
        </div>
      );
    }

    const { content } = msg;

    if (typeof content === 'string') {
      return (
        <div className="markdown-prose text-xs">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </div>
      );
    }

    if (!content) return null;

    if (content.status === 'blocked') {
      return (
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-rose-600 dark:text-rose-400 font-mono text-xs font-semibold">
            <ShieldAlert size={15} />
            <span>ACTION BLOCKED BY TIER 1 GOVERNANCE POLICY</span>
          </div>
          <div className="p-3 bg-rose-50/50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/60 rounded text-xs text-rose-800 dark:text-rose-300 font-mono">
            {content.policy_justification || content.narrative}
          </div>
        </div>
      );
    }

    const msgPersona = content.persona || persona;

    return (
      <div className="space-y-4">
        {/* Header Metadata Pill */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-zinc-100 dark:border-zinc-800/80 text-[11px] font-mono text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center space-x-2">
            <span className="px-1.5 py-0.5 rounded font-semibold text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
              {msgPersona}
            </span>
            <span>domain: {content.domain || 'general'}</span>
          </div>

          <div className="flex items-center space-x-3 text-[10px]">
            {content.total_latency_ms > 0 && <span>{content.total_latency_ms}ms</span>}
            <span className="text-emerald-600 dark:text-emerald-400">AST_PASS</span>
          </div>
        </div>

        {/* Section 1: Formatted Narrative & Multi-Persona Summaries (L1 / L2 / L3) */}
        <PersonaSummaryCard content={content} msgPersona={msgPersona} />

        {/* ── ASK PERSONA: Step Flowchart ── */}
        {msgPersona === 'ask' && content.steps && content.steps.length > 0 && (
          <StepFlowchart steps={content.steps} domain={content.domain} />
        )}

        {/* ── RESOLVE PERSONA: Ordered Investigation Stepper with SQL ── */}
        {msgPersona === 'resolve' && content.investigation_steps && content.investigation_steps.length > 0 && (
          <InvestigationStepper 
            steps={content.investigation_steps} 
            sessionId={activeSessionId}
            governance={content.governance}
          />
        )}

        {/* Mermaid Flowchart Diagram */}
        {content.mermaid_diagram && (
          <div className="pt-2">
            <MermaidDiagram chart={content.mermaid_diagram} />
          </div>
        )}

        {/* Legacy single-SQL support fallback */}
        {content.diagnostic_sql && content.diagnostic_sql.sql && !content.investigation_steps && (
          <div className="pt-2">
            <CodeCard 
              code={content.diagnostic_sql.sql} 
              language="sql" 
              title="Oracle Diagnostic Query (Tier 2 Validated)" 
            />
          </div>
        )}

        {/* Matched SOP Reference */}
        {content.matched_sop && (content.matched_sop.sop_id || content.matched_sop.title || content.matched_sop.issue_pattern) && (
          <div className="flex items-center space-x-1.5 text-[11px] font-mono text-zinc-500 pt-1">
            <BookOpen size={12} className="text-zinc-400" />
            <span>
              SOP Reference:{" "}
              {content.matched_sop.sop_id && (
                <strong className="text-zinc-700 dark:text-zinc-300">
                  {content.matched_sop.sop_id}
                </strong>
              )}
              {content.matched_sop.sop_id && (content.matched_sop.title || content.matched_sop.issue_pattern || content.matched_sop.process_domain) ? " - " : ""}
              {content.matched_sop.title || content.matched_sop.issue_pattern || content.matched_sop.process_domain || "Standard Operating Procedure"}
            </span>
          </div>
        )}

        {/* Multi-Agent Reasoning Drawer (Experimental Feature) */}
        <ReasoningSection reasoning={content.reasoning} isEnabled={enableShowReasoning} />

        {/* Feedback Toolbar */}
        <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px] font-mono">
          <span className="text-zinc-400 dark:text-zinc-600">Was this response accurate?</span>
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleFeedback(msg.id, 'positive', msg)}
              className={`p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                msg.feedbackStatus === 'positive' ? 'text-emerald-500' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
              title="Helpful & Accurate"
            >
              <ThumbsUp size={13} />
            </button>
            <button
              onClick={() => handleFeedback(msg.id, 'negative', msg)}
              className={`p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                msg.feedbackStatus === 'negative' ? 'text-rose-500' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
              title="Inaccurate or Unhelpful"
            >
              <ThumbsDown size={13} />
            </button>
            <button
              onClick={() => openFeedbackModal(msg.id)}
              className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-blue-500 transition-colors"
              title="Provide Detailed Feedback"
            >
              <Sparkles size={13} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const isSplashView = messages.length === 0;

  return (
    <div className="flex h-full w-full overflow-hidden font-mono text-xs">
      
      {/* ── 1. SPLASH SCREEN (First chat session state) ── */}
      {isSplashView ? (
        <div className="w-full h-full overflow-y-auto flex flex-col items-center justify-center p-4 sm:p-6 custom-scrollbar">
          <div className="w-full max-w-2xl sm:max-w-3xl flex flex-col items-center text-center space-y-4 my-auto">
            
            {/* Very Large Bold Screen-Adjusting Title (No Icons) */}
            <div className="w-full pb-2">
              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter font-mono text-zinc-900 dark:text-zinc-100 select-none">
                yonder_graph
              </h1>
            </div>

            {/* Broader Centered Chat Input Box */}
            <div className="w-full">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} 
                className="relative flex items-end bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-xl shadow-xs focus-within:border-zinc-500 dark:focus-within:border-zinc-600 transition-all p-2"
              >
                <textarea
                  ref={splashTextareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  placeholder={
                    persona === 'ask'
                      ? "ask a supply chain process flow, table schema, or architecture..."
                      : "describe an incident, service request, or order issue..."
                  }
                  className="w-full bg-transparent border-0 py-2.5 px-2.5 pr-12 text-xs sm:text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none resize-none custom-scrollbar leading-relaxed"
                  rows={2}
                  style={{ minHeight: '48px', maxHeight: '100px' }}
                />
                
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e)}
                  disabled={!input.trim()}
                  className="absolute right-2.5 bottom-2.5 p-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 rounded-lg hover:opacity-90 disabled:opacity-30 transition-opacity flex-shrink-0"
                  title="Submit (Enter)"
                >
                  <CornerDownLeft size={15} />
                </button>
              </form>

              {/* Controls Under Chat Box: Staple Pin Upload + Ask/Resolve Toggle */}
              <div className="flex items-center justify-between pt-2 px-1 text-xs">
                <div className="flex items-center space-x-2">
                  
                  {/* Staple Pin Icon Button (Upload Document into Knowledge Graph - Experimental) */}
                  {enableFileUpload && (
                    <>
                      <button
                        type="button"
                        onClick={() => splashFileInputRef.current?.click()}
                        className="p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900/90 text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all flex items-center justify-center shadow-2xs cursor-pointer"
                        title="Upload Document into Supply Chain Knowledge Graph (.pdf, .ppt, .xls, .csv, .doc, .docx, .txt, .md)"
                      >
                        <Paperclip size={14} className="-rotate-45" />
                      </button>
                      <input
                        type="file"
                        ref={splashFileInputRef}
                        onChange={handleFileUpload}
                        accept=".pdf,.ppt,.pptx,.xls,.xlsx,.csv,.doc,.docx,.txt,.md"
                        className="hidden"
                      />
                    </>
                  )}

                  {/* Ask / Resolve Persona Toggle (Experimental Ask Mode) */}
                  {enableAskMode && (
                    <div className="flex items-center space-x-1 bg-zinc-100 dark:bg-zinc-900/90 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-800">
                      <button
                        type="button"
                        onClick={() => handleSwitchPersona('ask')}
                        className={`px-3.5 py-1 rounded-lg text-xs font-mono transition-all ${
                          persona === 'ask'
                            ? 'bg-zinc-200/90 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs'
                            : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                        }`}
                      >
                        ask
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSwitchPersona('resolve')}
                        className={`px-3.5 py-1 rounded-lg text-xs font-mono transition-all ${
                          persona === 'resolve'
                            ? 'bg-zinc-200/90 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold shadow-2xs'
                            : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                        }`}
                      >
                        resolve
                      </button>
                    </div>
                  )}
                </div>

                <span className="text-[10px] text-zinc-400 dark:text-zinc-600 font-mono">Press Enter ↵ to submit</span>
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* ── 2. ACTIVE CHAT STREAM VIEW ── */
        <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col h-full overflow-hidden px-3 sm:px-6">
          
          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto py-4 sm:py-6 space-y-4 custom-scrollbar">
            {messages.map((msg, idx) => {
              const isUser = msg.role === 'user';
              const isAssistant = msg.role === 'assistant';
              const showTimeline = isAssistant && (msg.content?.persona === 'resolve' || msg.content?.investigation_steps || msg.content?.agent_traces);

              return (
                <React.Fragment key={msg.id || idx}>
                  {/* Collapsed Low-Contrast Timeline Box (Stays between user query and final response) */}
                  {showTimeline && (
                    <div className="w-full flex justify-start">
                      <CollapsedExecutionTimeline 
                        traces={msg.content?.agent_traces} 
                        latencyMs={msg.content?.total_latency_ms} 
                      />
                    </div>
                  )}

                  <div className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`w-full ${isUser ? 'max-w-xl' : 'max-w-3xl'} rounded-lg p-3.5 sm:p-4 transition-all ${
                      isUser 
                        ? 'bg-zinc-100 dark:bg-[#18181b] border border-zinc-200/80 dark:border-zinc-800' 
                        : 'bg-white dark:bg-[#111114] border border-zinc-200/80 dark:border-zinc-800/80 shadow-xs'
                    }`}>
                      {renderMessageContent(msg)}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            
            {/* Live Hierarchical Timeline during execution (Not in a balloon, rendered as progressive text with fade-in) */}
            {isLoading && (
              <div className="w-full flex justify-start">
                {persona === 'resolve' ? (
                  <LiveHierarchicalTimeline 
                    activeStepIndex={liveStepIndex} 
                    onStop={handleStopProcess} 
                  />
                ) : (
                  <div className="w-full max-w-xl bg-white dark:bg-[#111114] border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 shadow-xs">
                    <div className="flex items-center justify-between gap-2 text-xs font-mono">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <Loader2 size={13} className="animate-spin flex-shrink-0 text-zinc-500" />
                        <span className="truncate text-[11px] text-zinc-700 dark:text-zinc-300 font-medium">
                          {askProgressMessages[progressStep]}
                        </span>
                      </div>

                      <button
                        onClick={handleStopProcess}
                        className="flex items-center space-x-1 px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 text-[10px] font-semibold transition-colors flex-shrink-0 cursor-pointer"
                        title="Stop Process Immediately"
                      >
                        <Square size={9} className="fill-current" />
                        <span>Stop</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar (Bottom-aligned during active chat) */}
          <div className="py-3 sm:py-4 flex-shrink-0">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSubmit(e); }} 
              className="relative flex items-end bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 rounded-xl shadow-xs focus-within:border-zinc-500 dark:focus-within:border-zinc-600 transition-all p-1.5"
            >
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
                placeholder={
                  persona === 'ask'
                    ? "ask a supply chain process flow, table schema, or architecture..."
                    : "describe an incident, service request, or order issue..."
                }
                className="w-full bg-transparent border-0 py-2 px-2.5 pr-10 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none resize-none custom-scrollbar leading-[1.35rem]"
                rows={1}
                style={{ minHeight: '38px', maxHeight: '76px' }}
              />
              
              {isLoading ? (
                <button
                  type="button"
                  onClick={handleStopProcess}
                  className="absolute right-2 bottom-2 p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs transition-colors flex-shrink-0 flex items-center justify-center"
                  title="Stop Process (Abrupt)"
                >
                  <Square size={13} className="fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={(e) => handleSubmit(e)}
                  disabled={!input.trim()}
                  className="absolute right-2 bottom-2 p-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 rounded hover:opacity-90 disabled:opacity-30 transition-opacity flex-shrink-0"
                  title="Submit (Enter)"
                >
                  <CornerDownLeft size={14} />
                </button>
              )}
            </form>

            {/* Active Session Info (No mode switching or file upload during active chat) */}
            <div className="flex items-center justify-between pt-1.5 px-1 text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
              <div className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {persona === 'ask' ? 'AskProcessAgent' : 'ResolveTriageAgent'}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
                  • active session
                </span>
              </div>
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600">Press Enter ↵ to send</span>
            </div>
          </div>

        </div>
      )}
      
      {/* ── Enrichment Agentic Loop Popup Modal ── */}
      <EnrichmentAgentModal
        isOpen={isEnrichmentModalOpen}
        onClose={() => setIsEnrichmentModalOpen(false)}
        isUploading={isUploading}
        uploadProgressStep={uploadProgressStep}
        uploadResult={uploadResult}
        selectedFileName={selectedFileName}
        error={uploadError}
      />

      <FeedbackModal 
        isOpen={isFeedbackModalOpen} 
        onClose={() => setIsFeedbackModalOpen(false)}
        feedbackId={activeFeedbackId}
        onSubmitSuccess={(msg) => console.log(msg)}
      />
    </div>
  );
}

function PersonaSummaryCard({ content, msgPersona }) {
  const summaries = content?.persona_summaries;
  const hasMultiplePersonas = summaries && (summaries.l1 || summaries.l2 || summaries.l3);
  const [selectedPersona, setSelectedPersona] = useState('l1');

  if (!content) return null;

  const currentText = hasMultiplePersonas 
    ? (summaries[selectedPersona] || content.narrative || '') 
    : (content.narrative || '');

  if (!currentText) return null;

  return (
    <div className="space-y-2.5">
      {/* Persona Selector Tabs (Only when persona summaries exist or in Resolve mode) */}
      {hasMultiplePersonas && (
        <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100 dark:border-zinc-800/60">
          <div className="flex items-center space-x-1.5 text-[11px] font-mono text-zinc-400 dark:text-zinc-500">
            <Layers size={13} className="text-blue-500" />
            <span className="text-[10px] uppercase font-bold tracking-wider">Summary Perspective:</span>
          </div>
          <div className="inline-flex p-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] font-mono">
            <button
              type="button"
              onClick={() => setSelectedPersona('l1')}
              className={`px-2.5 py-0.5 rounded-md font-medium transition-all ${
                selectedPersona === 'l1'
                  ? 'bg-white dark:bg-zinc-800 text-emerald-600 dark:text-emerald-400 font-bold shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
              title="L1 Floor Operations & Service Desk View"
            >
              L1 Ops
            </button>
            <button
              type="button"
              onClick={() => setSelectedPersona('l2')}
              className={`px-2.5 py-0.5 rounded-md font-medium transition-all ${
                selectedPersona === 'l2'
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
              title="L2 Application Support Engineers View"
            >
              L2 Support
            </button>
            <button
              type="button"
              onClick={() => setSelectedPersona('l3')}
              className={`px-2.5 py-0.5 rounded-md font-medium transition-all ${
                selectedPersona === 'l3'
                  ? 'bg-white dark:bg-zinc-800 text-purple-600 dark:text-purple-400 font-bold shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
              title="L3 Core Engineers & DBAs View"
            >
              L3 Architect
            </button>
          </div>
        </div>
      )}

      {/* Rendered Markdown Text */}
      <div className="markdown-prose text-xs leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {currentText}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function ReasoningSection({ reasoning, isEnabled }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isEnabled || !reasoning || !reasoning.trim()) return null;

  return (
    <div className="pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800/80 font-mono">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200/80 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 border border-zinc-200/80 dark:border-zinc-800 transition-colors cursor-pointer"
      >
        <BrainCircuit size={13} className="text-purple-500" />
        <span className="font-semibold">{isOpen ? 'Hide Reasoning' : 'Show Reasoning'}</span>
        {isOpen ? <ChevronUp size={12} className="text-zinc-400" /> : <ChevronDown size={12} className="text-zinc-400" />}
      </button>

      {isOpen && (
        <div className="mt-2.5 p-3.5 rounded-xl bg-purple-50/30 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/40 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center space-x-1.5 text-purple-700 dark:text-purple-300 font-bold text-[11px] mb-2 pb-1.5 border-b border-purple-200/40 dark:border-purple-900/40">
            <Sparkles size={12} />
            <span>Multi-Agent Triage Reasoning</span>
          </div>
          <div className="markdown-prose text-xs leading-relaxed text-zinc-800 dark:text-zinc-200">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {reasoning}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}

function renderItemBadge(item) {
  const name = typeof item === 'string' ? item : item.name;
  const type = typeof item === 'string' ? 'tool' : item.type;

  if (type === 'sop') {
    return (
      <span 
        key={name} 
        className="px-1.5 py-0.5 rounded-full text-[8.5px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center space-x-1"
        title={`Standard Operating Procedure: ${name}`}
      >
        <span className="opacity-60 text-[7.5px] uppercase font-bold">sop:</span>
        <span>{name}</span>
      </span>
    );
  }
  if (type === 'skill') {
    return (
      <span 
        key={name} 
        className="px-1.5 py-0.5 rounded-full text-[8.5px] font-medium bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 flex items-center space-x-1"
        title={`Custom Skill: ${name}`}
      >
        <span className="opacity-60 text-[7.5px] uppercase font-bold">skill:</span>
        <span>{name}</span>
      </span>
    );
  }
  return (
    <span 
      key={name} 
      className="px-1.5 py-0.5 rounded-full text-[8.5px] font-medium bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20 flex items-center space-x-1"
      title={`Agent Tool: ${name}`}
    >
      <span className="opacity-60 text-[7.5px] uppercase font-bold">tool:</span>
      <span>{name}</span>
    </span>
  );
}

function LiveHierarchicalTimeline({ activeStepIndex, onStop }) {
  return (
    <div className="w-full max-w-2xl py-2 px-1 space-y-3 font-mono animate-in fade-in duration-200 text-zinc-600 dark:text-zinc-400">
      {/* Header bar */}
      <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="flex items-center space-x-2">
          <Loader2 size={13} className="animate-spin text-blue-500" />
          <span className="font-bold text-zinc-700 dark:text-zinc-300 text-xs">
            Multi-Agent Diagnostic Execution in Progress
          </span>
          <span className="px-2 py-0.5 rounded-full text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border border-blue-500/20">
            Resolve Squad
          </span>
        </div>
        
        <button
          onClick={onStop}
          className="flex items-center space-x-1 px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 text-[10px] font-semibold transition-colors cursor-pointer"
          title="Stop Process Immediately"
        >
          <Square size={9} className="fill-current" />
          <span>Stop</span>
        </button>
      </div>

      {/* Hierarchical Steps List (Direct text with fade-in, not in a balloon) */}
      <div className="space-y-3 relative pl-3.5 border-l-2 border-zinc-200/80 dark:border-zinc-800/80">
        {RESOLVE_HIERARCHY_STEPS.map((step, idx) => {
          if (idx > activeStepIndex) return null; // reveal as step occurs
          const isCurrent = idx === activeStepIndex;
          const isCompleted = idx < activeStepIndex;

          return (
            <div 
              key={step.id} 
              className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300"
            >
              <div className="flex items-center justify-between text-xs -ml-[21px]">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  {isCompleted ? (
                    <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 bg-surface-light dark:bg-[#09090b]" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin flex-shrink-0 bg-surface-light dark:bg-[#09090b]" />
                  )}
                  <span className={`font-bold ${isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
                    Step {idx + 1}: {step.title}
                  </span>
                  
                  {/* Agent Tag (Muted Blue Rounded) */}
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-2xs">
                    {step.agent}
                  </span>
                </div>
              </div>

              {/* Tools, Skills & SOPs Tags (Color Differentiated Muted Rounded) */}
              {step.items && step.items.length > 0 && (
                <div className="flex flex-wrap gap-1 pl-4 pt-0.5">
                  {step.items.map(renderItemBadge)}
                </div>
              )}

              {/* Sub-steps nested list */}
              <div className="pl-4 space-y-0.5 text-[10.5px] text-zinc-500 dark:text-zinc-400">
                {step.subSteps.map((sub, sIdx) => (
                  <div key={sIdx} className="flex items-center space-x-1.5 animate-in fade-in duration-200">
                    <span className="text-zinc-400 text-[9px]">↳</span>
                    <span>{sub}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CollapsedExecutionTimeline({ traces, latencyMs }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const agentCount = RESOLVE_HIERARCHY_STEPS.length;
  const seconds = latencyMs > 0 ? (latencyMs / 1000).toFixed(2) + 's' : '0.00s';

  return (
    <div className="w-full max-w-3xl my-1 font-mono text-xs opacity-75 hover:opacity-100 transition-opacity">
      <div className="rounded-xl border border-zinc-200/40 dark:border-zinc-800/40 bg-zinc-50/30 dark:bg-[#111114]/30 p-2.5 transition-all text-zinc-500 dark:text-zinc-400">
        {/* Collapsed Low-Contrast Bar Trigger */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-left cursor-pointer group"
          title={isExpanded ? "Collapse execution steps" : "Expand execution steps"}
        >
          {/* Title Bar: Only agent count and execution time in seconds */}
          <div className="flex items-center space-x-2 text-[10.5px] flex-1 min-w-0">
            <span className="p-0.5 rounded bg-zinc-200/30 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 text-[10px]">
              ⚡
            </span>
            <span className="font-semibold text-zinc-600 dark:text-zinc-400">
              {agentCount} agents invoked • {seconds}
            </span>
          </div>

          {/* Chevron Only (No Text) */}
          <div className="p-1 rounded hover:bg-zinc-200/30 dark:hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors flex-shrink-0 ml-2">
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </button>

        {/* Expanded Hierarchical Steps Tree */}
        {isExpanded && (
          <div className="mt-2.5 pt-2.5 border-t border-zinc-200/30 dark:border-zinc-800/30 space-y-2.5 pl-3.5 relative border-l-2 border-zinc-200/40 dark:border-zinc-800/40 ml-1 animate-in fade-in duration-150">
            {RESOLVE_HIERARCHY_STEPS.map((step, idx) => {
              const matchedTrace = (traces || []).find(t => t.agent === step.agent);
              const traceLatency = matchedTrace?.latency_ms ? `${matchedTrace.latency_ms}ms` : null;

              return (
                <div key={step.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs -ml-[21px]">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <CheckCircle2 size={13} className="text-emerald-500/80 flex-shrink-0 bg-surface-light dark:bg-[#111114]" />
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        Step {idx + 1}: {step.title}
                      </span>
                      
                      {/* Agent Tag (Muted Blue Rounded) */}
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-2xs">
                        {step.agent}
                      </span>
                    </div>
                    {traceLatency && (
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {traceLatency}
                      </span>
                    )}
                  </div>

                  {/* Tools, Skills & SOPs Tags (Color Differentiated Muted Rounded) */}
                  {step.items && step.items.length > 0 && (
                    <div className="flex flex-wrap gap-1 pl-4 pt-0.5">
                      {step.items.map(renderItemBadge)}
                    </div>
                  )}

                  {/* Sub-steps */}
                  <div className="pl-4 space-y-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                    {step.subSteps.map((sub, sIdx) => (
                      <div key={sIdx} className="flex items-center space-x-1.5">
                        <span className="text-zinc-400 text-[9px]">↳</span>
                        <span>{sub}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
