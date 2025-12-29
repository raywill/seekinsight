
import React from 'react';
import { PublishedApp, DevMode } from '../types';
import SqlAppViewer from './SqlAppViewer';
import PythonAppViewer from './PythonAppViewer';

interface Props {
  app: PublishedApp;
  onClose: () => void;
  onHome?: () => void;
  onEdit?: (app: PublishedApp) => void;
  onClone?: (app: PublishedApp) => void;
  onFork?: (app: PublishedApp) => void;
}

const AppViewer: React.FC<Props> = ({ app, onClose, onHome, onEdit, onClone, onFork }) => {
  if (app.type === DevMode.SQL) {
    return <SqlAppViewer app={app} onClose={onClose} onHome={onHome} onEdit={onEdit} onClone={onClone} onFork={onFork} />;
  }
  return <PythonAppViewer app={app} onClose={onClose} onHome={onHome} onEdit={onEdit} onClone={onClone} onFork={onFork} />;
};

export default AppViewer;
