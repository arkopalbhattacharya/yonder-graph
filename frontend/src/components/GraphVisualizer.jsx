import React, { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useTheme } from '../context/ThemeContext';
import { api } from '../services/api';
import { 
  Search, 
  ZoomIn, 
  ZoomOut, 
  Maximize, 
  Layers, 
  X, 
  Database, 
  FileText, 
  Globe, 
  Key, 
  Tag, 
  ArrowRight, 
  Code, 
  Copy, 
  Check, 
  BookOpen, 
  Filter,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

export default function GraphVisualizer({ isActive }) {
  const { isDarkMode } = useTheme();
  const fgRef = useRef();
  const containerRef = useRef();
  
  const [rawGraphData, setRawGraphData] = useState({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedDomain, setSelectedDomain] = useState('ALL');
  const [viewMode, setViewMode] = useState('TABLES_SOPS'); // 'ALL', 'TABLES_SOPS', 'TABLES_ONLY', 'SOPS_ONLY'
  const [copiedSql, setCopiedSql] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // ── 1. Fetch Graph Schema from Neo4j ─────────────────────────────
  useEffect(() => {
    if (!isActive) return;

    const loadData = async () => {
      try {
        setLoading(true);
        const data = await api.getGraphSchema();
        
        const nodes = (data.nodes || []).map(n => {
          const props = n.props || {};
          const lbl = n.label || (n.labels ? n.labels[0] : 'Node');
          const name = n.name || props.oracle_table_name || props.column_name || props.sop_id || props.name || props.term || n.id;
          const domain = props.domain || (lbl === 'Domain' ? props.name : null);
          
          let val = 5;
          if (lbl === 'Domain') val = 14;
          else if (lbl === 'Table') val = 9;
          else if (lbl === 'SOPRunbook') val = 7.5;
          else if (lbl === 'BusinessFlow') val = 6;
          else if (lbl === 'Column') val = 3.5;

          return {
            ...n,
            name,
            label: lbl,
            domain: domain || 'General',
            props,
            val
          };
        });

        const links = (data.edges || []).map(e => ({
          ...e,
          source: e.source,
          target: e.target,
          name: e.name || e.rel_type || e.type || 'RELATES_TO',
          rel_type: e.rel_type || e.name || e.type || 'RELATES_TO'
        }));

        setRawGraphData({ nodes, links });
      } catch (err) {
        console.error("Failed to load graph schema", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isActive]);

  // ── 2. Filter Graph Data by Domain & View Mode ──────────────────
  const filteredGraphData = useMemo(() => {
    let nodes = rawGraphData.nodes;
    let links = rawGraphData.links;

    // View Mode Filter
    if (viewMode === 'TABLES_SOPS') {
      nodes = nodes.filter(n => n.label !== 'Column' && n.label !== 'AgentQueryPattern');
    } else if (viewMode === 'TABLES_ONLY') {
      nodes = nodes.filter(n => n.label === 'Table' || n.label === 'Domain');
    } else if (viewMode === 'SOPS_ONLY') {
      nodes = nodes.filter(n => n.label === 'SOPRunbook' || n.label === 'Domain');
    }

    // Domain Filter
    if (selectedDomain !== 'ALL') {
      const allowedNodeIds = new Set();
      nodes.forEach(n => {
        const nDom = (n.domain || n.props?.domain || '').toLowerCase();
        const selDom = selectedDomain.toLowerCase();
        if (n.label === 'Domain' && n.name.toLowerCase() === selDom) {
          allowedNodeIds.add(n.id);
        } else if (nDom.includes(selDom)) {
          allowedNodeIds.add(n.id);
        }
      });
      nodes = nodes.filter(n => allowedNodeIds.has(n.id));
    }

    const nodeIds = new Set(nodes.map(n => n.id));
    links = links.filter(l => {
      const srcId = typeof l.source === 'object' ? l.source.id : l.source;
      const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
      return nodeIds.has(srcId) && nodeIds.has(tgtId);
    });

    return { nodes, links };
  }, [rawGraphData, selectedDomain, viewMode]);

  // ── 3. Configure Expansive D3 Physics (Breathe Out) ─────────────
  useEffect(() => {
    if (fgRef.current && filteredGraphData.nodes.length > 0) {
      // Strong repulsion to prevent overlapping
      fgRef.current.d3Force('charge')?.strength(-520)?.distanceMax(900);
      
      // Link length based on relationship hierarchy
      fgRef.current.d3Force('link')?.distance(link => {
        const rel = link.rel_type || link.name;
        if (rel === 'HAS_COLUMN') return 40;
        if (rel === 'BELONGS_TO_DOMAIN') return 200;
        if (rel === 'REFERENCES_TABLE') return 120;
        return 100;
      });

      // Avoid collision between node bodies
      fgRef.current.d3Force('collide')?.radius(node => (node.val || 5) * 2.8 + 12);
      fgRef.current.d3ReheatSimulation();
    }
  }, [filteredGraphData]);

  // ── 4. Responsive Canvas Sizing ──────────────────────────────────
  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    
    const updateDimensions = () => {
      setDimensions({
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight
      });
    };
    
    window.addEventListener('resize', updateDimensions);
    updateDimensions();
    setTimeout(updateDimensions, 100);
    return () => window.removeEventListener('resize', updateDimensions);
  }, [isActive]);

  const handleZoomIn = () => {
    if (fgRef.current) fgRef.current.zoom(fgRef.current.zoom() * 1.3, 400);
  };

  const handleZoomOut = () => {
    if (fgRef.current) fgRef.current.zoom(fgRef.current.zoom() / 1.3, 400);
  };

  const handleFit = () => {
    if (fgRef.current) fgRef.current.zoomToFit(400, 45);
  };

  const handleFocusNode = (node) => {
    setSelectedNode(node);
    if (fgRef.current && node.x !== undefined && node.y !== undefined) {
      fgRef.current.centerAt(node.x, node.y, 600);
      fgRef.current.zoom(2.5, 600);
    }
  };

  const getNodeColor = (node) => {
    if (node.color) return node.color;
    const colors = {
      Domain: '#10b981',       // Emerald
      Table: '#3b82f6',        // Blue
      Column: '#ec4899',       // Pink (same as previous business term color)
      SOPRunbook: '#eab308',   // Yellow
      BusinessFlow: '#94a3b8', // Slate Grey (Light)
      BusinessTerm: '#64748b', // Slate Grey (Medium/Dark)
      BYConfig: '#ef4444'      // Red
    };
    return colors[node.label] || '#64748b';
  };

  // ── Calculate Focus & Fade-out Sets for Node Selection or Search ──
  const { highlightNodes, highlightLinks, isFocusActive } = useMemo(() => {
    const hasSearch = Boolean(searchQuery && searchQuery.trim().length > 0);
    const hasSelection = Boolean(selectedNode);

    if (!hasSearch && !hasSelection) {
      return {
        highlightNodes: new Set(),
        highlightLinks: new Set(),
        isFocusActive: false
      };
    }

    const hNodes = new Set();
    const hLinks = new Set();

    // 1. If a node is selected, highlight it and its direct neighbors & links
    if (hasSelection) {
      hNodes.add(selectedNode.id);
      filteredGraphData.links.forEach(link => {
        const srcId = typeof link.source === 'object' ? link.source.id : link.source;
        const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
        if (srcId === selectedNode.id || tgtId === selectedNode.id) {
          hLinks.add(link);
          hNodes.add(srcId);
          hNodes.add(tgtId);
        }
      });
    }

    // 2. If search query is active
    if (hasSearch) {
      const q = searchQuery.trim().toLowerCase();
      const directMatches = new Set();

      filteredGraphData.nodes.forEach(n => {
        const name = (n.name || '').toLowerCase();
        const label = (n.label || '').toLowerCase();
        const domain = (n.domain || n.props?.domain || '').toLowerCase();
        const purpose = (n.props?.business_purpose || n.props?.description || '').toLowerCase();
        if (name.includes(q) || label.includes(q) || domain.includes(q) || purpose.includes(q)) {
          directMatches.add(n.id);
          hNodes.add(n.id);
        }
      });

      filteredGraphData.links.forEach(link => {
        const srcId = typeof link.source === 'object' ? link.source.id : link.source;
        const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
        if (directMatches.has(srcId) || directMatches.has(tgtId)) {
          hLinks.add(link);
          hNodes.add(srcId);
          hNodes.add(tgtId);
        }
      });
    }

    return {
      highlightNodes: hNodes,
      highlightLinks: hLinks,
      isFocusActive: true
    };
  }, [filteredGraphData, selectedNode, searchQuery]);

  // ── 5. Zoom-Adaptive Canvas Node Rendering ───────────────────────
  const renderNode = useCallback((node, ctx, globalScale) => {
    const label = node.name || node.id;
    
    // Zoom-adaptive radius: prevents nodes from becoming giant overlapping balloons when zoomed in!
    const baseVal = node.val || 5;
    const r = Math.max(2.4, baseVal / Math.pow(globalScale, 0.48));

    const isMatch = searchQuery && label.toLowerCase().includes(searchQuery.toLowerCase());
    const isSelected = selectedNode && selectedNode.id === node.id;
    const isHighlighted = !isFocusActive || highlightNodes.has(node.id);

    ctx.save();
    if (isFocusActive) {
      ctx.globalAlpha = isHighlighted ? 1.0 : 0.10;
    }

    // Draw Outer Glow / Highlight Ring
    if (isSelected || isMatch) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + (3.5 / globalScale), 0, 2 * Math.PI, false);
      ctx.lineWidth = 2.5 / globalScale;
      ctx.strokeStyle = isSelected ? '#3b82f6' : '#f59e0b';
      ctx.stroke();
    }

    // Draw Main Node Circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
    ctx.fillStyle = getNodeColor(node);
    ctx.fill();
    ctx.lineWidth = 1.2 / globalScale;
    ctx.strokeStyle = isDarkMode ? '#18181b' : '#ffffff';
    ctx.stroke();

    // Zoom-adaptive font size: scales smoothly without overpowering canvas
    const fontSize = Math.max(8.8 / Math.pow(globalScale, 0.4), 2.2);
    ctx.font = `600 ${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace`;
    const textWidth = ctx.measureText(label).width;
    const padX = fontSize * 0.4;
    const padY = fontSize * 0.22;
    const boxW = textWidth + padX * 2;
    const boxH = fontSize + padY * 2;
    const boxX = node.x - boxW / 2;
    const boxY = node.y + r + (2.5 / globalScale);

    // Pill badge background
    ctx.fillStyle = isDarkMode ? 'rgba(15, 15, 20, 0.90)' : 'rgba(255, 255, 255, 0.94)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(boxX, boxY, boxW, boxH, 3 / globalScale);
    } else {
      ctx.rect(boxX, boxY, boxW, boxH);
    }
    ctx.fill();
    ctx.lineWidth = 0.6 / globalScale;
    ctx.strokeStyle = isSelected 
      ? '#3b82f6' 
      : (isDarkMode ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.14)');
    ctx.stroke();

    // Node Name Text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isSelected 
      ? (isDarkMode ? '#60a5fa' : '#2563eb') 
      : (isDarkMode ? '#fafafa' : '#111827');
    ctx.fillText(label, node.x, boxY + boxH / 2);

    ctx.restore();
  }, [isDarkMode, searchQuery, selectedNode, isFocusActive, highlightNodes]);

  // ── 6. Render Relationship Names along Link Lines ───────────────
  const renderLink = useCallback((link, ctx, globalScale) => {
    if (globalScale < 0.85) return; // Only show relationship text when zoomed in
    const label = link.name || link.rel_type;
    if (!label || label === 'HAS_COLUMN') return; // keep column links clean

    const start = link.source;
    const end = link.target;
    if (!start || !end || start.x === undefined || end.x === undefined) return;

    const isHighlighted = !isFocusActive || highlightLinks.has(link);

    ctx.save();
    if (isFocusActive) {
      ctx.globalAlpha = isHighlighted ? 1.0 : 0.05;
    }

    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    const fontSize = Math.max(7 / globalScale, 2);
    
    ctx.font = `italic 500 ${fontSize}px ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = isHighlighted
      ? (isDarkMode ? 'rgba(212, 212, 216, 0.85)' : 'rgba(55, 65, 81, 0.95)')
      : (isDarkMode ? 'rgba(212, 212, 216, 0.15)' : 'rgba(75, 85, 99, 0.15)');
    ctx.fillText(label, midX, midY - (2 / globalScale));

    ctx.restore();
  }, [isDarkMode, isFocusActive, highlightLinks]);

  // ── 7. Calculate Factual Node Hierarchy & Related Neighbors ─────
  const nodeHierarchy = useMemo(() => {
    if (!selectedNode) return null;

    const nodeId = selectedNode.id;
    const connectedColumns = [];
    const outgoingRels = [];
    const incomingRels = [];
    const referencedSops = [];
    const targetTables = [];

    rawGraphData.links.forEach(l => {
      const src = typeof l.source === 'object' ? l.source : rawGraphData.nodes.find(n => n.id === l.source);
      const tgt = typeof l.target === 'object' ? l.target : rawGraphData.nodes.find(n => n.id === l.target);
      const relType = l.rel_type || l.name;

      if (!src || !tgt) return;

      // When Table is selected
      if (selectedNode.label === 'Table') {
        if (src.id === nodeId && relType === 'HAS_COLUMN') {
          connectedColumns.push(tgt);
        } else if (src.id === nodeId && tgt.label === 'Table') {
          outgoingRels.push({ relationship: relType, target: tgt });
        } else if (tgt.id === nodeId && src.label === 'Table') {
          incomingRels.push({ relationship: relType, source: src });
        } else if (tgt.id === nodeId && src.label === 'SOPRunbook') {
          referencedSops.push(src);
        }
      }

      // When Column is selected
      if (selectedNode.label === 'Column') {
        if (tgt.id === nodeId && src.label === 'Table') {
          targetTables.push(src);
        }
      }

      // When SOP is selected
      if (selectedNode.label === 'SOPRunbook') {
        if (src.id === nodeId && (relType === 'REFERENCES_TABLE' || tgt.label === 'Table')) {
          targetTables.push(tgt);
        }
      }

      // When Domain is selected
      if (selectedNode.label === 'Domain') {
        if (tgt.id === nodeId && src.label === 'Table') {
          targetTables.push(src);
        } else if (tgt.id === nodeId && src.label === 'SOPRunbook') {
          referencedSops.push(src);
        }
      }
    });

    return {
      connectedColumns,
      outgoingRels,
      incomingRels,
      referencedSops,
      targetTables
    };
  }, [selectedNode, rawGraphData]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="h-full w-full flex flex-col relative font-mono overflow-hidden" ref={containerRef}>
      
      {/* ── Top Bar: Search, Domain Filter & View Mode Controls ── */}
      <div className="absolute top-3.5 left-3.5 right-16 z-10 flex flex-wrap items-center gap-2 pointer-events-none">
        
        {/* Search Bar */}
        <div className="pointer-events-auto bg-white/90 dark:bg-[#111114]/90 backdrop-blur-md rounded-xl flex items-center px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 shadow-sm">
          <Search size={14} className="text-zinc-400 mr-2 flex-shrink-0" />
          <input 
            type="text" 
            placeholder="Search schema (e.g. ORD, SOP-OUT-002, INVDTL)..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none text-xs w-44 sm:w-60 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 ml-1">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Domain Filter Pills */}
        <div className="pointer-events-auto bg-white/90 dark:bg-[#111114]/90 backdrop-blur-md rounded-xl p-1 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center space-x-1 text-[11px]">
          {['ALL', 'Outbound', 'Inbound', 'Inventory'].map(dom => (
            <button
              key={dom}
              onClick={() => setSelectedDomain(dom)}
              className={`px-2.5 py-0.5 rounded-lg transition-all ${
                selectedDomain === dom
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {dom}
            </button>
          ))}
        </div>

        {/* View Mode Toggle */}
        <div className="pointer-events-auto bg-white/90 dark:bg-[#111114]/90 backdrop-blur-md rounded-xl p-1 border border-zinc-200 dark:border-zinc-800 shadow-sm flex items-center space-x-1 text-[11px]">
          {[
            { id: 'TABLES_SOPS', label: 'Tables & SOPs' },
            { id: 'ALL', label: 'Full (+ Columns)' },
            { id: 'TABLES_ONLY', label: 'Tables' },
            { id: 'SOPS_ONLY', label: 'SOPs' }
          ].map(m => (
            <button
              key={m.id}
              onClick={() => setViewMode(m.id)}
              className={`px-2 py-0.5 rounded-lg transition-all ${
                viewMode === m.id
                  ? 'bg-blue-600 text-white font-bold shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

      </div>

      {/* ── Zoom & Fit Action Buttons ── */}
      <div className="absolute top-3.5 right-3.5 z-10 flex flex-col space-y-1.5">
        <div className="bg-white/90 dark:bg-[#111114]/90 backdrop-blur-md rounded-xl flex flex-col border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden text-xs">
          <button onClick={handleZoomIn} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-200 dark:border-zinc-800" title="Zoom In">
            <ZoomIn size={15} className="text-zinc-600 dark:text-zinc-300" />
          </button>
          <button onClick={handleZoomOut} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border-b border-zinc-200 dark:border-zinc-800" title="Zoom Out">
            <ZoomOut size={15} className="text-zinc-600 dark:text-zinc-300" />
          </button>
          <button onClick={handleFit} className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors" title="Fit to Screen">
            <Maximize size={15} className="text-zinc-600 dark:text-zinc-300" />
          </button>
        </div>
      </div>

      {/* ── Factual Node Hierarchy Details Inspector (Slide-over Card) ── */}
      {selectedNode && (
        <div className="absolute top-16 bottom-4 right-3.5 z-20 w-84 sm:w-96 overflow-y-auto bg-white/95 dark:bg-[#111114]/95 backdrop-blur-md rounded-2xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-2xl text-xs space-y-3.5 custom-scrollbar animate-in slide-in-from-right-4 duration-150">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-800/80 pb-2.5">
            <div className="flex items-center space-x-2 truncate">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: getNodeColor(selectedNode) }} />
              <div className="truncate">
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate block">
                  {selectedNode.name}
                </span>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium">
                  {selectedNode.label} • {selectedNode.domain || selectedNode.props?.domain || 'General'}
                </span>
              </div>
            </div>
            <button 
              onClick={() => setSelectedNode(null)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 flex-shrink-0"
              title="Close Details"
            >
              <X size={14} />
            </button>
          </div>

          {/* ── Table Node Inspector ── */}
          {selectedNode.label === 'Table' && (
            <div className="space-y-3">
              {selectedNode.props?.business_purpose && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Business Purpose</span>
                  <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
                    {selectedNode.props.business_purpose}
                  </p>
                </div>
              )}

              {/* Table Metrics */}
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80">
                  <span className="text-zinc-400 block">Row Count</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">{selectedNode.props?.est_row_count || 'N/A'}</span>
                </div>
                <div className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80">
                  <span className="text-zinc-400 block">Refresh Sync</span>
                  <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate block">{selectedNode.props?.refresh_strategy || 'Near Real-Time'}</span>
                </div>
              </div>

              {/* Connected Table Relationships (Outgoing & Incoming) */}
              {(nodeHierarchy?.outgoingRels?.length > 0 || nodeHierarchy?.incomingRels?.length > 0) && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center">
                    <ArrowRight size={11} className="mr-1" /> Table Relationships ({nodeHierarchy.outgoingRels.length + nodeHierarchy.incomingRels.length})
                  </span>
                  <div className="space-y-1 max-h-36 overflow-y-auto custom-scrollbar">
                    {nodeHierarchy.outgoingRels.map((rel, idx) => (
                      <div 
                        key={idx}
                        onClick={() => handleFocusNode(rel.target)}
                        className="p-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-[11px] cursor-pointer hover:border-blue-500 transition-colors"
                      >
                        <span className="text-blue-600 dark:text-blue-400 font-bold">[{rel.relationship}]</span>
                        <span className="text-zinc-700 dark:text-zinc-300 font-semibold">{rel.target.name} →</span>
                      </div>
                    ))}
                    {nodeHierarchy.incomingRels.map((rel, idx) => (
                      <div 
                        key={idx}
                        onClick={() => handleFocusNode(rel.source)}
                        className="p-1.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between text-[11px] cursor-pointer hover:border-blue-500 transition-colors"
                      >
                        <span className="text-zinc-700 dark:text-zinc-300 font-semibold">← {rel.source.name}</span>
                        <span className="text-blue-600 dark:text-blue-400 font-bold">[{rel.relationship}]</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Columns Hierarchy */}
              {nodeHierarchy?.connectedColumns?.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider flex items-center">
                    <Database size={11} className="mr-1" /> Columns Schema ({nodeHierarchy.connectedColumns.length})
                  </span>
                  <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar">
                    {nodeHierarchy.connectedColumns.map(col => {
                      const isPk = col.props?.is_primary_key === 'Yes';
                      return (
                        <div 
                          key={col.id}
                          onClick={() => handleFocusNode(col)}
                          className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800/60 space-y-0.5 cursor-pointer hover:border-sky-500 transition-colors"
                        >
                          <div className="flex items-center justify-between text-[11px]">
                            <div className="flex items-center space-x-1.5">
                              {isPk && (
                                <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
                                  PK
                                </span>
                              )}
                              <span className="font-bold text-zinc-900 dark:text-zinc-100">{col.props?.column_name || col.name}</span>
                            </div>
                            <span className="text-[10px] text-zinc-400 font-mono">{col.props?.data_type}</span>
                          </div>
                          {col.props?.business_definition && (
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                              {col.props.business_definition}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Referencing SOPs */}
              {nodeHierarchy?.referencedSops?.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 tracking-wider flex items-center">
                    <BookOpen size={11} className="mr-1" /> Referencing SOP Runbooks ({nodeHierarchy.referencedSops.length})
                  </span>
                  <div className="space-y-1">
                    {nodeHierarchy.referencedSops.map(sop => (
                      <div 
                        key={sop.id}
                        onClick={() => handleFocusNode(sop)}
                        className="p-2 rounded-lg bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/60 dark:border-purple-900/60 cursor-pointer hover:border-purple-500 transition-colors"
                      >
                        <div className="font-bold text-[11px] text-purple-700 dark:text-purple-300">{sop.name}</div>
                        <div className="text-[10px] text-zinc-600 dark:text-zinc-400 line-clamp-1">{sop.props?.issue_pattern}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Column Node Inspector ── */}
          {selectedNode.label === 'Column' && (
            <div className="space-y-3">
              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800/80 space-y-1.5 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Parent Table</span>
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    {selectedNode.props?.table_name}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Data Type</span>
                  <span className="font-mono text-zinc-800 dark:text-zinc-200">{selectedNode.props?.data_type}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Primary Key</span>
                  <span className={`font-bold ${selectedNode.props?.is_primary_key === 'Yes' ? 'text-amber-500' : 'text-zinc-500'}`}>
                    {selectedNode.props?.is_primary_key || 'No'}
                  </span>
                </div>
              </div>

              {selectedNode.props?.business_definition && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Business Definition</span>
                  <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
                    {selectedNode.props.business_definition}
                  </p>
                </div>
              )}

              {/* Jump to Parent Table */}
              {nodeHierarchy?.targetTables?.length > 0 && (
                <button
                  onClick={() => handleFocusNode(nodeHierarchy.targetTables[0])}
                  className="w-full py-1.5 px-3 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-bold text-xs flex items-center justify-center space-x-1 transition-colors"
                >
                  <span>Focus Parent Table ({nodeHierarchy.targetTables[0].name})</span>
                  <ArrowRight size={12} />
                </button>
              )}
            </div>
          )}

          {/* ── SOP Runbook Node Inspector ── */}
          {selectedNode.label === 'SOPRunbook' && (
            <div className="space-y-3">
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-bold text-purple-600 dark:text-purple-400 tracking-wider">Incident Pattern</span>
                <p className="text-[11px] text-zinc-800 dark:text-zinc-200 leading-relaxed bg-purple-50/50 dark:bg-purple-950/20 p-2.5 rounded-xl border border-purple-200/60 dark:border-purple-900/60">
                  {selectedNode.props?.issue_pattern}
                </p>
              </div>

              {selectedNode.props?.db_targets && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Target Tables</span>
                  <div className="flex flex-wrap gap-1">
                    {selectedNode.props.db_targets.split(',').map(t => (
                      <span key={t.trim()} className="px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-[10px]">
                        {t.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedNode.props?.triage_steps && (
                <div className="space-y-1">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Triage Steps</span>
                  <div className="text-[11px] text-zinc-700 dark:text-zinc-300 whitespace-pre-line bg-zinc-50 dark:bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800/80">
                    {selectedNode.props.triage_steps}
                  </div>
                </div>
              )}

              {selectedNode.props?.diagnostic_sql && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Diagnostic SQL</span>
                    <button 
                      onClick={() => copyToClipboard(selectedNode.props.diagnostic_sql)}
                      className="text-[10px] text-zinc-400 hover:text-blue-500 flex items-center space-x-1"
                    >
                      {copiedSql ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                      <span>{copiedSql ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <pre className="text-[10px] font-mono text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-950 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-x-auto custom-scrollbar">
                    {selectedNode.props.diagnostic_sql}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* ── Domain Node Inspector ── */}
          {selectedNode.label === 'Domain' && (
            <div className="space-y-3">
              <p className="text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed bg-emerald-50/50 dark:bg-emerald-950/20 p-2.5 rounded-xl border border-emerald-200/60 dark:border-emerald-900/60">
                {selectedNode.props?.description || `WMS ${selectedNode.name} Domain & Operational Workflow`}
              </p>

              {nodeHierarchy?.targetTables?.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Registered Tables ({nodeHierarchy.targetTables.length})</span>
                  <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto custom-scrollbar">
                    {nodeHierarchy.targetTables.map(tbl => (
                      <span 
                        key={tbl.id} 
                        onClick={() => handleFocusNode(tbl)}
                        className="px-2 py-1 rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 font-bold text-[10px] cursor-pointer hover:bg-blue-100 transition-colors"
                      >
                        {tbl.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {nodeHierarchy?.referencedSops?.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">Registered SOP Runbooks ({nodeHierarchy.referencedSops.length})</span>
                  <div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto custom-scrollbar">
                    {nodeHierarchy.referencedSops.map(sop => (
                      <span 
                        key={sop.id} 
                        onClick={() => handleFocusNode(sop)}
                        className="px-2 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-bold text-[10px] cursor-pointer hover:bg-amber-100 transition-colors"
                      >
                        {sop.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}

      {/* ── Schema Legend ── */}
      <div className="absolute bottom-3.5 left-3.5 z-10">
        <div className="bg-white/90 dark:bg-[#111114]/90 backdrop-blur-md rounded-xl p-3 border border-zinc-200 dark:border-zinc-800 shadow-sm text-xs">
          <h4 className="font-bold text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mb-2 flex items-center">
            <Layers size={12} className="mr-1.5" /> Schema Legend ({filteredGraphData.nodes.length} nodes)
          </h4>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
            {[
              { label: 'Domain', color: '#10b981' },
              { label: 'Table', color: '#3b82f6' },
              { label: 'Column', color: '#ec4899' },
              { label: 'SOP Runbook', color: '#eab308' },
              { label: 'Business Flow', color: '#94a3b8' },
              { label: 'Business Term', color: '#64748b' },
            ].map(item => (
              <div key={item.label} className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-zinc-600 dark:text-zinc-400 truncate">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Canvas View ── */}
      {loading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-[#09090b] z-0">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-xs text-zinc-500 font-mono">Loading WMS Knowledge Graph...</p>
          </div>
        </div>
      ) : (
        <div className="absolute inset-0 z-0 bg-zinc-50 dark:bg-[#09090b]">
          {isActive && filteredGraphData.nodes.length > 0 && (
            <ForceGraph2D
              ref={fgRef}
              width={dimensions.width}
              height={dimensions.height}
              graphData={filteredGraphData}
              nodeLabel={(n) => `${n.label}: ${n.name}`}
              nodeColor={getNodeColor}
              nodeRelSize={2}
              onNodeClick={(node) => handleFocusNode(node)}
              onBackgroundClick={() => setSelectedNode(null)}
              linkColor={(link) => {
                if (!isFocusActive) {
                  return isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.16)';
                }
                return highlightLinks.has(link)
                  ? (isDarkMode ? 'rgba(96, 165, 250, 0.85)' : 'rgba(37, 99, 235, 0.85)')
                  : (isDarkMode ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)');
              }}
              linkWidth={(link) => {
                if (!isFocusActive) return 1;
                return highlightLinks.has(link) ? 2.4 : 0.4;
              }}
              linkDirectionalParticles={(link) => {
                if (!isFocusActive) return 1;
                return highlightLinks.has(link) ? 3 : 0;
              }}
              linkDirectionalParticleWidth={(link) => {
                if (!isFocusActive) return 1.2;
                return highlightLinks.has(link) ? 2.2 : 0;
              }}
              linkDirectionalArrowLength={3.5}
              linkDirectionalArrowRelPos={0.88}
              nodeCanvasObject={renderNode}
              nodeCanvasObjectMode={() => 'replace'}
              linkCanvasObject={renderLink}
              linkCanvasObjectMode={() => 'after'}
              d3VelocityDecay={0.25}
              cooldownTicks={120}
            />
          )}
        </div>
      )}
    </div>
  );
}
