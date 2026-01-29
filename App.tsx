
import React from 'react';
import { DevMode } from './types';
import { INITIAL_SQL, INITIAL_PYTHON } from './constants';
import { getDatabaseEngine } from './services/dbService';
import DataSidebar from './components/DataSidebar';
import SqlWorkspace from './components/SqlWorkspace';
import PythonWorkspace from './components/PythonWorkspace';
import SqlPublishPanel from './components/SqlPublishPanel';
import PythonPublishPanel from './components/PythonPublishPanel';
import AppMarket from './components/AppMarket';
import InsightHub from './components/InsightHub';
import PublishDialog from './components/PublishDialog';
import AppViewer from './components/AppViewer';
import Lobby from './components/Lobby';
import AppHeader from './components/AppHeader';
import DatasetPickerModal from './components/DatasetPickerModal'; 
import ConnectDatabaseModal from './components/ConnectDatabaseModal';
import SettingsModal from './components/SettingsModal';
import LinkedAppsModal from './components/LinkedAppsModal';
import { FileQuestion, LayoutGrid } from 'lucide-react';
import { useAppController } from './hooks/useAppController';

const App: React.FC = () => {
  const controller = useAppController();

  if (controller.appNotFound) {
    return (
      <div className="fixed inset-0 z-[200] bg-white flex flex-col items-center justify-center p-8 animate-in fade-in duration-300">
        <div className="w-24 h-24 bg-gray-50 rounded-[2rem] flex items-center justify-center mb-6 shadow-sm border border-gray-100">
          <FileQuestion size={40} className="text-gray-300" /> 
        </div>
        <h2 className="text-2xl font-black text-gray-900 mb-2 tracking-tight">App Not Found</h2>
        <p className="text-sm text-gray-500 font-medium mb-8 text-center max-w-xs leading-relaxed">
          The app you are looking for might have been deleted or the link is invalid.
        </p>
        <button 
          onClick={controller.handleOpenMarket}
          className="px-8 py-3.5 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-200 hover:bg-blue-700 transition-all active:scale-95 flex items-center gap-2 text-xs uppercase tracking-widest"
        >
          <LayoutGrid size={16} />
          Browse Marketplace
        </button>
      </div>
    );
  }

  if (controller.viewingApp) {
      return (
          <AppViewer 
             app={controller.viewingApp}
             onClose={controller.handleCloseAppViewer}
             onHome={controller.handleExit}
             onEdit={controller.handleEditApp}
             onFork={controller.handleForkApp}
             onClone={controller.handleCloneNotebook} 
          />
      );
  }

  if (controller.isMarketOpen) {
      return (
         <AppMarket 
            onClose={controller.handleCloseMarket}
            onHome={controller.handleExit}
            onOpenApp={controller.handleOpenAppById}
            onEditApp={controller.handleEditApp}
            onCloneApp={controller.handleForkApp} 
         />
      );
  }

  if (!controller.dbReady && !controller.currentNotebook) {
      return <Lobby onOpen={(nb) => controller.handleOpenNotebook(nb)} onOpenMarket={controller.handleOpenMarket} />;
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {controller.layoutConfig.showHeader && (
        <AppHeader
          topicName={controller.project.topicName}
          isEditing={controller.isEditingTopic}
          tempTopic={controller.tempTopic}
          onTempTopicChange={controller.setTempTopic}
          onEditStart={() => { controller.setTempTopic(controller.project.topicName); controller.setIsEditingTopic(true); }}
          onEditSubmit={() => { controller.handleUpdateTopic(controller.tempTopic); controller.setIsEditingTopic(false); }}
          onEditCancel={() => controller.setIsEditingTopic(false)}
          onExit={controller.handleExit}
          isNotebookSession={!!controller.currentNotebook}
          activeMode={controller.project.activeMode}
          onModeChange={(mode) => {
              controller.setProject(p => ({ ...p, activeMode: mode }));
              if (mode === DevMode.INSIGHT_HUB) controller.setHasNewSuggestions(false); 
          }}
          hasNewSuggestions={controller.hasNewSuggestions}
          sidebarWidth={controller.sidebarWidth}
          onOpenSettings={() => controller.setIsSettingsOpen(true)}
          onOpenApps={() => controller.setIsAppsListOpen(true)}
        />
      )}

      <div className="flex-1 flex overflow-hidden relative">
        {controller.layoutConfig.showSidebar && (
          <>
            <DataSidebar
              tables={controller.project.tables}
              onUploadFile={controller.handleUpload}
              onRefreshTableStats={async t => {
                try {
                  const dbType = (typeof process !== 'undefined' ? process.env.DB_TYPE : 'mysql') || 'mysql';
                  const q = dbType === 'postgres' ? '"' : '`';
                  
                  if (controller.project.dbName) {
                    const engine = getDatabaseEngine();
                    const count = await engine.refreshTableStats(t, controller.project.dbName);
                    const previewRes = await engine.executeQuery(`SELECT * FROM ${q}${t}${q} LIMIT 10`, controller.project.dbName);
                    const latestTables = await engine.getTables(controller.project.dbName);
                    const freshMetadata = latestTables.find(tbl => tbl.tableName === t);

                    controller.setProject(prev => ({
                        ...prev,
                        previewResult: previewRes, 
                        tables: prev.tables.map(table =>
                        table.tableName === t ? { 
                            ...table, 
                            rowCount: count,
                            columns: freshMetadata ? freshMetadata.columns : table.columns
                        } : table
                        )
                    }));
                  }
                } catch (e: any) {
                   const msg = e.message || "";
                   if (msg.includes("doesn't exist") || msg.includes("no such table") || msg.includes("does not exist")) {
                      controller.setProject(prev => ({
                        ...prev,
                        tables: prev.tables.filter(table => table.tableName !== t)
                      }));
                   } else {
                     console.error("Refresh failed", e);
                   }
                }
              }}
              isUploading={controller.isUploading}
              uploadProgress={controller.uploadProgress}
              onLoadSample={controller.handleOpenDatasetPicker}
              onConnectDB={() => controller.setIsConnectDbOpen(true)}
              width={controller.sidebarWidth}
              onColumnAction={controller.handleColumnAction}
            />
            {/* Left Resizer Handle */}
            <div
              className="w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-600 transition-colors z-50 bg-transparent -ml-0.5 flex-shrink-0"
              onMouseDown={() => controller.setIsResizing('sidebar')}
            />
          </>
        )}

        <main className="flex-1 flex flex-col bg-white overflow-hidden min-w-0">
          <div className="flex-1 flex flex-col overflow-hidden">
             {controller.project.activeMode === DevMode.INSIGHT_HUB && (
              <InsightHub
                suggestions={controller.project.suggestions}
                onApply={(s) => {
                  controller.setProject(p => ({ ...p, activeMode: s.type, [s.type === DevMode.SQL ? 'sqlAiPrompt' : 'pythonAiPrompt']: s.prompt }));
                  if (s.type === DevMode.SQL) controller.handleSqlAiGenerate(s.prompt, true);
                  else controller.handlePythonAiGenerate(s.prompt, true);
                }}
                onUpdate={controller.handleUpdateSuggestion}
                onDelete={controller.handleDeleteSuggestion}
                onFetchMore={controller.handleFetchSuggestions}
                isLoading={controller.isSuggesting}
              />
             )}
             {controller.project.activeMode === DevMode.SQL && (
              <SqlWorkspace
                code={controller.project.sqlCode}
                onCodeChange={v => controller.setProject(p => ({ ...p, sqlCode: v }))}
                prompt={controller.project.sqlAiPrompt}
                onPromptChange={v => controller.setProject(p => ({ ...p, sqlAiPrompt: v }))}
                result={controller.project.lastSqlResult}
                previewResult={controller.project.previewResult}
                onRun={() => controller.handleRun()}
                isExecuting={controller.project.isExecuting}
                isAiGenerating={controller.project.isSqlAiGenerating}
                isAiFixing={controller.project.isSqlAiFixing}
                onTriggerAi={() => controller.handleSqlAiGenerate()}
                onDebug={controller.handleDebugSql}
                tables={controller.project.tables}
                onUndo={() => controller.setProject(p => ({ ...p, sqlCode: p.lastSqlCodeBeforeAi || INITIAL_SQL }))}
                showUndo={!!controller.project.lastSqlCodeBeforeAi}
                aiThought={controller.project.sqlAiThought}
              />
             )}
             {controller.project.activeMode === DevMode.PYTHON && (
              <PythonWorkspace
                code={controller.project.pythonCode}
                onCodeChange={v => controller.setProject(p => ({ ...p, pythonCode: v }))}
                prompt={controller.project.pythonAiPrompt}
                onPromptChange={v => controller.setProject(p => ({ ...p, pythonAiPrompt: v }))}
                result={controller.project.lastPythonResult}
                previewResult={controller.project.previewResult}
                onRun={() => controller.handleRun()}
                isExecuting={controller.project.isExecuting}
                isAiGenerating={controller.project.isPythonAiGenerating}
                isAiFixing={controller.project.isPythonAiFixing}
                onTriggerAi={() => controller.handlePythonAiGenerate()}
                onDebug={controller.handleDebugPython}
                tables={controller.project.tables}
                onUndo={() => controller.setProject(p => ({ ...p, pythonCode: p.lastPythonCodeBeforeAi || INITIAL_PYTHON }))}
                showUndo={!!controller.project.lastPythonCodeBeforeAi}
                aiThought={controller.project.pythonAiThought}
              />
             )}
          </div>
        </main>

        {(controller.project.activeMode === DevMode.SQL || controller.project.activeMode === DevMode.PYTHON) && controller.layoutConfig.showSidebar && (
             <div
                className="w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-600 transition-colors z-50 bg-transparent -mr-0.5 flex-shrink-0"
                onMouseDown={() => controller.setIsResizing('right')}
             />
        )}

        {controller.project.activeMode === DevMode.SQL && controller.layoutConfig.showSidebar && (
            <SqlPublishPanel 
                result={controller.project.lastSqlResult} 
                analysis={controller.project.analysisReport} 
                isAnalyzing={controller.project.isAnalyzing} 
                isRecommendingCharts={controller.project.isRecommendingCharts} 
                onDeploy={() => controller.setIsPublishOpen(true)} 
                isDeploying={false} 
                width={controller.rightPanelWidth}
            />
        )}
        {controller.project.activeMode === DevMode.PYTHON && controller.layoutConfig.showSidebar && (
            <PythonPublishPanel 
                result={controller.project.lastPythonResult} 
                onDeploy={async () => controller.setIsPublishOpen(true)} 
                isDeploying={false} 
                width={controller.rightPanelWidth}
            />
        )}
      </div>
      
      <PublishDialog 
         isOpen={controller.isPublishOpen} 
         onClose={() => controller.setIsPublishOpen(false)}
         onOpenApp={controller.handleOpenAppById}
         editingAppId={controller.editingAppId}
         type={controller.project.activeMode === DevMode.SQL ? DevMode.SQL : DevMode.PYTHON}
         code={controller.project.activeMode === DevMode.SQL ? controller.project.sqlCode : controller.project.pythonCode}
         dbName={controller.project.dbName}
         sourceNotebookId={controller.project.id}
         resultSnapshot={controller.project.activeMode === DevMode.SQL ? controller.project.lastSqlResult : controller.project.lastPythonResult}
         defaultTitle={controller.project.derivedAppTitle || controller.project.topicName}
         defaultDescription={controller.project.activeMode === DevMode.SQL ? controller.project.sqlAiPrompt : controller.project.pythonAiPrompt}
         sourcePrompt={controller.project.activeMode === DevMode.SQL ? controller.project.sqlAiPrompt : controller.project.pythonAiPrompt}
         analysisReport={controller.project.analysisReport}
      />

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={controller.isSettingsOpen}
        onClose={() => controller.setIsSettingsOpen(false)}
        settings={controller.userSettings}
        onUpdate={controller.updateUserSettings}
      />

      {/* Linked Apps Modal */}
      {controller.currentNotebook && (
        <LinkedAppsModal 
          isOpen={controller.isAppsListOpen}
          onClose={() => controller.setIsAppsListOpen(false)}
          notebookId={controller.currentNotebook.id}
          onEdit={controller.handleEditApp}
          onView={controller.handleOpenAppById}
        />
      )}

      {/* Dataset Picker Modal */}
      <DatasetPickerModal 
        isOpen={controller.showDatasetPicker}
        onClose={() => controller.setShowDatasetPicker(false)}
        onSelect={controller.handleDatasetSelect}
        isLoading={controller.isLoadingDatasets}
        datasets={controller.availableDatasets}
      />

      {/* Connect Database Modal */}
      <ConnectDatabaseModal 
        isOpen={controller.isConnectDbOpen}
        onClose={() => controller.setIsConnectDbOpen(false)}
        onConnect={controller.handleConnectDatabase}
        isLoading={controller.isConnectingDb}
        connectionStatus={controller.connectStatus} // Pass granular progress text
      />
    </div>
  );
};

export default App;
