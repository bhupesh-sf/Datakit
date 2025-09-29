import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';

interface UnsavedChangesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  onDiscard: () => void;
  title?: string;
  message?: string;
  saveButtonText?: string;
  discardButtonText?: string;
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  onDiscard,
  title,
  message,
  saveButtonText,
  discardButtonText,
}) => {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 backdrop-blur-sm bg-black/60 flex items-center justify-center z-50">
      <div className="bg-darkNav p-6 rounded-lg shadow-lg w-96 max-w-[90vw]">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-6 h-6 bg-yellow-500/20 rounded-full flex items-center justify-center">
            <span className="text-yellow-400 text-sm">!</span>
          </div>
          <h3 className="text-lg font-medium text-white">{title || t('dialog.unsavedChanges.title', { defaultValue: 'Unsaved Changes' })}</h3>
        </div>
        
        <p className="text-white/70 mb-6 leading-relaxed">
          {message || t('dialog.unsavedChanges.message', { defaultValue: 'You have unsaved changes in your current notebook. What would you like to do?' })}
        </p>
        
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="border-primary hover:border-primary/80 justify-center"
            onClick={onSave}
          >
            {saveButtonText || t('dialog.unsavedChanges.saveAndContinue', { defaultValue: 'Save and Continue' })}
          </Button>
          <Button
            variant="outline"
            className="justify-center"
            onClick={onDiscard}
          >
            {discardButtonText || t('dialog.unsavedChanges.discardChanges', { defaultValue: 'Discard Changes' })}
          </Button>
          <Button
            variant="ghost"
            className="justify-center"
            onClick={onClose}
          >
            {t('common.cancel', { defaultValue: 'Cancel' })}
          </Button>
        </div>
      </div>
    </div>
  );
};