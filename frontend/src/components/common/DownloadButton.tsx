import { Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';

interface DownloadButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function DownloadButton({ onClick, disabled = false }: DownloadButtonProps) {
  const { t } = useTranslation();
  
  return (
    <Button
      type="button"
      variant="outline"
      className="bg-transparent border-primary text-foreground hover:bg-primary/10 hover:text-primary transition-colors ml-2"
      onClick={onClick}
      disabled={disabled}
      title={t('common.download.csvTitle', { defaultValue: 'Download CSV' })}
    >
      <Download size={16} />
    </Button>
  );
}