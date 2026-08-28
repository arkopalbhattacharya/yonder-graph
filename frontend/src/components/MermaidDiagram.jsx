import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { useTheme } from '../context/ThemeContext';
import { Download, Maximize2, X, FileCode, Image, Code, ChevronDown } from 'lucide-react';

export default function MermaidDiagram({ chart }) {
  const containerRef = useRef(null);
  const modalContainerRef = useRef(null);
  const [hasError, setHasError] = useState(false);
  const [svgContent, setSvgContent] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { isDarkMode } = useTheme();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle ESC key for modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsModalOpen(false);
        setIsDropdownOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const cleanChart = (chart || '')
    .replace(/```mermaid/gi, '')
    .replace(/```/g, '')
    .trim();

  useEffect(() => {
    if (!cleanChart) return;

    mermaid.initialize({
      startOnLoad: false,
      theme: isDarkMode ? 'dark' : 'neutral',
      themeVariables: isDarkMode ? {
        darkMode: true,
        background: '#0e0e11',
        primaryColor: '#18181b',
        primaryTextColor: '#f4f4f5',
        primaryBorderColor: '#3b82f6',
        lineColor: '#52525b',
        secondaryColor: '#18181b',
        tertiaryColor: '#121214',
      } : {
        background: '#f8fafc',
        primaryColor: '#ffffff',
        primaryTextColor: '#0f172a',
        primaryBorderColor: '#3b82f6',
        lineColor: '#64748b',
      },
      securityLevel: 'loose',
      suppressErrorRendering: true,
    });

    let isMounted = true;

    const renderDiagram = async () => {
      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        const { svg } = await mermaid.render(id, cleanChart);
        if (isMounted) {
          setSvgContent(svg);
          if (containerRef.current) {
            containerRef.current.innerHTML = svg;
          }
          setHasError(false);
        }
      } catch (err) {
        console.warn('Mermaid diagram render skipped:', err);
        if (isMounted) {
          setHasError(true);
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [cleanChart, isDarkMode]);

  // Insert SVG into modal container when opened
  useEffect(() => {
    if (isModalOpen && modalContainerRef.current && svgContent) {
      modalContainerRef.current.innerHTML = svgContent;
    }
  }, [isModalOpen, svgContent]);

  // 1. Download as Mermaid Code (.mmd)
  const downloadCode = () => {
    const blob = new Blob([cleanChart], { type: 'text/vnd.mermaid' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yonder_graph_${Date.now()}.mmd`;
    a.click();
    URL.revokeObjectURL(url);
    setIsDropdownOpen(false);
  };

  // 2. Download as SVG
  const downloadSVG = () => {
    if (!svgContent) return;
    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yonder_graph_${Date.now()}.svg`;
    a.click();
    URL.revokeObjectURL(url);
    setIsDropdownOpen(false);
  };

  // 3. Download as PNG
  const downloadPNG = () => {
    if (!svgContent) return;
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const URLObject = window.URL || window.webkitURL || window;
    const blobURL = URLObject.createObjectURL(svgBlob);
    const image = new window.Image();

    image.onload = () => {
      const scale = 2; // 2x high resolution
      const canvas = document.createElement('canvas');
      canvas.width = (image.width || 800) * scale;
      canvas.height = (image.height || 600) * scale;
      const context = canvas.getContext('2d');
      if (!context) return;

      // Fill background matching current theme
      context.fillStyle = isDarkMode ? '#0e0e11' : '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const pngURL = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = pngURL;
      a.download = `yonder_graph_${Date.now()}.png`;
      a.click();
      URLObject.revokeObjectURL(blobURL);
      setIsDropdownOpen(false);
    };

    image.src = blobURL;
  };

  if (!cleanChart || hasError) return null;

  return (
    <>
      <div className="relative group my-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/60 dark:bg-[#0e0e11] overflow-hidden font-mono">
        
        {/* Header Toolbar */}
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-200/70 dark:border-zinc-800/70 bg-zinc-100/90 dark:bg-[#121215]/90 text-[11px]">
          <div className="flex items-center space-x-1.5 text-zinc-500 dark:text-zinc-400">
            <Code size={12} className="text-blue-500" />
            <span className="font-semibold text-[10px] uppercase tracking-wider">Flowchart Architecture</span>
          </div>

          <div className="flex items-center space-x-1" ref={dropdownRef}>
            {/* Expand Button */}
            <button
              onClick={() => setIsModalOpen(true)}
              className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
              title="Expand Diagram Modal"
            >
              <Maximize2 size={12} />
            </button>

            {/* Export Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-1 px-2 py-0.5 rounded bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-[10px] hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
              >
                <Download size={10} />
                <span>Export</span>
                <ChevronDown size={10} />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md shadow-lg py-1 z-30 text-[11px]">
                  <button
                    onClick={downloadCode}
                    className="w-full text-left px-3 py-1.5 flex items-center space-x-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                  >
                    <FileCode size={12} className="text-blue-500" />
                    <span>Download Code (.mmd)</span>
                  </button>
                  <button
                    onClick={downloadSVG}
                    className="w-full text-left px-3 py-1.5 flex items-center space-x-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                  >
                    <Image size={12} className="text-emerald-500" />
                    <span>Download SVG (.svg)</span>
                  </button>
                  <button
                    onClick={downloadPNG}
                    className="w-full text-left px-3 py-1.5 flex items-center space-x-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
                  >
                    <Image size={12} className="text-purple-500" />
                    <span>Download PNG (.png)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Embedded Diagram Container */}
        <div 
          className="mermaid-container w-full overflow-x-auto p-4 flex justify-center text-xs custom-scrollbar"
          ref={containerRef}
        />
      </div>

      {/* Fullscreen Expansion Modal */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-md animate-fade-in font-mono"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="relative w-full max-w-6xl max-h-[90vh] flex flex-col bg-white dark:bg-[#0e0e11] border border-zinc-300 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-[#121215]">
              <div className="flex items-center space-x-2">
                <Code size={14} className="text-blue-500" />
                <span className="font-semibold text-xs text-zinc-800 dark:text-zinc-200">
                  Process Architecture Flowchart (Full View)
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={downloadSVG}
                  className="px-2.5 py-1 text-xs rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 transition-colors flex items-center space-x-1"
                >
                  <Download size={12} />
                  <span>SVG</span>
                </button>
                <button
                  onClick={downloadPNG}
                  className="px-2.5 py-1 text-xs rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 transition-colors flex items-center space-x-1"
                >
                  <Download size={12} />
                  <span>PNG</span>
                </button>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
                  title="Close (Esc)"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body SVG Zoom/Pan Container */}
            <div 
              className="flex-1 overflow-auto p-8 flex items-center justify-center custom-scrollbar min-h-[400px]"
              ref={modalContainerRef}
            />
          </div>
        </div>
      )}
    </>
  );
}
