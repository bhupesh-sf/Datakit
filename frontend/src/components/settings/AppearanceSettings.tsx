import React, { useState, useEffect } from 'react';
import { Monitor, Sun, Moon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '@/components/common/LanguageSwitcher';
import { applyThemeColor } from '@/utils/theme';

const AppearanceSettings: React.FC = () => {
  const { t } = useTranslation();
  const [currentColor, setCurrentColor] = useState('#00B8A9');

  useEffect(() => {
    const savedColor = localStorage.getItem('theme-primary-color');
    if (savedColor) {
      setCurrentColor(savedColor);
    }
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme-primary-color' && e.newValue) {
        setCurrentColor(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    const interval = setInterval(() => {
      const savedColor = localStorage.getItem('theme-primary-color');
      if (savedColor && savedColor !== currentColor) {
        setCurrentColor(savedColor);
      }
    }, 100);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [currentColor]);

  const presetThemes = [
    { name: t('settings.appearance.themes.datakitTeal'), color: '#00B8A9' },
    { name: t('settings.appearance.themes.oceanBlue'), color: '#3498db' },
    { name: t('settings.appearance.themes.royalPurple'), color: '#9b59b6' },
    { name: t('settings.appearance.themes.vibrantRed'), color: '#e74c3c' },
    { name: t('settings.appearance.themes.forestGreen'), color: '#2ecc71' },
    { name: t('settings.appearance.themes.coralPink'), color: '#ff6b6b' },
  ];

  const handleThemeSelect = (color: string) => {
    setCurrentColor(color);
    applyThemeColor(color);
    localStorage.setItem('theme-primary-color', color);
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-white mb-1">{t('settings.appearance.title')}</h3>
        <p className="text-sm text-white/60">{t('settings.appearance.description')}</p>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-6 h-6 rounded-md border border-white/30"
              style={{ backgroundColor: currentColor }}
            />
            <div>
              <div className="text-sm font-medium text-white">{t('settings.appearance.current')}</div>
              <div className="text-xs text-white/60">{currentColor.toUpperCase()}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-2">
          {presetThemes.map((theme) => (
            <button
              key={theme.color}
              onClick={() => handleThemeSelect(theme.color)}
              className={`p-2 rounded-md border transition-all text-left hover:border-white/30 ${
                currentColor === theme.color
                  ? 'bg-white/10 border-primary/50'
                  : 'bg-white/5 border-white/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-sm border border-white/30 flex-shrink-0"
                  style={{ backgroundColor: theme.color }}
                />
                <div className="text-xs text-white truncate">
                  {theme.name}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 pt-4">
        <div className="opacity-50 cursor-not-allowed">
          <h4 className="text-sm font-medium text-white/60 mb-2 flex items-center gap-2">
            <Monitor className="h-4 w-4" />
{t('settings.appearance.displayMode')}
          </h4>
          <p className="text-xs text-white/40 mb-3">{t('common.comingSoon')}</p>
          
          <div className="grid grid-cols-3 gap-2">
            <div className="p-2 rounded-md bg-white/5 border border-white/10 text-center">
              <Monitor className="h-4 w-4 mx-auto mb-1 text-white/40" />
              <div className="text-xs text-white/40">{t('settings.appearance.modes.system')}</div>
            </div>
            <div className="p-2 rounded-md bg-white/5 border border-white/10 text-center">
              <Sun className="h-4 w-4 mx-auto mb-1 text-white/40" />
              <div className="text-xs text-white/40">{t('settings.appearance.modes.light')}</div>
            </div>
            <div className="p-2 rounded-md bg-white/10 border border-primary/30 text-center">
              <Moon className="h-4 w-4 mx-auto mb-1 text-primary/60" />
              <div className="text-xs text-primary/60">{t('settings.appearance.modes.dark')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppearanceSettings;