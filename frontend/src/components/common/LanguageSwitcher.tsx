import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Languages, Check, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/Button";
import { Tooltip } from "@/components/ui/Tooltip";

interface LanguageSwitcherProps {
  variant?: 'default' | 'sidebar';
}

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export const LanguageSwitcher = ({
  variant = 'default',
}: LanguageSwitcherProps) => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [buttonRect, setButtonRect] = useState<DOMRect | null>(null);

  const languages: Language[] = [
    {
      code: 'en',
      name: 'English',
      nativeName: 'English',
      flag: '🇺🇸',
    },
    {
      code: 'pt',
      name: 'Portuguese',
      nativeName: 'Português',
      flag: '🇧🇷',
    },
  ];

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  const handleToggle = () => {
    if (variant === 'sidebar' && buttonRef.current) {
      setButtonRect(buttonRef.current.getBoundingClientRect());
    }
    setIsOpen(!isOpen);
  };

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
    setIsOpen(false);
  };

  const renderPanel = () => (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Language Picker Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            transition={{ 
              type: "spring",
              stiffness: 400,
              damping: 25,
              duration: 0.2
            }}
            className="fixed p-3 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 min-w-[180px]"
            style={{
              top: variant === 'sidebar' && buttonRect 
                ? buttonRect.top - 100 // Position above the button
                : undefined,
              left: variant === 'sidebar' && buttonRect 
                ? Math.min(buttonRect.left - 60, window.innerWidth - 200) // Ensure it stays on screen
                : undefined,
            }}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2 py-1">
                <Languages size={12} className="text-white/40" />
                <span className="text-xs font-medium text-white/60 uppercase tracking-wide">Language</span>
              </div>
              
              {/* Language Options */}
              <div className="space-y-0.5">
                {languages.map((language) => (
                  <motion.button
                    key={language.code}
                    whileHover={{ scale: 1.02, x: 2 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all duration-200 group ${
                      currentLanguage.code === language.code
                        ? 'bg-primary/15 text-white border border-primary/25 shadow-sm'
                        : 'text-white/75 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
                    }`}
                    onClick={() => handleLanguageChange(language.code)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl filter drop-shadow-sm">{language.flag}</span>
                      <div className="flex flex-col">
                        <span className={`text-sm font-medium ${
                          currentLanguage.code === language.code ? 'text-white' : 'text-white/90'
                        }`}>
                          {language.name}
                        </span>
                        <span className="text-xs text-white/40">{language.nativeName}</span>
                      </div>
                    </div>
                    {currentLanguage.code === language.code && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      >
                        <Check size={12} className="text-primary" />
                      </motion.div>
                    )}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Sidebar version - minimal button
  if (variant === 'sidebar') {
    return (
      <div className="relative flex items-center">
        <Tooltip content={`Language: ${currentLanguage.nativeName}`} placement="top">
          <motion.button
            ref={buttonRef}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1 p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-all duration-200"
            onClick={handleToggle}
          >
            <span className="text-lg filter drop-shadow-sm">{currentLanguage.flag}</span>
            <ChevronDown 
              size={10} 
              className={`text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
            />
          </motion.button>
        </Tooltip>

        {/* Render panel via portal for sidebar variant */}
        {typeof document !== 'undefined' && createPortal(renderPanel(), document.body)}
      </div>
    );
  }

  // Default version - more detailed button
  return (
    <div className="relative flex items-center">
      <Button
        ref={buttonRef}
        variant="ghost"
        size="sm"
        onClick={handleToggle}
        className="flex items-center gap-2 px-3 py-2 h-auto text-white/80 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-all duration-200"
      >
        <span className="text-lg filter drop-shadow-sm">{currentLanguage.flag}</span>
        <span className="text-xs font-medium">{currentLanguage.name}</span>
        <ChevronDown 
          size={12} 
          className={`text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </Button>

      {/* Render panel directly for default variant */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Language Picker Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ 
                type: "spring",
                stiffness: 400,
                damping: 25,
                duration: 0.2 
              }}
              className="absolute bottom-full left-0 mb-2 p-3 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 min-w-[180px]"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-2 py-1">
                  <Languages size={12} className="text-white/40" />
                  <span className="text-xs font-medium text-white/60 uppercase tracking-wide">Language</span>
                </div>
                
                {/* Language Options */}
                <div className="space-y-0.5">
                  {languages.map((language) => (
                    <motion.button
                      key={language.code}
                      whileHover={{ scale: 1.02, x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg text-left transition-all duration-200 group ${
                        currentLanguage.code === language.code
                          ? 'bg-primary/15 text-white border border-primary/25 shadow-sm'
                          : 'text-white/75 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10'
                      }`}
                      onClick={() => handleLanguageChange(language.code)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl filter drop-shadow-sm">{language.flag}</span>
                        <div className="flex flex-col">
                          <span className={`text-sm font-medium ${
                            currentLanguage.code === language.code ? 'text-white' : 'text-white/90'
                          }`}>
                            {language.name}
                          </span>
                          <span className="text-xs text-white/40">{language.nativeName}</span>
                        </div>
                      </div>
                      {currentLanguage.code === language.code && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 25 }}
                        >
                          <Check size={12} className="text-primary" />
                        </motion.div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};