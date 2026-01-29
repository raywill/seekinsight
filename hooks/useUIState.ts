
import { useState } from 'react';
import { PublishedApp } from '../types';

export const useUIState = () => {
  const [isMarketOpen, setIsMarketOpen] = useState(false);
  const [viewingApp, setViewingApp] = useState<PublishedApp | null>(null);
  const [appNotFound, setAppNotFound] = useState(false);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);
  const [isEditingTopic, setIsEditingTopic] = useState(false);
  const [tempTopic, setTempTopic] = useState("");
  
  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAppsListOpen, setIsAppsListOpen] = useState(false);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [showDatasetPicker, setShowDatasetPicker] = useState(false);
  const [isConnectDbOpen, setIsConnectDbOpen] = useState(false);

  // Layout & Resizing
  const [layoutConfig, setLayoutConfig] = useState({
    showSidebar: true,
    showHeader: true
  });
  const [sidebarWidth, setSidebarWidth] = useState(288);
  const [rightPanelWidth, setRightPanelWidth] = useState(384);
  const [isResizing, setIsResizing] = useState<'sidebar' | 'right' | null>(null);

  // Loading States that are UI-specific
  const [isLoadingDatasets, setIsLoadingDatasets] = useState(false);
  const [isConnectingDb, setIsConnectingDb] = useState(false);
  const [connectStatus, setConnectStatus] = useState("");
  
  // AI Suggestion Loading State
  const [isSuggesting, setIsSuggesting] = useState(false);

  return {
    isMarketOpen, setIsMarketOpen,
    viewingApp, setViewingApp,
    appNotFound, setAppNotFound,
    editingAppId, setEditingAppId,
    isEditingTopic, setIsEditingTopic,
    tempTopic, setTempTopic,
    isSettingsOpen, setIsSettingsOpen,
    isAppsListOpen, setIsAppsListOpen,
    isPublishOpen, setIsPublishOpen,
    showDatasetPicker, setShowDatasetPicker,
    isConnectDbOpen, setIsConnectDbOpen,
    layoutConfig, setLayoutConfig,
    sidebarWidth, setSidebarWidth,
    rightPanelWidth, setRightPanelWidth,
    isResizing, setIsResizing,
    isLoadingDatasets, setIsLoadingDatasets,
    isConnectingDb, setIsConnectingDb,
    connectStatus, setConnectStatus,
    isSuggesting, setIsSuggesting
  };
};
