// import * as Comlink from 'comlink';
// import Papa from 'papaparse';

// // We'll replace this with the actual WebAssembly module import
// let wasmModule: unknown = null;

// // The function to initialize WebAssembly module
// async function initWasm() {
//   if (wasmModule) return wasmModule;
  
//   try {
//     const module = await import('../../wasm/data-processing');
//     wasmModule = module;
//     return module;
//   } catch (error) {
//     console.error('Failed to load WebAssembly module:', error);
//     return null;
//   }
// }

// const CSVWorker = {
//   async parseCSV(file: File, useWasm: boolean = true): Promise<string[][]> {
//     try {
//       // Try to use WebAssembly if requested
//       if (useWasm) {
//         const wasm = await initWasm();
//         if (wasm) {
//           const text = await file.text();
//           return wasm.parse_csv(text, ',');
//         }
//       }
      
//       // Fall back to PapaParse if WebAssembly is not available or fails
//       return new Promise((resolve, reject) => {
//         Papa.parse(file, {
//           complete: (results) => {
//             if (results.errors && results.errors.length > 0) {
//               console.warn('PapaParse encountered errors:', results.errors);
//             }
//             resolve(results.data as string[][]);
//           },
//           error: (error) => {
//             reject(error);
//           },
//           delimiter: ',',
//           skipEmptyLines: true
//         });
//       });
//     } catch (error) {
//       console.error('Error parsing CSV:', error);
//       throw error;
//     }
//   },
  
//   async detectColumnTypes(data: string[][]): Promise<string[]> {
//     try {
//       const wasm = await initWasm();
//       if (wasm) {
//         return wasm.get_column_types(data);
//       }
      
//       // Fallback to JS implementation if WebAssembly is not available
//       return this.detectColumnTypesJS(data);
//     } catch (error) {
//       console.error('Error detecting column types:', error);
//       return Array(data[0]?.length || 0).fill('text');
//     }
//   },
  
//   detectColumnTypesJS(data: string[][]): string[] {
//     if (!data || data.length < 2) return [];
    
//     const headerRow = data[0];
//     const types = Array(headerRow.length).fill('unknown');
    
//     // Skip header row
//     for (let i = 1; i < data.length; i++) {
//       const row = data[i];
//       for (let j = 0; j < row.length; j++) {
//         if (j >= types.length) break;
        
//         const value = row[j];
//         if (!value) continue;
        
//         // Try to parse as number
//         if (!isNaN(Number(value)) && value.trim() !== '') {
//           if (types[j] === 'unknown') types[j] = 'number';
//           continue;
//         }
        
//         // Try to parse as boolean
//         if (/^(true|false|yes|no)$/i.test(value)) {
//           if (types[j] === 'unknown') types[j] = 'boolean';
//           continue;
//         }
        
//         // Try to parse as date
//         if (/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(value)) {
//           if (types[j] === 'unknown') types[j] = 'date';
//           continue;
//         }
        
//         // Default to text
//         types[j] = 'text';
//       }
//     }
    
//     return types;
//   }
// };

// Comlink.expose(CSVWorker);