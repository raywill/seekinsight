
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
}

const AppViewer: React.FC<Props> = ({ app, onClose, onHome, onEdit, onClone }) => {
  if (app.type === DevMode.SQL) {
    return <SqlAppViewer app={app} onClose={onClose} onHome={onHome} onEdit={onEdit} onClone={onClone} />;
  }
  return <PythonAppViewer app={app} onClose={onClose} onHome={onHome} onEdit={onEdit} onClone={onClone} />;
};

export default AppViewer;
