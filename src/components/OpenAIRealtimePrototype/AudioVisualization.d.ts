import { FC, RefObject } from 'react';

export interface AudioVisualizationProps {
  isConnected: boolean;
  clientCanvasRef: RefObject<HTMLCanvasElement>;
  serverCanvasRef: RefObject<HTMLCanvasElement>;
}

declare const AudioVisualization: FC<AudioVisualizationProps>;

export default AudioVisualization;