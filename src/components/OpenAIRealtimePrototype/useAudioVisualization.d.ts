import { RefObject } from 'react';
import { WavRecorder, WavStreamPlayer } from '../../lib/wavtools/index';

export interface UseAudioVisualizationResult {
  clientCanvasRef: RefObject<HTMLCanvasElement>;
  serverCanvasRef: RefObject<HTMLCanvasElement>;
  wavRecorderRef: RefObject<WavRecorder>;
  wavStreamPlayerRef: RefObject<WavStreamPlayer>;
}

declare function useAudioVisualization(isConnected: boolean): UseAudioVisualizationResult;

export default useAudioVisualization;