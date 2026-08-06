import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from './tom-translations.js';

const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(() => {
    // Try to get saved language from localStorage
    const saved = localStorage.getItem('tom-language');
    return saved || 'en';
  });

  // Save language preference to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('tom-language', language);
  }, [language]);

  const t = (key) => {
    return translations[language][key] || translations['en'][key] || key;
  };

  const changeLanguage = (newLanguage) => {
    if (translations[newLanguage]) {
      setLanguage(newLanguage);
    }
  };

  return (
    <LanguageContext.Provider value={{ language, t, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
