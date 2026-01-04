declare module 'react-plotly.js' {
  import * as React from 'react';
  import { Component } from 'react';

  export interface PlotProps {
    data: any[];
    layout?: any;
    config?: any;
    frames?: any[];
    onInitialized?: (figure: any, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: any, graphDiv: HTMLElement) => void;
    onPurge?: (figure: any, graphDiv: HTMLElement) => void;
    onError?: (err: any) => void;
    style?: React.CSSProperties;
    useResizeHandler?: boolean;
    className?: string;
    divId?: string;
  }

  export default class Plot extends Component<PlotProps> {}
}

declare module 'plotly.js-dist-min' {
  const Plotly: any;
  export default Plotly;
}