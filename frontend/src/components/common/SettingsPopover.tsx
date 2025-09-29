import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Settings, Palette, Languages, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Tooltip } from "@/components/ui/Tooltip";
import { applyThemeColor } from "@/utils/theme";

interface SettingsPopoverProps {
  variant?: 'default' | 'sidebar';
}

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
}

export const SettingsPopover = ({
  variant = 'default',
}: SettingsPopoverProps) => {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentColor, setCurrentColor] = useState("#00B8A9");
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

  const presetColors = [
    { color: "#00B8A9", name: "Teal" },
    { color: "#3498db", name: "Blue" },
    { color: "#9b59b6", name: "Purple" },
    { color: "#e74c3c", name: "Red" },
    { color: "#f1c40f", name: "Yellow" },
    { color: "#2ecc71", name: "Green" },
    { color: "#ff6b6b", name: "Coral" },
    { color: "#fff", name: "White" },
  ];

  const currentLanguage = languages.find(lang => lang.code === i18n.language) || languages[0];

  // Load saved color on mount
  useEffect(() => {
    const savedColor = localStorage.getItem("theme-primary-color");
    if (savedColor) {
      setCurrentColor(savedColor);
    }
  }, []);

  const handleToggle = () => {
    if (variant === 'sidebar' && buttonRef.current) {
      setButtonRect(buttonRef.current.getBoundingClientRect());
    }
    setIsOpen(!isOpen);
  };

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
  };

  const handleColorChange = (color: string) => {
    setCurrentColor(color);
    applyThemeColor(color);
    localStorage.setItem("theme-primary-color", color);
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
          
          {/* Settings Panel */}
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
            className="fixed p-4 bg-darkNav/90 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl z-50 w-56"
            style={{
              top: variant === 'sidebar' && buttonRect 
                ? buttonRect.top - 280 // Position above the button
                : undefined,
              left: variant === 'sidebar' && buttonRect 
                ? Math.min(buttonRect.left - 120, window.innerWidth - 300) // Ensure it stays on screen
                : undefined,
            }}
          >
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings size={14} className="text-white/60" />
                  <span className="text-sm font-medium text-white">{t('settingsPopover.title', { defaultValue: 'Settings' })}</span>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsOpen(false)}
                  className="p-1 rounded-md text-white/40 hover:text-white/80 hover:bg-white/5 transition-colors"
                >
                  <X size={14} />
                </motion.button>
              </div>

              {/* Language Section */}
              <div className="space-y-2">
                <label className="text-xs text-white/60">{t('settingsPopover.language', { defaultValue: 'Language' })}</label>
                
                <div className="space-y-1">
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
                        <span className="text-lg filter drop-shadow-sm">{language.flag}</span>
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

              {/* Theme Color Section */}
              <div className="space-y-2">
                <label className="text-xs text-white/60">{t('settingsPopover.presets', { defaultValue: 'Presets' })}</label>

                <div className="grid grid-cols-4 gap-2">
                  {presetColors.map(({ color, name }) => (
                    <motion.button
                      key={color}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      className={`w-10 h-10 rounded-lg border-2 transition-all ${
                        currentColor === color
                          ? 'border-white/60 ring-2 ring-white/30'
                          : 'border-white/20 hover:border-white/40'
                      }`}
                      style={{ backgroundColor: color }}
                      onClick={() => handleColorChange(color)}
                      title={name}
                    />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <div className="relative flex items-center">
        <motion.button
          ref={buttonRef}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-all duration-200 border border-transparent hover:border-white/10"
          onClick={handleToggle}
        >
          {/* Current Theme Color */}
          <div
            className="w-4 h-4 rounded-full border border-white/30 shadow-sm"
            style={{ backgroundColor: currentColor }}
          />
          
          {/* Current Language Flag */}
          <span className="text-xl filter drop-shadow-sm">{currentLanguage.flag}</span>
        </motion.button>

      {/* Render panel via portal for sidebar variant */}
      {variant === 'sidebar' && typeof document !== 'undefined' && 
        createPortal(renderPanel(), document.body)
      }

      {/* Render panel directly for default variant */}
      {variant === 'default' && renderPanel()}
    </div>
  );
};