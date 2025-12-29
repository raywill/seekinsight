
import { useState } from 'react';
import * as XLSX from 'xlsx';
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
          // As requested: Split by newline, trim whitespace, and ignore empty lines.
          const lines = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
          
          finalHeaders = ["line_id", "content"];
          finalObjects = lines.map((text, index) => ({ "line_id": index + 1, "content": text }));
        } else {
          const rawFileData = e.target?.result as string;
          const workbook = XLSX.read(rawFileData, { type: 'binary', cellDates: true, dateNF: 'yyyy-mm-dd' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rawArrayData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          if (rawArrayData.length === 0) throw new Error("File is empty");
          const sampleRows = rawArrayData.slice(0, 5);
          let suspiciousNoHeader = true;
          if (rawArrayData.length > 1) {
            for (let col = 0; col < rawArrayData[0].length; col++) {
              const type0 = typeof rawArrayData[0][col];
              const type1 = typeof rawArrayData[1][col];
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
          aiComments = await ai.inferColumnMetadata(tableName, finalObjects);
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
        alert("Upload Error: " + err.message);
      } finally { 
        setIsUploading(false); 
        setUploadProgress(null);
      }
    };

    if (isTxt) reader.readAsArrayBuffer(file);
    else reader.readAsBinaryString(file);
  };

  return {
    isUploading,
    uploadProgress,
    handleUpload
  };
};
