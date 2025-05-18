import React, { useState } from 'react';
import { useChartsStore } from '@/store/chartsStore';
import { BarChart4, Save, RefreshCw, Trash, PencilLine, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import DataTransforms from './DataTransforms';

/**
 * Component for configuring chart settings
 */
const ChartConfigPanel: React.FC = () => {
  const { 
    currentChart, 
    updateCurrentChart, 
    saveCurrentChart, 
    colorPalettes,
    toggleSaveModal,
    toggleExportModal
  } = useChartsStore();
  
  const [activeTab, setActiveTab] = useState<'data' | 'style' | 'transforms'>('data');
  
  if (!currentChart) {
    return (
      <div className="p-4 text-center">
        <BarChart4 size={48} className="mx-auto mb-4 text-white/40" />
        <h3 className="text-lg font-medium mb-2">No Chart Selected</h3>
        <p className="text-sm text-white/60">
          Execute a query first or select a chart from the gallery to customize.
        </p>
      </div>
    );
  }
  
 const availableFields = currentChart.data && currentChart.data.length > 0
   ? Object.keys(currentChart.data[0])
   : [];
 
 return (
   <div className="p-4">
     <div className="mb-4">
       <input
         type="text"
         value={currentChart.title}
         onChange={(e) => updateCurrentChart({ title: e.target.value })}
         className="w-full p-2 bg-background border border-white/10 rounded text-white"
         placeholder="Chart Title"
       />
     </div>
     
     <div className="mb-4">
       <textarea
         value={currentChart.description || ''}
         onChange={(e) => updateCurrentChart({ description: e.target.value })}
         className="w-full p-2 bg-background border border-white/10 rounded text-white h-20 resize-none"
         placeholder="Chart Description (optional)"
       />
     </div>
     
     {/* Tab navigation */}
     <div className="flex border-b border-white/10 mb-4">
       <button
         className={`px-3 py-2 text-sm ${
           activeTab === 'data' 
             ? 'text-primary border-b-2 border-primary -mb-px' 
             : 'text-white/70 hover:text-white/90'
         }`}
         onClick={() => setActiveTab('data')}
       >
         Data
       </button>
       <button
         className={`px-3 py-2 text-sm ${
           activeTab === 'style' 
             ? 'text-primary border-b-2 border-primary -mb-px' 
             : 'text-white/70 hover:text-white/90'
         }`}
         onClick={() => setActiveTab('style')}
       >
         Styles
       </button>
       <button
         className={`px-3 py-2 text-sm ${
           activeTab === 'transforms' 
             ? 'text-primary border-b-2 border-primary -mb-px' 
             : 'text-white/70 hover:text-white/90'
         }`}
         onClick={() => setActiveTab('transforms')}
       >
         Transforms
       </button>
     </div>
     
     {/* Data mapping tab */}
     {activeTab === 'data' && (
       <div className="space-y-4">
         {/* X-Axis Configuration */}
         <div>
           <label className="block text-sm font-medium mb-1">X-Axis Field</label>
           <select
             value={currentChart.xAxis.field}
             onChange={(e) => updateCurrentChart({
               xAxis: { ...currentChart.xAxis, field: e.target.value, dataKey: e.target.value }
             })}
             className="w-full p-2 bg-background border border-white/10 rounded text-white"
           >
             {availableFields.map(field => (
               <option key={field} value={field}>{field}</option>
             ))}
           </select>
         </div>
         
         <div>
           <label className="block text-sm font-medium mb-1">X-Axis Label</label>
           <input
             type="text"
             value={currentChart.xAxis.label}
             onChange={(e) => updateCurrentChart({
               xAxis: { ...currentChart.xAxis, label: e.target.value }
             })}
             className="w-full p-2 bg-background border border-white/10 rounded text-white"
           />
         </div>
         
         {/* Y-Axis Configuration */}
         <div>
           <label className="block text-sm font-medium mb-1">Y-Axis Field</label>
           <select
             value={currentChart.yAxis.field}
             onChange={(e) => updateCurrentChart({
               yAxis: { ...currentChart.yAxis, field: e.target.value, dataKey: e.target.value }
             })}
             className="w-full p-2 bg-background border border-white/10 rounded text-white"
           >
             {availableFields.map(field => (
               <option key={field} value={field}>{field}</option>
             ))}
           </select>
         </div>
         
         <div>
           <label className="block text-sm font-medium mb-1">Y-Axis Label</label>
           <input
             type="text"
             value={currentChart.yAxis.label}
             onChange={(e) => updateCurrentChart({
               yAxis: { ...currentChart.yAxis, label: e.target.value }
             })}
             className="w-full p-2 bg-background border border-white/10 rounded text-white"
           />
         </div>
         
         {/* Color By Field (for scatter plots) */}
         {currentChart.type === 'scatter' && (
           <div>
             <label className="block text-sm font-medium mb-1">Color By Field</label>
             <select
               value={currentChart.colorBy || ''}
               onChange={(e) => updateCurrentChart({
                 colorBy: e.target.value || undefined
               })}
               className="w-full p-2 bg-background border border-white/10 rounded text-white"
             >
               <option value="">No Color Grouping</option>
               {availableFields.map(field => (
                 <option key={field} value={field}>{field}</option>
               ))}
             </select>
           </div>
         )}
       </div>
     )}
     
     {/* Style & Colors tab */}
     {activeTab === 'style' && (
       <div className="space-y-4">
         <div>
           <label className="block text-sm font-medium mb-1">Color Palette</label>
           <div className="grid grid-cols-2 gap-2">
             {Object.entries(colorPalettes).map(([name, colors]) => (
               <button
                 key={name}
                 className={`p-2 border rounded flex items-center ${
                   currentChart.palette === name
                     ? 'border-primary bg-primary/10'
                     : 'border-white/10 hover:border-white/30'
                 }`}
                 onClick={() => updateCurrentChart({ palette: name })}
               >
                 <div className="flex mr-2">
                   {colors.slice(0, 3).map((color, i) => (
                     <div
                       key={i}
                       className="w-3 h-8 first:rounded-l last:rounded-r"
                       style={{ backgroundColor: color, marginLeft: i > 0 ? -4 : 0 }}
                     />
                   ))}
                 </div>
                 <span className="text-xs capitalize">{name}</span>
               </button>
             ))}
           </div>
         </div>
         
         <div className="flex items-center">
           <input
             type="checkbox"
             id="show-legend"
             checked={currentChart.showLegend}
             onChange={(e) => updateCurrentChart({ showLegend: e.target.checked })}
             className="mr-2"
           />
           <label htmlFor="show-legend" className="text-sm">Show Legend</label>
         </div>
         
         <div className="flex items-center">
           <input
             type="checkbox"
             id="show-grid"
             checked={currentChart.showGrid}
             onChange={(e) => updateCurrentChart({ showGrid: e.target.checked })}
             className="mr-2"
           />
           <label htmlFor="show-grid" className="text-sm">Show Grid</label>
         </div>
         
         {['bar', 'area', 'line'].includes(currentChart.type) && (
           <div className="flex items-center">
             <input
               type="checkbox"
               id="stacked-data"
               checked={currentChart.stackedData}
               onChange={(e) => updateCurrentChart({ stackedData: e.target.checked })}
               className="mr-2"
             />
             <label htmlFor="stacked-data" className="text-sm">Stacked Data</label>
           </div>
         )}
       </div>
     )}
     
     {/* Transforms tab */}
     {activeTab === 'transforms' && (
       <DataTransforms />
     )}
     
     {/* Action buttons */}
     <div className="mt-6 flex space-x-2">
       <Button
         variant="ghost"
         onClick={() => {
           // Reset to initial state based on current data
           if (currentChart && currentChart.data) {
             const xAxisField = currentChart.xAxis.field;
             const yAxisField = currentChart.yAxis.field;
             
             updateCurrentChart({
               title: `${currentChart.type.charAt(0).toUpperCase() + currentChart.type.slice(1)} Chart`,
               xAxis: {
                 field: xAxisField,
                 label: formatFieldLabel(xAxisField),
                 dataKey: xAxisField
               },
               yAxis: {
                 field: yAxisField,
                 label: formatFieldLabel(yAxisField),
                 dataKey: yAxisField
               },
               showLegend: true,
               showGrid: true,
               palette: 'primary',
               colorBy: undefined,
               description: '',
               transforms: []
             });
           }
         }}
       >
         <RefreshCw size={16} className="mr-1" />
         Reset
       </Button>
     </div>
   </div>
 );
};

/**
* Helper to format a field name as a readable label
*/
function formatFieldLabel(field: string): string {
 return field
   .replace(/_/g, ' ')
   .replace(/([A-Z])/g, ' $1')
   .replace(/^\w/, c => c.toUpperCase());
}

export default ChartConfigPanel;