import { useState, useRef, useEffect } from 'react';
import { format } from 'sql-formatter'; // Import the SQL formatter

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  placeholder?: string;
  className?: string;
}

export function CodeEditor({
  value,
  onChange,
  language = 'sql',
  placeholder = 'Enter SQL query...',
  className = '',
}: CodeEditorProps) {
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  // Auto resize the textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(textarea.scrollHeight, 100)}px`;
  }, [value]);

  // Format SQL function
  const formatSQL = () => {
    try {
      const formatted = format(value, {
        language: 'sql',
        keywordCase: 'upper',
        tabWidth: 2,
        linesBetweenQueries: 2,
      });
      onChange(formatted);
    } catch (err) {
      console.error('Error formatting SQL:', err);
    }
  };

  return (
    <div className={`relative rounded overflow-hidden ${className}`}>
      <div className="flex items-center justify-between bg-darkNav px-3 py-1.5 border-b border-white/10">
        <div className="text-xs font-medium text-white/70">{language.toUpperCase()}</div>
        
        {language === 'sql' && (
          <button 
            onClick={formatSQL}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            Format
          </button>
        )}
      </div>
      
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="w-full min-h-[120px] bg-background text-white p-4 font-mono text-sm outline-none resize-none border-none"
          spellCheck="false"
        />
        
        {/* Syntax highlighting overlay */}
        {language === 'sql' && (
          <div 
            className="absolute inset-0 pointer-events-none p-4 font-mono text-sm"
            aria-hidden="true"
          >
            {value.split(/\b/).map((part, i) => {
              // SQL keywords to highlight
              const keywords = [
                'SELECT', 'FROM', 'WHERE', 'ORDER BY', 'GROUP BY', 'LIMIT',
                'JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'INNER JOIN', 'OUTER JOIN',
                'ON', 'AS', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN',
                'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'HAVING', 'DISTINCT',
                'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'UNION', 'ALL',
                'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP',
                'TABLE', 'VIEW', 'INDEX', 'CONSTRAINT', 'PRIMARY KEY',
                'FOREIGN KEY', 'DEFAULT', 'NULL', 'TRUE', 'FALSE'
              ];
              
              const upperPart = part.toUpperCase();
              if (keywords.includes(upperPart)) {
                return <span key={i} className="text-secondary">{part}</span>;
              } else if (/^[0-9]+$/.test(part)) {
                return <span key={i} className="text-tertiary">{part}</span>;
              } else if (part.startsWith("'") || part.startsWith('"')) {
                return <span key={i} className="text-primary/80">{part}</span>;
              }
              
              return <span key={i}>{part}</span>;
            })}
          </div>
        )}
      </div>
      
      {/* Focus outline */}
      <div className={`absolute inset-0 rounded pointer-events-none transition-opacity duration-200 ${
        isFocused ? 'opacity-100' : 'opacity-0'
      } border-2 border-primary/50`}></div>
    </div>
  );
}