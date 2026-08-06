import React, { useState } from 'react';
import { useLanguage } from './LanguageContext.jsx';

export const LanguageSelector = () => {
  const { language, changeLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const languages = [
    { code: 'en', name: 'English', flag: '🇬🇧' },
    { code: 'es', name: 'Español', flag: '🇪🇸' },
    { code: 'tr', name: 'Türkçe', flag: '🇹🇷' },
  ];

  const currentLang = languages.find(l => l.code === language);

  const handleLanguageChange = (code) => {
    changeLanguage(code);
    setIsOpen(false);
  };

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      zIndex: 1000,
      fontFamily: 'inherit',
    }}>
      <div style={{
        position: 'relative',
      }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            background: '#7B2CBF', // TOM royal purple
            color: 'white',
            border: 'none',
            borderRadius: '50px',
            padding: '10px 16px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(123, 44, 191, 0.3)',
            transition: 'all 0.2s ease',
            hover: {
              boxShadow: '0 6px 16px rgba(123, 44, 191, 0.4)',
            },
          }}
          onMouseEnter={(e) => {
            e.target.style.boxShadow = '0 6px 16px rgba(123, 44, 191, 0.4)';
            e.target.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.target.style.boxShadow = '0 4px 12px rgba(123, 44, 191, 0.3)';
            e.target.style.transform = 'translateY(0)';
          }}
        >
          <span>{currentLang?.flag}</span>
          <span>{currentLang?.code.toUpperCase()}</span>
          <span style={{
            transition: 'transform 0.2s ease',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            display: 'inline-block',
            marginLeft: '4px',
          }}>▼</span>
        </button>

        {isOpen && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            right: 0,
            marginBottom: '8px',
            background: 'white',
            border: '1px solid #e0e0e0',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
            minWidth: '160px',
            overflow: 'hidden',
          }}>
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleLanguageChange(lang.code)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: 'none',
                  background: language === lang.code ? '#f0e6ff' : 'white',
                  color: language === lang.code ? '#7B2CBF' : '#333',
                  fontSize: '14px',
                  fontWeight: language === lang.code ? '600' : '500',
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'all 0.15s ease',
                  borderBottom: lang.code !== languages[languages.length - 1].code ? '1px solid #f0f0f0' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (language !== lang.code) {
                    e.target.style.background = '#fafafa';
                  }
                }}
                onMouseLeave={(e) => {
                  if (language !== lang.code) {
                    e.target.style.background = 'white';
                  }
                }}
              >
                <span>{lang.flag}</span>
                <span>{lang.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 640px) {
          div[style*="position: fixed"] {
            bottom: 16px !important;
            right: 16px !important;
          }
        }
      `}</style>
    </div>
  );
};
