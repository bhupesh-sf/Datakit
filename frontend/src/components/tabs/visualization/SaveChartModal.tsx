
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useChartsStore } from '@/store/chartsStore';
import { X, Save, Star } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Modal for saving charts with name and options
 */
const SaveChartModal: React.FC = () => {
  const { t } = useTranslation();
  const { 
    isSaveModalOpen, 
    toggleSaveModal, 
    currentChart,
    saveCurrentChart
  } = useChartsStore();
  
  const [chartName, setChartName] = useState<string>(
    currentChart?.title || t('visualization.saveChart.myChart')
  );
  const [chartDescription, setChartDescription] = useState<string>(
    currentChart?.description || ''
  );
  const [saveAsTemplate, setSaveAsTemplate] = useState<boolean>(false);
  
  if (!isSaveModalOpen || !currentChart) return null;
  
  const handleSave = () => {
    // Update chart title and description
    if (currentChart) {
      currentChart.title = chartName;
      currentChart.description = chartDescription;
      
      // Save chart (as template if selected)
      saveCurrentChart(saveAsTemplate);
    }
    
    // Close modal
    toggleSaveModal(false);
  };
  
  return (
    <div className="fixed inset-0 bg-black flex items-center justify-center z-50">
      <div className="bg-darkNav p-6 rounded-lg shadow-lg w-96 max-w-full">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium">{t('visualization.saveChart.title')}</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => toggleSaveModal(false)}
          >
            <X size={16} />
          </Button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">{t('visualization.saveChart.chartName')}</label>
            <input
              type="text"
              value={chartName}
              onChange={(e) => setChartName(e.target.value)}
              className="w-full p-2 bg-background border border-white/10 rounded text-white"
              placeholder={t('visualization.saveChart.enterChartName')}
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">{t('visualization.saveChart.descriptionOptional')}</label>
            <textarea
              value={chartDescription}
              onChange={(e) => setChartDescription(e.target.value)}
              className="w-full p-2 bg-background border border-white/10 rounded text-white h-20 resize-none"
              placeholder={t('visualization.saveChart.enterChartDescription')}
            />
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="save-as-template"
              checked={saveAsTemplate}
              onChange={(e) => setSaveAsTemplate(e.target.checked)}
              className="mr-2"
            />
            <label htmlFor="save-as-template" className="text-sm flex items-center">
              <Star size={14} className="mr-1 text-secondary" />
              {t('visualization.saveChart.saveAsTemplate')}
            </label>
          </div>
        </div>
        
        <div className="mt-6 flex space-x-2">
          <Button
            variant="ghost"
            onClick={() => toggleSaveModal(false)}
          >
            {t('common.cancel')}
          </Button>
          
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleSave}
            disabled={!chartName.trim()}
          >
            <Save size={16} className="mr-1" />
            {t('visualization.saveChart.saveChart')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SaveChartModal;