import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import type { PythonScript } from '@/lib/python/types';

interface NotebookEditorProps {
  isOpen: boolean;
  onClose: () => void;
  script: PythonScript | null;
  onUpdate: (updates: Partial<PythonScript>) => void;
  title?: string;
}

export const NotebookEditor: React.FC<NotebookEditorProps> = ({
  isOpen,
  onClose,
  script,
  onUpdate,
  title,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // Update local state when script changes
  useEffect(() => {
    if (script) {
      setName(script.name || '');
      setDescription(script.description || '');
    } else {
      setName('');
      setDescription('');
    }
  }, [script]);

  const handleNameChange = (newName: string) => {
    setName(newName);
    onUpdate({ name: newName });
  };

  const handleDescriptionChange = (newDescription: string) => {
    setDescription(newDescription);
    onUpdate({ description: newDescription });
  };

  if (!isOpen) return null;

  return (
    <div className="bg-black border border-white/10 rounded shadow-xl min-w-80 p-4">
      <h3 className="text-sm font-medium text-white mb-3">{title || t('ui.notebookEditor.title', { defaultValue: 'Edit Notebook' })}</h3>
      
      <div className="space-y-3">
        <div>
          <label className="block text-xs text-white/60 mb-1">{t('ui.notebookEditor.nameLabel', { defaultValue: 'Name' })}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder={t('ui.notebookEditor.namePlaceholder', { defaultValue: 'Untitled Notebook' })}
            className="w-full px-3 py-2 bg-background border border-white/10 rounded text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-primary/50"
            autoFocus
          />
        </div>
        
        <div>
          <label className="block text-xs text-white/60 mb-1">{t('ui.notebookEditor.descriptionLabel', { defaultValue: 'Description' })}</label>
          <textarea
            value={description}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            placeholder={t('ui.notebookEditor.descriptionPlaceholder', { defaultValue: 'Optional description...' })}
            rows={3}
            className="w-full px-3 py-2 bg-background border border-white/10 rounded text-sm text-white placeholder:text-white/50 focus:outline-none focus:border-primary/50 resize-none"
          />
        </div>
        
        <div className="pt-2 border-t border-white/10">
          <p className="text-xs text-white/50 text-center">
            {t('ui.notebookEditor.autoSaveMessage', { defaultValue: 'Changes are saved automatically' })}
          </p>
        </div>
      </div>
    </div>
  );
};