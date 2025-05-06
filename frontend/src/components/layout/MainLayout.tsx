import type { ReactNode } from 'react';
import Sidebar from './Sidebar';

import type { CSVParseResult } from '../../types/csv';

type MainLayoutProps = {
  children: ReactNode;
  onDataLoad: (result: CSVParseResult) => void;
};

const MainLayout = ({ children, onDataLoad }: MainLayoutProps) => {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar onDataLoad={onDataLoad} />
      <main className="flex-1 overflow-hidden">
        {children}
      </main>
    </div>
  );
};

export default MainLayout;