import { Database } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface QueryButtonProps {
  onClick: () => void;
  isActive: boolean;
  disabled?: boolean;
}

export function QueryButton({ onClick, isActive, disabled = false }: QueryButtonProps) {
  return (
    <Button
      type="button"
      variant="outline"
      className={`
        bg-transparent border-primary/70 text-foreground relative overflow-hidden
        hover:bg-primary/10 hover:border-primary hover:text-primary transition-custom
        ${isActive ? 'bg-primary/10 text-primary border-primary' : ''}
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
      onClick={onClick}
      disabled={disabled}
    >
      <Database size={14} className="mr-1.5" />
      <span>SQL Query</span>
      
      {isActive && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
      )}
    </Button>
  );
}