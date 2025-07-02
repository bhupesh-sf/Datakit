import React, { useState, useEffect } from 'react';
import { Palette, Monitor, Sun, Moon } from 'lucide-react';
import { ThemeColorPicker } from '@/components/common/ThemeColorPicker';
import { applyThemeColor } from '@/utils/theme';

const AppearanceSettings: React.FC = () => {
  const [currentColor, setCurrentColor] = useState('#00B8A9');

  // Load current theme color
  useEffect(() => {
    const savedColor = localStorage.getItem('theme-primary-color');
    if (savedColor) {
      setCurrentColor(savedColor);
    }
  }, []);

  // Listen for theme color changes from other components
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'theme-primary-color' && e.newValue) {
        setCurrentColor(e.newValue);
      }
    };

    // Listen for localStorage changes from other tabs
    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for changes within the same tab
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
    { name: 'DataKit Teal', color: '#00B8A9', description: 'Our signature teal color' },
    { name: 'Ocean Blue', color: '#3498db', description: 'Calm and professional' },
    { name: 'Royal Purple', color: '#9b59b6', description: 'Creative and sophisticated' },
    { name: 'Vibrant Red', color: '#e74c3c', description: 'Bold and energetic' },
    { name: 'Sunny Yellow', color: '#f1c40f', description: 'Bright and optimistic' },
    { name: 'Forest Green', color: '#2ecc71', description: 'Natural and refreshing' },
    { name: 'Coral Pink', color: '#ff6b6b', description: 'Warm and friendly' },
    { name: 'Mint Fresh', color: '#4ecdc4', description: 'Clean and modern' },
  ];

  const handleThemeSelect = (color: string) => {
    setCurrentColor(color);
    applyThemeColor(color);
    localStorage.setItem('theme-primary-color', color);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-white mb-2">Appearance</h3>
        <p className="text-sm text-white/60">
          Customize the look and feel of DataKit
        </p>
      </div>

      {/* Theme Color Section */}
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Theme Color
          </h4>
          <p className="text-xs text-white/60 mb-4">
            Choose a primary color that reflects your style
          </p>
        </div>

        {/* Current Color Display */}
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg border-2 border-white/30"
                style={{ backgroundColor: currentColor }}
              />
              <div>
                <div className="text-sm font-medium text-white">Current Theme</div>
                <div className="text-xs text-white/60">{currentColor.toUpperCase()}</div>
              </div>
            </div>
            <ThemeColorPicker />
          </div>
        </div>

        {/* Preset Themes */}
        <div>
          <h5 className="text-sm font-medium text-white/80 mb-3">Popular Themes</h5>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {presetThemes.map((theme) => (
              <button
                key={theme.color}
                onClick={() => handleThemeSelect(theme.color)}
                className={`p-3 rounded-lg border transition-all text-left hover:border-white/30 ${
                  currentColor === theme.color
                    ? 'bg-white/10 border-primary/50'
                    : 'bg-white/5 border-white/10'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-6 h-6 rounded-lg border-2 border-white/30 flex-shrink-0"
                    style={{ backgroundColor: theme.color }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {theme.name}
                    </div>
                    <div className="text-xs text-white/60 truncate">
                      {theme.description}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Dark Mode Section (Future Feature) */}
      <div className="border-t border-white/10 pt-6">
        <div className="opacity-50 cursor-not-allowed">
          <h4 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Display Mode
          </h4>
          <p className="text-xs text-white/40 mb-4">
            Choose between light and dark themes (Coming Soon)
          </p>
          
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
              <Monitor className="h-6 w-6 mx-auto mb-2 text-white/40" />
              <div className="text-xs text-white/40">System</div>
            </div>
            <div className="p-3 rounded-lg bg-white/5 border border-white/10 text-center">
              <Sun className="h-6 w-6 mx-auto mb-2 text-white/40" />
              <div className="text-xs text-white/40">Light</div>
            </div>
            <div className="p-3 rounded-lg bg-white/10 border border-primary/30 text-center">
              <Moon className="h-6 w-6 mx-auto mb-2 text-primary/60" />
              <div className="text-xs text-primary/60">Dark</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tips Section */}
      {/* <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <Palette className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-white mb-1">Pro Tip</p>
            <p className="text-xs text-white/70">
              Your theme color affects buttons, links, and accent elements throughout DataKit. 
              Choose a color that's easy on the eyes for long data analysis sessions.
            </p>
          </div>
        </div>
      </div> */}
    </div>
  );
};

export default AppearanceSettings;