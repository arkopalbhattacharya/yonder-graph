import React, { createContext, useContext, useEffect, useState } from 'react';

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
  const [enableAskMode, setEnableAskMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('yg-experimental-ask');
      return stored === 'true'; // Default: false (disabled)
    }
    return false;
  });

  const [enableFileUpload, setEnableFileUpload] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('yg-experimental-upload');
      return stored === 'true'; // Default: false (disabled)
    }
    return false;
  });

  const [enableShowReasoning, setEnableShowReasoning] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('yg-experimental-reasoning');
      return stored === 'true'; // Default: false (disabled)
    }
    return false;
  });

  const [enableSentinel, setEnableSentinel] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('yg-experimental-sentinel');
      return stored === 'true'; // Default: false (disabled)
    }
    return false;
  });

  useEffect(() => {
    localStorage.setItem('yg-experimental-ask', String(enableAskMode));
  }, [enableAskMode]);

  useEffect(() => {
    localStorage.setItem('yg-experimental-upload', String(enableFileUpload));
  }, [enableFileUpload]);

  useEffect(() => {
    localStorage.setItem('yg-experimental-reasoning', String(enableShowReasoning));
  }, [enableShowReasoning]);

  useEffect(() => {
    localStorage.setItem('yg-experimental-sentinel', String(enableSentinel));
  }, [enableSentinel]);

  const toggleAskMode = () => setEnableAskMode(prev => !prev);
  const toggleFileUpload = () => setEnableFileUpload(prev => !prev);
  const toggleShowReasoning = () => setEnableShowReasoning(prev => !prev);
  const toggleSentinel = () => setEnableSentinel(prev => !prev);

  return (
    <SettingsContext.Provider
      value={{
        enableAskMode,
        setEnableAskMode,
        toggleAskMode,
        enableFileUpload,
        setEnableFileUpload,
        toggleFileUpload,
        enableShowReasoning,
        setEnableShowReasoning,
        toggleShowReasoning,
        enableSentinel,
        setEnableSentinel,
        toggleSentinel,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
