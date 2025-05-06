import { useState } from 'react';

import MainLayout from '@/components/layout/MainLayout';
import CSVGrid from '@/components/common/CSVGrid';

import { CSVParseResult, ColumnType } from '@/types/csv';

const Home = () => {
  const [csvData, setCsvData] = useState<string[][]>();
  const [columnTypes, setColumnTypes] = useState<ColumnType[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [stats, setStats] = useState<{ rows: number; columns: number } | null>(null);
  
  const handleDataLoad = (result: CSVParseResult) => {
    setCsvData(result.data);
    setColumnTypes(result.columnTypes);
    setFileName(result.fileName);
    setStats({
      rows: result.rowCount,
      columns: result.columnCount
    });
  };
  
  return (
    <MainLayout onDataLoad={handleDataLoad}>
      <div className="p-6 h-full flex flex-col bg-background">
        <div className="mb-4">
          <h2 className="text-xl font-heading font-semibold">
            {fileName ? `Editing: ${fileName}` : 'Playground'}
          </h2>
          <p className="text-white text-opacity-70 text-sm">
            {csvData 
              ? `${stats?.rows.toLocaleString()} rows × ${stats?.columns.toLocaleString()} columns | Click on any cell to edit.` 
              : 'Upload a CSV file to get started.'}
          </p>
        </div>
        <div className="flex-1 overflow-hidden">
          <CSVGrid data={csvData} columnTypes={columnTypes} />
        </div>
      </div>
    </MainLayout>
  );
};

export default Home;