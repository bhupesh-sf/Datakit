import React from 'react';
import { useTranslation } from 'react-i18next';

const Viewer: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div>
      <h1 className="text-3xl font-bold text-white mb-4">{t('viewer.placeholder')}</h1>
      <p className="text-muted-foreground">
        {t('viewer.placeholder')}
      </p>
    </div>
  );
};

export default Viewer;