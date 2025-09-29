import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

interface SaveDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string) => void;
  title?: string;
  placeholder?: string;
  initialValue?: string;
  disabled?: boolean;
}

export const SaveDialog: React.FC<SaveDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  title,
  placeholder,
  initialValue = '',
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState(initialValue);

  // Reset name when dialog opens/closes
  useEffect(() => {
    if (isOpen) {
      setName(initialValue);
    }
  }, [isOpen, initialValue]);

  // Handle save
  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim());
      setName('');
    }
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/60 flex items-center justify-center z-50">
      <div className="bg-darkNav p-4 rounded-lg shadow-lg w-96">
        <h3 className="text-lg font-medium mb-4">{title || t('common.save', { defaultValue: 'Save' })}</h3>
        <input
          type="text"
          className="w-full p-2 bg-background border border-white/10 rounded mb-4 text-white placeholder:text-white/50 focus:outline-none focus:border-primary/50"
          placeholder={placeholder || t('common.enterName', { defaultValue: 'Enter name' })}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyPress}
          autoFocus
          disabled={disabled}
        />
        <div className="flex justify-end space-x-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={disabled}
          >
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            disabled={!name.trim() || disabled}
          >
            {t('common.save', { defaultValue: 'Save' })}
          </Button>
        </div>
      </div>
    </div>
  );
};