
import React from 'react';
import { PublishedApp, DevMode } from '../types';
import SqlAppViewer from './SqlAppViewer';
import PythonAppViewer from './PythonAppViewer';

interface Props {
  app: PublishedApp;
  onClose: () => void;
  onLoadToWorkspace: (app: PublishedApp) => void;
}

const AppViewer: React.FC<Props> = ({ app, onClose, onLoadToWorkspace }) => {
  if (app.type === DevMode.SQL) {
    return <SqlAppViewer app={app} onClose={onClose} onLoadToWorkspace={onLoadToWorkspace} />;
  }
  return <PythonAppViewer app={app} onClose={onClose} onLoadToWorkspace={onLoadToWorkspace} />;
};

export default AppViewer;
