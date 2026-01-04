
import { useState } from 'react';
import * as ExcelJS from 'exceljs';
import * as ai from '../services/aiProvider';
import { getDatabaseEngine } from '../services/dbService';
import { TableMetadata } from '../types';

export const useFileUpload = (
  dbName: string | null,
  dbReady: boolean,
  topicName: string,
  tables: TableMetadata[],
  onTablesUpdate: (newTables: TableMetadata[]) => void,
  onTopicUpdate: (newTopic: string) => void
) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const handleUpload = async (file: File) => {
    if (!dbReady || !dbName || isUploading) return;
    setIsUploading(true);
    setUploadProgress(null);

    const isTxt = file.name.toLowerCase().endsWith('.txt');
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        let finalHeaders: string[] = [];
        let finalObjects: any[] = [];
        const tableName = file.name
          .split('.')[0]
          .trim()
          .replace(/[^\p{L}\p{N}_]/gu, '_');

        if (isTxt) {
          const buffer = e.target?.result as ArrayBuffer;
          let textContent = "";
          try {
            const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
            textContent = utf8Decoder.decode(buffer);
          } catch (e) {
            console.warn("UTF-8 decoding failed, falling back to GB18030/GBK");
            const gbkDecoder = new TextDecoder('gb18030');
            textContent = gbkDecoder.decode(buffer);
          }
          
          // 1. Unify newlines and spaces
          let text = textContent
            .replace(/\r\n|\r/g, '\n')
            .replace(/\u2028|\u2029/g, '\n')
            .replace(/\u00A0|\u3000/g, ' ')
            .trim();

          // 2. Strict Line-by-Line Splitting (List Mode)
          const lines = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
          
          finalHeaders = ["line_id", "content"];
          finalObjects = lines.map((text, index) => ({ "line_id": index + 1, "content": text }));
        } else {
          // Use ExcelJS for handling images
          const buffer = e.target?.result as ArrayBuffer;
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(buffer);
          
          const worksheet = workbook.worksheets[0];
          if (!worksheet) throw new Error("File is empty");

          // 1. Map Images to Cell Coordinates
          const imageMap = new Map<string, string>(); // "row-col" -> base64
          
          worksheet.getImages().forEach(image => {
            // ExcelJS range.tl is { nativeCol, nativeRow, ... } - 0-indexed
            const imgId = image.imageId;
            const imgRange = image.range; 
            const media = workbook.model.media.find(m => m.index === parseInt(imgId));
            
            if (media && imgRange) {
              const row = Math.floor(imgRange.tl.nativeRow) + 1; // 1-based for consistent processing
              const col = Math.floor(imgRange.tl.nativeCol) + 1;
              
              // Convert buffer to base64
              let base64 = '';
              if (typeof media.buffer === 'string') {
                 base64 = media.buffer;
              } else {
                 // Convert ArrayBuffer to binary string then btoa
                 const bytes = new Uint8Array(media.buffer);
                 let binary = '';
                 for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                 }
                 base64 = btoa(binary);
              }
              
              // Use standard Data URI format instead of custom marker
              const ext = media.extension || 'png';
              const mimeType = (ext === 'jpg' || ext === 'jpeg') ? 'jpeg' : ext;
              
              imageMap.set(`${row}-${col}`, `data:image/${mimeType};base64,${base64}`);
            }
          });

          // 2. Extract Data
          const rawArrayData: any[][] = [];
          
          // ExcelJS iterates 1-based
          worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
            const rowValues: any[] = [];
            
            // Iterate columns (including empty ones if needed, but we check cell count)
            const cellCount = row.cellCount;
            // We use a max heuristic or actual count. ExcelJS 'values' property is tricky (0-index is usually null)
            // Safer to iterate 1 to cellCount or max column
            const maxCol = worksheet.columnCount > 0 ? worksheet.columnCount : cellCount;

            for(let c = 1; c <= maxCol; c++) {
               const cell = row.getCell(c);
               const imageKey = `${rowNumber}-${c}`;
               
               if (imageMap.has(imageKey)) {
                 rowValues.push(imageMap.get(imageKey));
               } else {
                 // Handle Rich Text or simple value
                 const val = cell.value;
                 if (val && typeof val === 'object' && 'text' in val) {
                    rowValues.push((val as any).text); // Rich Text
                 } else if (val && typeof val === 'object' && 'result' in val) {
                    rowValues.push((val as any).result); // Formula result
                 } else {
                    rowValues.push(val);
                 }
               }
            }
            rawArrayData.push(rowValues);
          });

          if (rawArrayData.length === 0) throw new Error("File is empty");

          // 3. Process Header & Data (Similar to previous logic)
          const sampleRows = rawArrayData.slice(0, 5);
          let suspiciousNoHeader = true;
          
          // Simple type check for header detection
          if (rawArrayData.length > 1) {
            for (let col = 0; col < rawArrayData[0].length; col++) {
              const val0 = rawArrayData[0][col];
              const val1 = rawArrayData[1][col];
              // If image in header row, unlikely to be a header
              if (typeof val0 === 'string' && val0.startsWith('data:image/')) {
                 suspiciousNoHeader = true;
                 break;
              }
              const type0 = typeof val0;
              const type1 = typeof val1;
              if (type0 !== type1 && type0 !== 'undefined' && type1 !== 'undefined') {
                suspiciousNoHeader = false;
                break;
              }
            }
          }

          if (suspiciousNoHeader && rawArrayData.length > 0) {
            const aiResult = await ai.analyzeHeaders(sampleRows);
            if (aiResult.hasHeader) {
              finalHeaders = rawArrayData[0].map(h => String(h || `col_${Math.random().toString(36).substr(2, 4)}`));
              finalObjects = rawArrayData.slice(1).map(row => {
                const obj: any = {};
                finalHeaders.forEach((h, i) => obj[h] = row[i]);
                return obj;
              });
            } else {
              finalHeaders = aiResult.headers;
              finalObjects = rawArrayData.map(row => {
                const obj: any = {};
                finalHeaders.forEach((h, i) => obj[h] = row[i]);
                return obj;
              });
            }
          } else {
            finalHeaders = rawArrayData[0].map(h => String(h || `col_${Math.random().toString(36).substr(2, 4)}`));
            finalObjects = rawArrayData.slice(1).map(row => {
              const obj: any = {};
              finalHeaders.forEach((h, i) => obj[h] = row[i]);
              return obj;
            });
          }
        }

        let aiComments: Record<string, string> = {};
        try {
          // Pass a clean sample (no huge base64 strings) to AI for inference
          const cleanSample = finalObjects.slice(0, 5).map(row => {
             const cleanRow: any = {};
             for(const k in row) {
               const val = row[k];
               if (typeof val === 'string' && val.startsWith('data:image/')) {
                 cleanRow[k] = "[IMAGE_DATA]";
               } else {
                 cleanRow[k] = val;
               }
             }
             return cleanRow;
          });
          aiComments = await ai.inferColumnMetadata(tableName, cleanSample);
        } catch (inferErr) {
          console.warn("AI Metadata Inference failed", inferErr);
        }

        const db = getDatabaseEngine();
        const newTable = await db.createTableFromData(
          tableName, 
          finalObjects, 
          dbName,
          aiComments,
          (percent) => { if (finalObjects.length > 500) setUploadProgress(percent); }
        );

        const updatedTables = [...tables.filter(t => t.tableName !== newTable.tableName), newTable];
        onTablesUpdate(updatedTables);

        try {
          const newTopic = await ai.generateTopic(topicName, updatedTables);
          if (newTopic && newTopic !== topicName) {
            onTopicUpdate(newTopic);
          }
        } catch (aiErr) {
          console.warn("Topic auto-update failed:", aiErr);
        }

      } catch (err: any) {
        console.error(err);
        alert("Upload Error: " + err.message);
      } finally { 
        setIsUploading(false); 
        setUploadProgress(null);
      }
    };

    if (isTxt) reader.readAsArrayBuffer(file);
    else reader.readAsArrayBuffer(file); // ExcelJS also wants buffer
  };

  return {
    isUploading,
    uploadProgress,
    handleUpload
  };
};
