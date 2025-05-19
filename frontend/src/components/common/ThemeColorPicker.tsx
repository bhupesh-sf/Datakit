import { useState, useEffect } from 'react';
import { Paintbrush } from 'lucide-react';

import {applyThemeColor} from '@/utils/theme';

interface ThemeColorPickerProps {
  defaultColor?: string;
}

export const ThemeColorPicker = ({ defaultColor = '#00B8A9' }: ThemeColorPickerProps) => {
  const [color, setColor] = useState(defaultColor);
  const [isOpen, setIsOpen] = useState(false);

  // Load saved color on mount
  useEffect(() => {
    const savedColor = localStorage.getItem('theme-primary-color');
    if (savedColor) {
      setColor(savedColor);
      applyThemeColor(savedColor);
    }
  }, []);

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newColor = e.target.value;
    setColor(newColor);
    applyThemeColor(newColor);
    localStorage.setItem('theme-primary-color', newColor);
  };


  return (
    <div className="bg-black relative flex items-center">
      <button 
        className="flex items-center gap-2 text-xs text-white text-opacity-70 hover:text-opacity-100 cursor-pointer"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>Theme Color</span>
        <div 
          className="w-3 h-3 rounded-full border border-white border-opacity-30" 
          style={{ backgroundColor: color }}
        ></div>
      </button>
      
      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 p-2 bg-black border border-white border-opacity-10 rounded-md shadow-lg">
          <div className="flex flex-col gap-2">
            <label className="text-xs text-white text-opacity-70">Pick a color:</label>
            <input 
              type="color"
              value={color}
              onChange={handleColorChange}
              className="w-full h-8 cursor-pointer border-none overflow-hidden rounded"
            />
            <div className="grid grid-cols-5 gap-1 mt-1">
              {['#00B8A9', '#3498db', '#9b59b6', '#e74c3c', '#f1c40f'].map((presetColor) => (
                <button
                  key={presetColor}
                  className="w-5 h-5 rounded-full border border-white border-opacity-30 cursor-pointer"
                  style={{ backgroundColor: presetColor }}
                  onClick={() => {
                    setColor(presetColor);
                    applyThemeColor(presetColor);
                    setIsOpen(!isOpen)
                    localStorage.setItem('theme-primary-color', presetColor);
                  }}
                ></button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};