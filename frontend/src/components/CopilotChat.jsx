import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  CheckCircle2,
  Copy,
  Check,
  Lock
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
    id: 'pii_inbound',
    agent: 'PIISanitizerAgent',
    stage: 'inbound',
    title: 'Tier 0 Data Privacy & Inbound Tokenization',
    items: [
      { name: 'pii_sanitizer_perimeter', type: 'skill' },
      { name: 'gliner_cpu_ner', type: 'tool' },
      { name: 'luhn_card_validator', type: 'tool' },
      { name: 'session_token_vault', type: 'skill' }
    ],
    subSteps: [
      'Scanning prompt for customer identities (names, emails, phones, addresses)',
      'Executing on-premise zero-GPU regex and offline GLiNER NER model',
      'Replacing sensitive PII with typed placeholders (<PII_NAME_1>, <PII_EMAIL_1>)'
    ]
  },
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
      'Synthesizing operational summaries for L1 Floor Ops, L2 Support, and L3 SME',
      'Constructing deep multi-agent triage reasoning and decision trace'
    ]
  },
  {
    id: 'pii_outbound',
    agent: 'PIISanitizerAgent',
    stage: 'outbound',
    title: 'Tier 0 De-tokenization & Data Restoration',
    items: [
      { name: 'pii_detokenizer', type: 'skill' },
      { name: 'session_vault_lookup', type: 'tool' },
      { name: 'on_premise_restoration', type: 'skill' }
    ],
    subSteps: [
      'Intercepting external LLM response containing <PII_...> placeholders',
      'Resolving ephemeral in-memory session vault mapping',
      'Backfilling placeholders with original customer data for local IT display'
    ]
  }
];

const ASK_HIERARCHY_STEPS = [
  {
    id: 'pii_inbound',
    agent: 'PIISanitizerAgent',
    stage: 'inbound',
    title: 'Tier 0 Data Privacy & Inbound Tokenization',
    items: [
      { name: 'pii_sanitizer_perimeter', type: 'skill' },
      { name: 'gliner_cpu_ner', type: 'tool' },
      { name: 'session_token_vault', type: 'skill' }
    ],
    subSteps: [
      'Scanning prompt for customer identities (names, emails, phones, addresses)',
      'Executing on-premise zero-GPU regex and offline GLiNER NER model',
      'Replacing sensitive PII with typed placeholders (<PII_NAME_1>, <PII_EMAIL_1>)'
    ]
  },
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
      'Classifying intent as General Process / Schema Inquiry',
      'Detecting target domain (Inbound, Outbound, Inventory)'
    ]
  },
  {
    id: 'domain_graph',
    agent: 'DomainKnowledgeAgent',
    title: 'Neo4j Domain Graph & Schema Traversal',
    items: [
      { name: 'neo4j_cypher_reader', type: 'tool' },
      { name: 'domain_entity_mapper', type: 'skill' },
      { name: 'wms_schema_catalog', type: 'tool' }
    ],
    subSteps: [
      'Querying Neo4j domain graph for entities, tables, columns, and relationships',
      'Scoring table relevance against domain operational taxonomy',
      'Filtering core schema definitions for architectural synthesis'
    ]
  },
  {
    id: 'flowchart_synth',
    agent: 'AskProcessAgent',
    title: 'Process Architecture & Interactive Flowchart Synthesis',
    items: [
      { name: 'mermaid_flow_generator', type: 'skill' },
      { name: 'process_step_builder', type: 'tool' },
      { name: 'markdown_prose_engine', type: 'skill' }
    ],
    subSteps: [
      'Structuring sequential multi-stage lifecycle steps',
      'Synthesizing interactive Mermaid flowchart and architectural diagrams',
      'Assembling comprehensive operational guide with table & column mappings'
    ]
  },
  {
    id: 'pii_outbound',
    agent: 'PIISanitizerAgent',
    stage: 'outbound',
    title: 'Tier 0 De-tokenization & Data Restoration',
    items: [
      { name: 'pii_detokenizer', type: 'skill' },
      { name: 'session_vault_lookup', type: 'tool' }
    ],
    subSteps: [
      'Intercepting response containing placeholder tokens',
      'Resolving ephemeral in-memory session vault mapping',
      'Restoring sanitized entities for local operational display'
    ]
  }
];

const ALL_STEP_DEFINITIONS = [...RESOLVE_HIERARCHY_STEPS, ...ASK_HIERARCHY_STEPS];

function getEnrichedStep(step) {
  if (!step) return { title: 'Executing Agent', items: [], subSteps: [] };
  const match = ALL_STEP_DEFINITIONS.find(def => {
    if (step.agent === 'PIISanitizerAgent') {
      if (step.stage) return def.agent === step.agent && def.stage === step.stage;
      if (step.step_number && step.step_number <= 2) return def.id === 'pii_inbound';
      return def.id === 'pii_outbound';
    }
    return def.agent === step.agent || def.title === step.title || (def.id && step.agent && step.agent.toLowerCase().includes(def.id));
  });

  return {
    ...step,
    title: step.title || match?.title || step.agent || 'Executing Step',
    items: step.items || match?.items || [],
    subSteps: step.subSteps || match?.subSteps || (step.title ? [`Processing ${step.title}`] : ['Executing operational step']),
  };
}

const WITTY_NEW_CHAT_PLACEHOLDERS = [
  "what are you planning to fix today? (or break differently?)",
  "which production bug is pretending to be a feature today?",
  "drop the order ID before someone pages the VP on-call...",
  "what mysterious deadlock are we blaming on network latency today?",
  "paste the error message your team lead said was 'just a transient glitch'...",
  "what are we troubleshooting today before management notices?",
  "which wave failed this time? (don't worry, Tier 2 AST won't let you DROP TABLE)...",
  "tell me what's broken — I promise not to reply with 'works on my machine'...",
  "what supply chain mystery are we solving before coffee gets cold?",
  "enter the stuck order ID... let's find out who pushed to prod on Friday...",
  "which warehouse queue is testing your patience today?",
  "what inventory discrepancy are we hiding from the auditors today?",
  "describe the issue... I'll translate it to SQL without the existential dread...",
  "what are you trying to fix today?",
  "type the incident here before the SLA timer turns bright red...",
  "what unexpected database drama are we investigating today?",
  "what order is stuck in the twilight zone of warehouse statuses?",
  "tell me the error code your senior dev stared at for 3 hours...",
];

export default function CopilotChat({ isActive, initialPersona = 'ask', sessionId, onSessionUpdated }) {
  const { 
    enableAskMode = false, 
    enableFileUpload = false, 
    enableShowReasoning = false, 
    enableChatFollowup = false 
  } = useSettings() || {};
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
  const [liveStreamSteps, setLiveStreamSteps] = useState([]);
  const [activeFeedbackId, setActiveFeedbackId] = useState(null);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false);

  // Random witty placeholder for new chat splash
  const [randomPlaceholder, setRandomPlaceholder] = useState(() => {
    return WITTY_NEW_CHAT_PLACEHOLDERS[Math.floor(Math.random() * WITTY_NEW_CHAT_PLACEHOLDERS.length)];
  });

  // Re-roll a witty placeholder on new chat splash render or session reset
  useEffect(() => {
    if (messages.length === 0) {
      setRandomPlaceholder(
        WITTY_NEW_CHAT_PLACEHOLDERS[Math.floor(Math.random() * WITTY_NEW_CHAT_PLACEHOLDERS.length)]
      );
    }
  }, [sessionId, messages.length]);

  // Document Ingestion & Enrichment State
  const [isEnrichmentModalOpen, setIsEnrichmentModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressStep, setUploadProgressStep] = useState(0);
  const [uploadResult, setUploadResult] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [uploadError, setUploadError] = useState(null);
  
  const messagesEndRef = useRef(null);
  const chatScrollContainerRef = useRef(null);
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
      if (!sessionId) {
        setMessages([]);
        setInput('');
        setLiveStreamSteps([]);
        return;
      }
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
          setInput('');
          setLiveStreamSteps([]);
        }
      } catch (err) {
        // Fresh or unpersisted new session: cleanly reset chat state
        setMessages([]);
        setInput('');
        setLiveStreamSteps([]);
      }
    };
    loadSession();
  }, [sessionId]);

  // Auto-scroll chat to top of the most recent section in real time
  const scrollToMostRecentSection = (behavior = 'smooth') => {
    if (!chatScrollContainerRef.current) return;
    const container = chatScrollContainerRef.current;

    if (isLoading) {
      const liveSection = container.querySelector('[data-chat-checkpoint="live-process"]');
      if (liveSection) {
        liveSection.scrollIntoView({ behavior, block: 'start' });
        return;
      }
    }

    const allMsgElements = container.querySelectorAll('[data-chat-checkpoint]');
    if (allMsgElements.length > 0) {
      const lastEl = allMsgElements[allMsgElements.length - 1];
      if (lastEl) {
        lastEl.scrollIntoView({ behavior, block: 'start' });
      }
    }
  };

  useEffect(() => {
    scrollToMostRecentSection();
  }, [messages, isLoading, liveStreamSteps.length]);

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
      setIsLoading(false);
      setLiveStreamSteps([]);
    }
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
    setLiveStreamSteps([]);
    syncUrl(persona, activeSessionId);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Stream real-time events from server — zero hardcoded loops or artificial delays
      const response = await api.streamTriage(
        queryToSend, 
        activeSessionId, 
        persona, 
        (frame) => {
          if (frame.event === 'step' && frame.data) {
            setLiveStreamSteps(prev => {
              const existingIdx = prev.findIndex(
                s => s.step_number === frame.data.step_number || (s.agent === frame.data.agent && s.agent !== 'PIISanitizerAgent')
              );
              if (existingIdx >= 0) {
                const copy = [...prev];
                copy[existingIdx] = { ...copy[existingIdx], ...frame.data };
                return copy;
              }
              return [...prev, frame.data];
            });
          }
        }, 
        controller.signal, 
        enableChatFollowup
      );

      const assistantMessage = {
        id: response?.session_id || Date.now().toString(),
        role: 'assistant',
        content: response,
        userQuery: queryToSend,
        feedbackStatus: null,
        isNew: true,
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
      return <UserMessageContent text={userText} />;
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
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>{content}</ReactMarkdown>
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

        {/* Standalone Primary Diagnostic SQL fallback if no investigation steps */}
        {(() => {
          const rawSql = content.diagnostic_sql?.display_sql || content.diagnostic_sql?.validated_sql || content.diagnostic_sql?.sql;
          if (rawSql && (!content.investigation_steps || content.investigation_steps.length === 0)) {
            return (
              <div className="pt-2">
                <CodeCard 
                  code={rawSql} 
                  language="sql" 
                  title="Oracle Diagnostic Query (Tier 2 AST Validated)" 
                />
              </div>
            );
          }
          return null;
        })()}

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
              className={`p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${
                msg.feedbackStatus === 'positive' ? 'text-emerald-500' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
              title="Helpful & Accurate"
            >
              <ThumbsUp size={13} />
            </button>
            <button
              onClick={() => handleFeedback(msg.id, 'negative', msg)}
              className={`p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${
                msg.feedbackStatus === 'negative' ? 'text-rose-500' : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
              title="Inaccurate or Unhelpful"
            >
              <ThumbsDown size={13} />
            </button>
            <button
              onClick={() => openFeedbackModal(msg.id)}
              className="px-2 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 transition-colors ml-1 cursor-pointer"
            >
              Feedback
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
            
            {/* Very Large Bold Screen-Adjusting Title with Flickering Underscore Cursor */}
            <div className="w-full pb-2">
              <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tighter font-mono text-zinc-900 dark:text-zinc-100 select-none inline-flex items-baseline justify-center">
                <span>yonder</span>
                <span className="cursor-flicker text-blue-600 dark:text-blue-400 font-extrabold inline-block mx-[0.5px]">_</span>
                <span>graph</span>
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
                  placeholder={randomPlaceholder}
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
        <div className="w-full max-w-3xl mx-auto flex-1 flex flex-col h-full overflow-hidden px-3 sm:px-6 relative">
          
          {/* Messages Stream Area with Centrally Aligned Checkpoint Scroller */}
          <div className="flex-1 relative overflow-hidden flex flex-col min-h-0">
            <div 
              ref={chatScrollContainerRef}
              className="flex-1 overflow-y-auto py-4 sm:py-6 pr-8 sm:pr-10 space-y-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                const isAssistant = msg.role === 'assistant';
                const showTimeline = isAssistant && (msg.content?.persona === 'resolve' || msg.content?.investigation_steps || msg.content?.agent_traces);
                const summaryPreview = extractSummarySentences(msg.content, msg.role);

                return (
                  <React.Fragment key={msg.id || idx}>
                    {/* Collapsed Low-Contrast Timeline Box (Stays between user query and final response) */}
                    {showTimeline && (
                      <div 
                        data-chat-checkpoint={`timeline-${idx}`}
                        data-chat-role="agent-loop"
                        data-chat-preview={`Agent Execution Loop: ${RESOLVE_HIERARCHY_STEPS.length} specialist agents coordinated multi-stage root cause diagnosis, policy validation, and privacy tokenization in ${msg.content?.total_latency_ms ? (msg.content.total_latency_ms / 1000).toFixed(2) + 's' : 'real-time'}.`}
                        className="w-full flex justify-start"
                      >
                        <CollapsedExecutionTimeline 
                          traces={msg.content?.agent_traces} 
                          latencyMs={msg.content?.total_latency_ms} 
                        />
                      </div>
                    )}

                    <div 
                      data-chat-checkpoint={idx}
                      data-chat-role={msg.role}
                      data-chat-preview={summaryPreview}
                      className={`w-full flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
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
              
              {/* Live Hierarchical Timeline during execution (Rendered dynamically from real-time backend stream events) */}
              {isLoading && (
                <div 
                  data-chat-checkpoint="live-process"
                  data-chat-role="assistant"
                  data-chat-preview="Multi-Agent Diagnostic in Progress..."
                  className="w-full flex justify-start"
                >
                  <LiveHierarchicalTimeline 
                    steps={liveStreamSteps} 
                    onStop={handleStopProcess} 
                  />
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Dynamic Minimalist Checkpoint Scroller with Chevrons & Interactive Dots (Vertically centrally aligned with 50px padding) */}
            <DynamicCheckpointScroller 
              containerRef={chatScrollContainerRef} 
              messages={messages} 
              isLoading={isLoading} 
            />
          </div>

          {/* Input Bar (Bottom-aligned during active chat) */}
          <div className="py-3 sm:py-4 flex-shrink-0">
            {/* Follow-up Policy Restriction Banner */}
            {!enableChatFollowup && !isLoading && (
              <div className="mb-2 p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono text-zinc-600 dark:text-zinc-400 flex items-center justify-between shadow-2xs">
                <div className="flex items-center space-x-1.5 min-w-0">
                  <Lock size={12} className="text-zinc-500 flex-shrink-0" />
                  <span className="truncate">Single-turn triage active. Follow-ups disabled.</span>
                </div>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950/80 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 font-bold flex-shrink-0 ml-2">
                  Context Guard
                </span>
              </div>
            )}

            <form 
              onSubmit={(e) => { 
                e.preventDefault(); 
                if (!enableChatFollowup && messages.length > 0) return;
                handleSubmit(e); 
              }} 
              className={`relative flex items-end bg-white dark:bg-[#111114] border rounded-xl shadow-xs transition-all p-1.5 ${
                !enableChatFollowup 
                  ? 'border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-[#0c0c0f]' 
                  : 'border-zinc-300 dark:border-zinc-800 focus-within:border-zinc-500 dark:focus-within:border-zinc-600'
              }`}
            >
              <textarea
                ref={textareaRef}
                value={input}
                disabled={!enableChatFollowup && messages.length > 0}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!enableChatFollowup && messages.length > 0) return;
                    handleSubmit(e);
                  }
                }}
                placeholder={
                  !enableChatFollowup && messages.length > 0
                    ? "follow-up questions disabled in single-turn triage mode..."
                    : (persona === 'ask'
                        ? "ask a follow-up process question, table schema, or flow..."
                        : "ask a follow-up question or probe deeper into this incident...")
                }
                className={`w-full bg-transparent border-0 py-2 px-2.5 pr-10 text-xs font-mono text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-600 outline-none resize-none custom-scrollbar leading-[1.35rem] ${
                  !enableChatFollowup && messages.length > 0 ? 'cursor-not-allowed opacity-60' : ''
                }`}
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
                  onClick={(e) => {
                    if (!enableChatFollowup && messages.length > 0) return;
                    handleSubmit(e);
                  }}
                  disabled={!input.trim() || (!enableChatFollowup && messages.length > 0)}
                  className="absolute right-2 bottom-2 p-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-950 rounded hover:opacity-90 disabled:opacity-30 transition-opacity flex-shrink-0"
                  title={!enableChatFollowup && messages.length > 0 ? "Follow-ups disabled" : "Submit (Enter)"}
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
              <span className="text-[10px] text-zinc-400 dark:text-zinc-600">
                {!enableChatFollowup && messages.length > 0
                  ? "Single-turn policy"
                  : "Press Enter ↵ to send"}
              </span>
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

const chatMarkdownComponents = {
  h1: ({ children }) => <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-3.5 mb-1.5 pb-1 border-b border-zinc-200 dark:border-zinc-800">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 mt-3 mb-1.5 pb-1 border-b border-zinc-200/60 dark:border-zinc-800/60">{children}</h2>,
  h3: ({ children }) => <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-2.5 mb-1">{children}</h3>,
  h4: ({ children }) => <h4 className="text-[11.5px] font-bold text-zinc-700 dark:text-zinc-300 mt-2 mb-1">{children}</h4>,
  p: ({ children }) => <p className="mb-2.5 last:mb-0 leading-relaxed text-zinc-800 dark:text-zinc-200">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-outside pl-4 mb-2.5 space-y-1 text-zinc-800 dark:text-zinc-200">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-outside pl-4 mb-2.5 space-y-1 text-zinc-800 dark:text-zinc-200">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  table: ({ children }) => (
    <div className="my-3 overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40">
      <table className="w-full text-[11px] font-mono border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-zinc-100/90 dark:bg-zinc-800/90 border-b border-zinc-200 dark:border-zinc-700">{children}</thead>,
  th: ({ children }) => <th className="px-3 py-1.5 text-left font-bold text-[10px] uppercase tracking-wider text-zinc-700 dark:text-zinc-300">{children}</th>,
  td: ({ children }) => <td className="px-3 py-1.5 border-t border-zinc-100 dark:border-zinc-800/60 text-zinc-700 dark:text-zinc-300">{children}</td>,
  code: ({ inline, className, children, ...props }) => {
    const match = /language-(\w+)/.exec(className || '');
    const codeString = String(children).replace(/\n$/, '');
    if (!inline && (match || codeString.includes('\n'))) {
      return (
        <div className="my-2.5">
          <CodeCard
            code={codeString}
            language={match ? match[1] : 'sql'}
            title={match ? `${match[1].toUpperCase()} Code Block` : 'Diagnostic SQL Query'}
          />
        </div>
      );
    }
    return (
      <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-blue-600 dark:text-blue-400 font-mono text-[11px] border border-zinc-200 dark:border-zinc-700" {...props}>
        {children}
      </code>
    );
  },
  blockquote: ({ children }) => <blockquote className="border-l-2 border-blue-500 pl-3 py-1 my-2 bg-blue-50/40 dark:bg-blue-950/20 text-zinc-700 dark:text-zinc-300 italic rounded-r">{children}</blockquote>,
};

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
              className={`px-2.5 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
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
              className={`px-2.5 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
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
              className={`px-2.5 py-0.5 rounded-md font-medium transition-all cursor-pointer ${
                selectedPersona === 'l3'
                  ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 font-bold shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
              title="L3 SME / DBAs View"
            >
              L3 SME
            </button>
          </div>
        </div>
      )}

      {/* Tier 0 PII Perimeter Warning Callout */}
      {content?.pii_interception?.has_pii && (
        <div className="flex items-start space-x-2.5 p-3 rounded-lg border border-amber-300/80 dark:border-amber-900/60 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs font-mono">
          <ShieldAlert size={15} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center space-x-1.5 flex-wrap">
              <span className="font-bold tracking-tight">Tier 0 Data Privacy Warning:</span>
              <span className="px-1.5 py-0.2 rounded text-[9.5px] font-bold bg-amber-200/80 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                {content.pii_interception.masked_count} PII Item(s) Filtered
              </span>
            </div>
            <p className="text-[11px] text-amber-800/90 dark:text-amber-300/90 leading-relaxed font-sans">
              Sensitive customer details (name, email, phone, physical address) were masked on-premise prior to external AI reasoning and securely restored for local operational view.
            </p>
            {content.pii_interception.masked_entities && content.pii_interception.masked_entities.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {content.pii_interception.masked_entities.map((ent, eIdx) => (
                  <span key={eIdx} className="px-1.5 py-0.5 rounded text-[9.5px] font-mono bg-white/80 dark:bg-black/40 text-amber-800 dark:text-amber-300 border border-amber-300/60 dark:border-amber-800/60">
                    <strong className="opacity-75">{ent.type}:</strong> {ent.preview || ent.token}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rendered Markdown Text */}
      <div className="markdown-prose text-xs leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>
          {currentText}
        </ReactMarkdown>
      </div>
    </div>
  );
}

function formatReasoningBlocks(rawText) {
  if (!rawText || typeof rawText !== 'string') return [];

  let text = rawText.trim();

  // 1. Separate inline category emojis or headers if joined without newlines
  text = text.replace(/([.!?])\s*([🎯📖🔍🛡️⚡⚖️🔒✨🚀💡])/g, '$1\n\n$2');
  text = text.replace(/([.!?])\s*(?=[-•*]?\s*\*\*(?:Intent|Knowledge|SOP|SQL|AST|Governance|Safety|Investigation|Triage|Humanizing|Data Privacy|Privacy|PII))/gi, '$1\n\n');

  // 2. Split on double newlines or lines starting with bullet/emoji/header
  let rawBlocks = text.split(/\n\s*\n+/).map(s => s.trim()).filter(Boolean);

  // If there's only 1 block but contains multiple emojis or bulleted points, split by bullet / emoji
  if (rawBlocks.length === 1) {
    const splitRegex = /(?=(?:^|\n)\s*(?:[-*•]\s*)?(?:[🎯📖🔍🛡️⚡⚖️🔒✨🚀💡]|###|\*\*[^*]+?\*\*:?))/;
    const splitItems = text.split(splitRegex).map(s => s.trim()).filter(Boolean);
    if (splitItems.length > 1) {
      rawBlocks = splitItems;
    }
  }

  // If still 1 block and contains inline emojis
  if (rawBlocks.length === 1) {
    const emojiRegex = /(?=[🎯📖🔍🛡️⚡⚖️🔒✨🚀💡])/;
    const emojiBlocks = text.split(emojiRegex).map(s => s.trim()).filter(Boolean);
    if (emojiBlocks.length > 1) {
      rawBlocks = emojiBlocks;
    }
  }

  return rawBlocks.map((block) => {
    // Clean block from leading bullets, markdown hashes, and emojis
    let cleaned = block
      .replace(/^[-*•]\s*/, '')
      .replace(/^#+\s*/, '')
      .replace(/^[🎯📖🔍🛡️⚡⚖️🔒✨🚀💡🔹]\s*/, '')
      .trim();

    // Detect Title
    let title = null;
    let body = cleaned;

    const boldTitleMatch = cleaned.match(/^\*\*([^*]+?)\*\*[:\s—-]*(.*)$/s);
    if (boldTitleMatch) {
      title = boldTitleMatch[1].replace(/[:\s—-]+$/, '').trim();
      body = boldTitleMatch[2].trim();
    } else {
      const colonTitleMatch = cleaned.match(/^([^:\n]{3,50}):\s+(.*)$/s);
      if (colonTitleMatch && !colonTitleMatch[1].includes('.')) {
        title = colonTitleMatch[1].trim();
        body = colonTitleMatch[2].trim();
      }
    }

    if (title) {
      // Strip any markdown or emoji characters from the title
      title = title
        .replace(/[*_~`#]/g, '')
        .replace(/[🎯📖🔍🛡️⚡⚖️🔒✨🚀💡🔹]/g, '')
        .replace(/^[-•*:]+\s*/, '')
        .replace(/[:\s—-]+$/, '')
        .trim();
    }

    // Strip leading emoji from body if any remain
    body = body.replace(/^[🎯📖🔍🛡️⚡⚖️🔒✨🚀💡🔹]\s*/, '').trim();

    return {
      title,
      body: body || cleaned
    };
  });
}

function ReasoningSection({ reasoning, isEnabled }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!isEnabled || !reasoning || !reasoning.trim()) return null;

  const blocks = formatReasoningBlocks(reasoning);

  return (
    <div className="pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800/80 font-mono">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-blue-50/60 hover:bg-blue-100/80 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 text-[11px] text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-800/60 transition-colors cursor-pointer"
      >
        <BrainCircuit size={13} className="text-blue-500" />
        <span className="font-semibold">{isOpen ? 'Hide Reasoning' : 'Show Reasoning'}</span>
        {isOpen ? <ChevronUp size={12} className="text-blue-400" /> : <ChevronDown size={12} className="text-blue-400" />}
      </button>

      {isOpen && (
        <div className="mt-2.5 p-3.5 rounded-xl bg-blue-50/30 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/40 text-xs animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="flex items-center space-x-1.5 text-blue-700 dark:text-blue-300 font-bold text-[11px] mb-3 pb-2 border-b border-blue-200/40 dark:border-blue-900/40">
            <Sparkles size={12} />
            <span>Multi-Agent Triage Reasoning</span>
          </div>

          <div className="space-y-3.5 pt-0.5">
            {blocks.map((block, idx) => (
              <div key={idx} className="space-y-1">
                {block.title && (
                  <div className="text-xs font-bold text-blue-900 dark:text-blue-200">
                    {block.title}
                  </div>
                )}
                <div className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm]}
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                      code: ({ children }) => (
                        <code className="px-1.5 py-0.5 rounded bg-blue-100/70 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300 text-[10.5px] font-mono border border-blue-200/50 dark:border-blue-800/50">
                          {children}
                        </code>
                      )
                    }}
                  >
                    {block.body}
                  </ReactMarkdown>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function renderItemBadge(item) {
  const name = typeof item === 'string' ? item : item.name;
  const type = typeof item === 'string' ? 'tool' : item.type;
  const prefix = type === 'sop' ? 'sop:' : type === 'skill' ? 'skill:' : 'tool:';

  return (
    <span 
      key={name} 
      className="px-1.5 py-0.5 rounded-full text-[8.5px] font-medium bg-zinc-100 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 border border-zinc-400 dark:border-zinc-600 flex items-center space-x-1 shadow-2xs"
      title={`${type.toUpperCase()}: ${name}`}
    >
      <span className="opacity-60 text-[7.5px] uppercase font-bold">{prefix}</span>
      <span>{name}</span>
    </span>
  );
}

function SequentialStepPrinter({ step, idx, isCurrent, isCompleted }) {
  // activeLine: 0 = title, 1..N = subSteps[0..N-1], N+1 = completed
  const [activeLine, setActiveLine] = useState(isCurrent ? 0 : 9999);

  useEffect(() => {
    if (isCurrent) {
      setActiveLine(0);
    }
  }, [isCurrent]);

  return (
    <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center justify-between text-xs -ml-[21px]">
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          {isCompleted ? (
            <CheckCircle2 size={14} className="text-emerald-500 flex-shrink-0 bg-surface-light dark:bg-[#09090b]" />
          ) : (
            <div className="w-3.5 h-3.5 rounded-full border-2 border-blue-500 border-t-transparent animate-spin flex-shrink-0 bg-surface-light dark:bg-[#09090b]" />
          )}
          <span className={`font-bold ${isCurrent ? 'text-blue-600 dark:text-blue-400' : 'text-zinc-700 dark:text-zinc-300'}`}>
            Step {idx + 1}: {isCurrent && activeLine === 0 ? (
              <TypewriterText 
                text={step.title} 
                speed={10} 
                onComplete={() => setActiveLine(1)} 
              />
            ) : (
              step.title
            )}
          </span>
          
          {/* Agent Tag (Muted Grey Rounded) */}
          <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-zinc-100 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 border border-zinc-400 dark:border-zinc-600 shadow-2xs">
            {step.agent}
          </span>
        </div>
      </div>

      {/* Tools, Skills & SOPs Tags (Uniform Grey Rounded) */}
      {step.items && step.items.length > 0 && (activeLine > 0 || isCompleted) && (
        <div className="flex flex-wrap gap-1 pl-4 pt-0.5 animate-in fade-in slide-in-from-top-1 duration-150">
          {step.items.map(renderItemBadge)}
        </div>
      )}

      {/* Sub-steps nested list - Strictly rendered and typed ONE LINE AT A TIME */}
      <div className="pl-4 space-y-0.5 text-[10.5px] text-zinc-500 dark:text-zinc-400">
        {step.subSteps.map((sub, sIdx) => {
          const currentSubLine = sIdx + 1;
          if (isCurrent && activeLine < currentSubLine) return null;

          const isThisSubTyping = isCurrent && activeLine === currentSubLine;

          return (
            <div key={sIdx} className="flex items-center space-x-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
              <span className="text-zinc-400 text-[9px]">↳</span>
              {isThisSubTyping ? (
                <TypewriterText 
                  text={sub} 
                  speed={12} 
                  onComplete={() => setActiveLine(prev => prev + 1)} 
                />
              ) : (
                <span>{sub}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LiveHierarchicalTimeline({ steps, onStop }) {
  const displaySteps = steps && steps.length > 0 ? steps : [
    { step_number: 1, agent: "ContextManagementAgent", title: "Session Context & Multi-Turn Policy Guard", status: "running" }
  ];

  return (
    <div className="w-full max-w-2xl py-2 px-1 space-y-3 font-mono animate-in fade-in duration-200 text-zinc-600 dark:text-zinc-400">
      {/* Header bar */}
      <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-200/50 dark:border-zinc-800/50">
        <div className="flex items-center space-x-2">
          <Loader2 size={13} className="animate-spin text-blue-500" />
          <span className="font-bold text-zinc-700 dark:text-zinc-300 text-xs">
            Multi-Agent Real-Time Execution
          </span>
          <span className="px-2 py-0.5 rounded-full text-[9px] bg-zinc-100 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-400 dark:border-zinc-600 shadow-2xs">
            Live Stream
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

      {/* Real-Time Hierarchical Stream Steps List with Sub-Tasks */}
      <div className="space-y-3 relative pl-3.5 border-l-2 border-zinc-200/80 dark:border-zinc-800/80">
        {displaySteps.map((step, idx) => {
          const enriched = getEnrichedStep(step);
          const isCompleted = step.status === 'completed';
          const isCurrent = step.status === 'running' || (!isCompleted && idx === displaySteps.length - 1);

          return (
            <SequentialStepPrinter 
              key={step.step_number || idx} 
              step={enriched} 
              idx={idx} 
              isCurrent={isCurrent} 
              isCompleted={isCompleted} 
            />
          );
        })}
      </div>
    </div>
  );
}

function CollapsedExecutionTimeline({ traces, latencyMs }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const activeTraces = traces && traces.length > 0 ? traces : [];
  const agentCount = activeTraces.length;
  const seconds = latencyMs > 0 ? (latencyMs / 1000).toFixed(2) + 's' : '0.00s';

  if (agentCount === 0) return null;

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
          {/* Title Bar: Actual agent count and execution time in seconds */}
          <div className="flex items-center space-x-2 text-[10.5px] flex-1 min-w-0">
            <span className="p-0.5 rounded bg-zinc-200/30 dark:bg-zinc-800/40 text-zinc-600 dark:text-zinc-400 text-[10px]">
              ⚡
            </span>
            <span className="font-semibold text-zinc-600 dark:text-zinc-400">
              {agentCount} {agentCount === 1 ? 'agent' : 'agents'} invoked • {seconds}
            </span>
          </div>

          {/* Chevron */}
          <div className="p-1 rounded hover:bg-zinc-200/30 dark:hover:bg-zinc-800/40 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors flex-shrink-0 ml-2">
            {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </button>

        {/* Expanded Dynamic Steps Tree from Server Traces */}
        {isExpanded && (
          <div className="mt-2.5 pt-2.5 border-t border-zinc-200/30 dark:border-zinc-800/30 space-y-3 pl-3.5 relative border-l-2 border-zinc-200/40 dark:border-zinc-800/40 ml-1 animate-in fade-in duration-150">
            {activeTraces.map((trace, idx) => {
              const enriched = getEnrichedStep(trace);
              const traceLatency = trace.latency_ms ? `${trace.latency_ms}ms` : null;
              const isPiiMasked = trace.agent === 'PIISanitizerAgent' && trace.stage === 'inbound' && trace.result?.has_pii;
              const isPiiRestored = trace.agent === 'PIISanitizerAgent' && trace.stage === 'outbound' && trace.result?.has_pii;
              const intentResult = trace.result?.intent;
              const domainResult = trace.result?.domain;

              return (
                <div key={idx} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs -ml-[21px]">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <CheckCircle2 size={13} className="text-emerald-500/80 flex-shrink-0 bg-surface-light dark:bg-[#111114]" />
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        Step {idx + 1}: {trace.step || enriched.title || trace.agent}
                      </span>
                      
                      {/* Agent Tag */}
                      <span className="px-2 py-0.5 rounded-full text-[9px] font-semibold bg-zinc-100 dark:bg-zinc-800/90 text-zinc-700 dark:text-zinc-300 border border-zinc-400 dark:border-zinc-600 shadow-2xs">
                        {trace.agent}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5 flex-wrap gap-y-0.5">
                      {isPiiMasked && (
                        <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-400 dark:border-zinc-600">
                          {trace.result.masked_count} PII Masked
                        </span>
                      )}
                      {isPiiRestored && (
                        <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-400 dark:border-zinc-600">
                          {trace.result.restored_count} PII Restored
                        </span>
                      )}
                      {intentResult && (
                        <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-400 dark:border-zinc-600">
                          {intentResult} ({domainResult || 'general'})
                        </span>
                      )}
                      {trace.result?.tables_found !== undefined && (
                        <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-400 dark:border-zinc-600">
                          {trace.result.tables_found} tables mapped
                        </span>
                      )}
                      {trace.result?.sop_id && (
                        <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-400 dark:border-zinc-600">
                          {trace.result.sop_id}
                        </span>
                      )}
                      {trace.result?.tier2_valid !== undefined && (
                        <span className="px-1.5 py-0.2 rounded-full text-[8.5px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-400 dark:border-zinc-600">
                          {trace.result.tier2_valid ? 'AST PASS' : 'AST FAIL'}
                        </span>
                      )}
                      {traceLatency && (
                        <span className="text-[10px] text-zinc-400 font-mono ml-1">
                          {traceLatency}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tools, Skills & SOPs Tags */}
                  {enriched.items && enriched.items.length > 0 && (
                    <div className="flex flex-wrap gap-1 pl-4 pt-0.5">
                      {enriched.items.map(renderItemBadge)}
                    </div>
                  )}

                  {/* Sub-steps */}
                  {enriched.subSteps && enriched.subSteps.length > 0 && (
                    <div className="pl-4 space-y-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">
                      {enriched.subSteps.map((sub, sIdx) => (
                        <div key={sIdx} className="flex items-center space-x-1.5">
                          <span className="text-zinc-400 text-[9px]">↳</span>
                          <span>{sub}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function UserMessageContent({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy user query', err);
    }
  };

  return (
    <div className="relative group/user-content pr-5">
      <div className="text-xs font-mono text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap leading-relaxed">
        {text}
      </div>

      {/* Copy icon inside balloon at bottom right position on hover */}
      <button
        type="button"
        onClick={handleCopy}
        className="absolute right-0 bottom-0 opacity-0 group-hover/user-content:opacity-100 p-1 rounded-md bg-zinc-200/90 hover:bg-zinc-300 dark:bg-zinc-800/90 dark:hover:bg-zinc-700 text-zinc-600 hover:text-blue-600 dark:text-zinc-400 dark:hover:text-blue-400 border border-zinc-300 dark:border-zinc-700 shadow-2xs transition-all duration-150 cursor-pointer"
        title={copied ? "Copied query!" : "Copy user query"}
      >
        {copied ? (
          <Check size={11} className="text-emerald-500" />
        ) : (
          <Copy size={11} />
        )}
      </button>
    </div>
  );
}

function TypewriterText({ text, speed = 12, onComplete }) {
  const [displayedLength, setDisplayedLength] = useState(0);

  useEffect(() => {
    setDisplayedLength(0);
  }, [text]);

  useEffect(() => {
    if (!text) {
      if (onComplete) onComplete();
      return;
    }

    if (displayedLength >= text.length) {
      if (onComplete) onComplete();
      return;
    }

    const timer = setTimeout(() => {
      const step = Math.min(2, text.length - displayedLength);
      const nextLength = displayedLength + step;
      setDisplayedLength(nextLength);
      if (nextLength >= text.length && onComplete) {
        setTimeout(onComplete, 40);
      }
    }, speed);

    return () => clearTimeout(timer);
  }, [displayedLength, text, speed, onComplete]);

  const isTyping = text && displayedLength < text.length;

  return (
    <span>
      {text ? text.slice(0, displayedLength) : ''}
      {isTyping && (
        <span className="inline-block w-1.5 h-3 bg-blue-500 ml-0.5 animate-pulse align-middle" />
      )}
    </span>
  );
}

function TypewriterMarkdown({ text, isNew = false, charSpeed = 8, lineDelay = 26 }) {
  const lines = useMemo(() => (text ? text.split('\n') : []), [text]);
  const [activeLineIdx, setActiveLineIdx] = useState(isNew ? 0 : 999999);
  const [currentCharIdx, setCurrentCharIdx] = useState(isNew ? 0 : 999999);
  const [isSkipped, setIsSkipped] = useState(false);

  useEffect(() => {
    if (!isNew || isSkipped || !text) {
      setActiveLineIdx(lines.length);
      setCurrentCharIdx(0);
      return;
    }

    if (activeLineIdx >= lines.length) {
      return;
    }

    const currentLine = lines[activeLineIdx] || '';

    // If empty line, jump to next line with brief linefeed pause
    if (currentLine.length === 0) {
      const timer = setTimeout(() => {
        setActiveLineIdx(prev => prev + 1);
        setCurrentCharIdx(0);
      }, lineDelay);
      return () => clearTimeout(timer);
    }

    // Type out current line character by character
    if (currentCharIdx < currentLine.length) {
      const timer = setTimeout(() => {
        const step = Math.min(3, currentLine.length - currentCharIdx);
        setCurrentCharIdx(prev => prev + step);
      }, charSpeed);
      return () => clearTimeout(timer);
    } else {
      // Line finished, slide-down to next line
      const timer = setTimeout(() => {
        setActiveLineIdx(prev => prev + 1);
        setCurrentCharIdx(0);
      }, lineDelay);
      return () => clearTimeout(timer);
    }
  }, [activeLineIdx, currentCharIdx, lines, isNew, isSkipped, text, charSpeed, lineDelay]);

  const isTyping = isNew && !isSkipped && activeLineIdx < lines.length;

  let visibleMarkdown = text || '';
  if (isTyping) {
    const completed = lines.slice(0, activeLineIdx);
    const activeSlice = (lines[activeLineIdx] || '').slice(0, currentCharIdx);
    visibleMarkdown = [...completed, activeSlice].join('\n');
  }

  return (
    <div 
      onClick={() => {
        if (isTyping) {
          setIsSkipped(true);
          setActiveLineIdx(lines.length);
          setCurrentCharIdx(0);
        }
      }}
      className="markdown-prose text-xs leading-relaxed relative group/typewriter cursor-default animate-in fade-in duration-100"
      title={isTyping ? "Click to reveal entire output immediately" : undefined}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={chatMarkdownComponents}>
        {visibleMarkdown}
      </ReactMarkdown>

      {isTyping && (
        <span className="inline-block w-1.5 h-3.5 bg-blue-500 ml-0.5 animate-pulse align-middle" />
      )}
    </div>
  );
}

function extractSummarySentences(content, role) {
  if (!content) return role === 'user' ? 'User submitted a diagnostic query.' : 'Triage resolution generated.';
  let raw = '';
  if (typeof content === 'string') {
    raw = content;
  } else if (content.narrative) {
    raw = content.narrative;
  } else if (content.text) {
    raw = content.text;
  } else if (content.executive_summary) {
    raw = content.executive_summary;
  } else if (content.issue_category) {
    raw = `${content.issue_category}: ${content.recommendation || 'Automated multi-persona triage completed.'}`;
  } else {
    raw = JSON.stringify(content);
  }

  // Strip Markdown, code tags, and emojis
  const cleaned = raw
    .replace(/[*_~`#]/g, '')
    .replace(/[🎯📖🔍🛡️⚡⚖️🔒✨🚀💡🔹]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Match complete sentences (up to 2 sentences)
  const matches = cleaned.match(/[^.!?]+[.!?]+/g);
  if (matches && matches.length > 0) {
    return matches.slice(0, 2).join(' ').trim();
  }
  return cleaned.length > 220 ? cleaned.slice(0, 220) + '...' : cleaned;
}

function DynamicCheckpointScroller({ containerRef, messages = [], isLoading }) {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [checkpoints, setCheckpoints] = useState([]);
  const trackRef = useRef(null);

  const updateScrollProgress = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll > 0) {
      const progress = el.scrollTop / maxScroll;
      setScrollProgress(Math.min(Math.max(progress, 0), 1));
    } else {
      setScrollProgress(0);
    }
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener('scroll', updateScrollProgress, { passive: true });
    updateScrollProgress();

    const updateCheckpoints = () => {
      const messageElements = el.querySelectorAll('[data-chat-checkpoint]');
      const newCheckpoints = [];
      const totalHeight = el.scrollHeight || 1;

      messageElements.forEach((msgEl) => {
        const rawId = msgEl.getAttribute('data-chat-checkpoint');
        const role = msgEl.getAttribute('data-chat-role');
        const preview = msgEl.getAttribute('data-chat-preview') || (role === 'user' ? 'User Query' : 'Resolution Triage');
        const offsetTop = msgEl.offsetTop;
        const percent = Math.min(Math.max((offsetTop / totalHeight) * 100, 0), 100);

        newCheckpoints.push({
          id: rawId,
          role,
          preview,
          percent,
          element: msgEl
        });
      });

      setCheckpoints(newCheckpoints);
    };

    updateCheckpoints();
    const timeout = setTimeout(updateCheckpoints, 300);

    return () => {
      el.removeEventListener('scroll', updateScrollProgress);
      clearTimeout(timeout);
    };
  }, [messages, isLoading, containerRef, updateScrollProgress]);

  const scrollToTop = () => {
    scrollStep('up');
  };

  const scrollToBottom = () => {
    scrollStep('down');
  };

  const scrollStep = (direction) => {
    const el = containerRef.current;
    if (!el || checkpoints.length === 0) return;
    const currentScrollTop = el.scrollTop;

    // Collect sorted offsets of all active checkpoints
    const checkpointOffsets = checkpoints
      .map(cp => (cp.element ? cp.element.offsetTop : 0))
      .sort((a, b) => a - b);

    if (direction === 'up') {
      const prevOffsets = checkpointOffsets.filter(offset => offset < currentScrollTop - 25);
      if (prevOffsets.length > 0) {
        const targetOffset = Math.max(...prevOffsets);
        el.scrollTo({ top: Math.max(0, targetOffset - 12), behavior: 'smooth' });
      } else {
        el.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      const nextOffsets = checkpointOffsets.filter(offset => offset > currentScrollTop + 25);
      if (nextOffsets.length > 0) {
        const targetOffset = Math.min(...nextOffsets);
        el.scrollTo({ top: Math.max(0, targetOffset - 12), behavior: 'smooth' });
      } else {
        el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
      }
    }
  };

  const scrollToElement = (element) => {
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!messages || messages.length === 0) return null;

  return (
    <div 
      className="absolute right-1 sm:right-2 top-[50px] bottom-[50px] z-30 flex flex-col items-center justify-between py-1 px-1.5 opacity-30 hover:opacity-100 transition-opacity duration-300 group select-none pointer-events-auto"
      title="Conversation Checkpoint Scroller"
    >
      {/* Top Chevron Button (Steps to previous checkpoint) */}
      <button
        type="button"
        onClick={() => scrollStep('up')}
        className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-blue-500 dark:text-zinc-400 dark:hover:text-blue-400 hover:scale-125 active:scale-90 transition-all cursor-pointer bg-transparent border-0 outline-none p-0"
        title="Previous Checkpoint"
      >
        <ChevronUp size={16} className="stroke-[2.5]" />
      </button>

      {/* Vertical Rail Track with Checkpoints & Thumb (Wider 5px Track) */}
      <div 
        ref={trackRef} 
        className="relative flex-1 w-[5px] bg-zinc-200/90 dark:bg-zinc-800 rounded-full my-2 flex items-center justify-center"
      >
        {/* Dynamic Scroll Progress Thumb */}
        <div 
          className="absolute w-[9px] -left-[2px] h-8 rounded-full bg-zinc-400/90 dark:bg-zinc-500 group-hover:bg-blue-500 shadow-xs transition-colors pointer-events-none"
          style={{
            top: `calc(${scrollProgress * 100}% - ${scrollProgress * 32}px)`
          }}
        />

        {/* Checkpoint Dots (Prominent & Color Differentiated) */}
        {checkpoints.map((cp, cIdx) => {
          const isUser = cp.role === 'user';
          const isAgentLoop = cp.role === 'agent-loop';
          const isLive = cp.role === 'live-process' || cp.id === 'live-process';

          let dotClass = 'bg-blue-500 dark:bg-blue-500 border-blue-400 dark:border-blue-400 group-hover/dot:bg-blue-600 shadow-xs';

          if (isUser) {
            dotClass = 'bg-zinc-300 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-500 group-hover/dot:border-zinc-800 dark:group-hover/dot:border-zinc-200 group-hover/dot:bg-zinc-900 dark:group-hover/dot:bg-zinc-100';
          } else if (isAgentLoop) {
            dotClass = 'bg-purple-100 dark:bg-purple-950 border-purple-500 dark:border-purple-400 group-hover/dot:bg-purple-600 shadow-xs';
          } else if (isLive) {
            dotClass = 'bg-amber-400 border-amber-500 animate-pulse shadow-xs';
          }

          // Smart vertical alignment to ensure tooltip never clips outside the top or bottom viewport
          const tooltipYClass = cp.percent < 18 
            ? 'top-0 translate-y-0' 
            : cp.percent > 82 
              ? 'bottom-0 translate-y-0' 
              : 'top-1/2 -translate-y-1/2';

          return (
            <div
              key={cIdx}
              onClick={(e) => {
                e.stopPropagation();
                scrollToElement(cp.element);
              }}
              style={{ top: `${cp.percent}%` }}
              className="absolute -left-[9.5px] -translate-y-1/2 w-6 h-6 flex items-center justify-center cursor-pointer group/dot z-10"
            >
              <div 
                className={`w-3.5 h-3.5 rounded-full transition-all duration-200 border-2 group-hover/dot:scale-125 ${dotClass}`}
              />

              {/* Simple, Theme-Matching Hover Tooltip (Fully contained within viewing area) */}
              <div className={`absolute right-7 ${tooltipYClass} hidden group-hover/dot:flex p-2.5 sm:p-3 rounded-lg bg-white dark:bg-[#18181b] text-zinc-800 dark:text-zinc-200 shadow-xl border border-zinc-200/90 dark:border-zinc-800 min-w-[200px] max-w-[280px] sm:max-w-[320px] whitespace-normal leading-relaxed text-xs font-mono z-50 animate-in fade-in slide-in-from-right-1 duration-150 pointer-events-none`}>
                {cp.preview}
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Chevron Button (Steps to next checkpoint) */}
      <button
        type="button"
        onClick={() => scrollStep('down')}
        className="w-6 h-6 flex items-center justify-center text-zinc-500 hover:text-blue-500 dark:text-zinc-400 dark:hover:text-blue-400 hover:scale-125 active:scale-90 transition-all cursor-pointer bg-transparent border-0 outline-none p-0"
        title="Next Checkpoint"
      >
        <ChevronDown size={16} className="stroke-[2.5]" />
      </button>
    </div>
  );
}
