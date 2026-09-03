import React, { createContext, useContext, useEffect, useState } from 'react';

const defaultSettings = {
  enableAskMode: false,
  setEnableAskMode: () => {},
  toggleAskMode: () => {},
  enableFileUpload: false,
  setEnableFileUpload: () => {},
  toggleFileUpload: () => {},
  enableShowReasoning: false,
  setEnableShowReasoning: () => {},
  toggleShowReasoning: () => {},
  enableSentinel: false,
  setEnableSentinel: () => {},
  toggleSentinel: () => {},
  enableChatFollowup: false,
  setEnableChatFollowup: () => {},
  toggleChatFollowup: () => {},
};

const SettingsContext = createContext(defaultSettings);

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

  const [enableChatFollowup, setEnableChatFollowup] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('yg-experimental-followup');
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

  useEffect(() => {
    localStorage.setItem('yg-experimental-followup', String(enableChatFollowup));
  }, [enableChatFollowup]);

  const toggleAskMode = () => setEnableAskMode(prev => !prev);
  const toggleFileUpload = () => setEnableFileUpload(prev => !prev);
  const toggleShowReasoning = () => setEnableShowReasoning(prev => !prev);
  const toggleSentinel = () => setEnableSentinel(prev => !prev);
  const toggleChatFollowup = () => setEnableChatFollowup(prev => !prev);

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
        enableChatFollowup,
        setEnableChatFollowup,
        toggleChatFollowup,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    return defaultSettings;
  }
  return context;
}
