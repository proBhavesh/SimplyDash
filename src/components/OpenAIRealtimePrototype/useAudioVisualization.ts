import { useRef, useEffect, useCallback, useState } from 'react';
import { WavRecorder, WavStreamPlayer } from '../../lib/wavtools/index';

const useAudioVisualization = (
  isConnected: boolean,
  wavStreamPlayerRef: React.RefObject<WavStreamPlayer>,
  wavRecorderRefParam?: React.RefObject<WavRecorder>
) => {
  const clientCanvasRef = useRef<HTMLCanvasElement>(null);
  const serverCanvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  // Always create an internal wavRecorderRef
  const internalWavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 })
  );

  // Use the provided wavRecorderRef if available, else use the internal one
  const wavRecorderRef = wavRecorderRefParam ?? internalWavRecorderRef;

  const initializeWavRecorder = useCallback(async () => {
    if (wavRecorderRef.current) {
      try {
        await wavRecorderRef.current.begin();
        await wavRecorderRef.current.record();
        console.log('[AudioVisualization] WavRecorder initialized and recording');
      } catch (err) {
        console.error('[AudioVisualization] Failed to initialize WavRecorder:', err);
        setError('Failed to initialize WavRecorder');
      }
    } else {
      setError('WavRecorder is not initialized');
    }
  }, [wavRecorderRef]);

  // Handle WavRecorder based on isConnected state
  useEffect(() => {
    if (isConnected && wavRecorderRef === internalWavRecorderRef) {
      initializeWavRecorder();
    }

    return () => {
      if (wavRecorderRef === internalWavRecorderRef && wavRecorderRef.current) {
        const recorderStatus = wavRecorderRef.current.getStatus();
        if (recorderStatus === 'recording' || recorderStatus === 'paused') {
          wavRecorderRef.current.end().catch((err) => {
            console.error('[AudioVisualization] Error ending WavRecorder:', err);
          });
          console.log('[AudioVisualization] WavRecorder stopped');
        }
      }
    };
  }, [isConnected, initializeWavRecorder, wavRecorderRef]);

  // Handle WavStreamPlayer connection
  useEffect(() => {
    if (isConnected && wavStreamPlayerRef.current) {
      // Only connect if not already connected
      const status = wavStreamPlayerRef.current.getStatus();
      if (!status.isConnected) {
        wavStreamPlayerRef.current
          .connect()
          .then(() => {
            console.log('[AudioVisualization] WavStreamPlayer connected');
            setError(null);
          })
          .catch((err) => {
            console.error(
              '[AudioVisualization] Failed to connect WavStreamPlayer:',
              err
            );
            setError('Failed to initialize WavStreamPlayer');
          });
      }
    }
    // No disconnect on isConnected change
  }, [isConnected, wavStreamPlayerRef]);

  // Handle cleanup on full unmount
  useEffect(() => {
    return () => {
      if (wavStreamPlayerRef.current) {
        const status = wavStreamPlayerRef.current.getStatus();
        if (status.isConnected) {
          wavStreamPlayerRef.current
            .disconnect()
            .then(() => {
              console.log('[AudioVisualization] WavStreamPlayer disconnected on unmount');
            })
            .catch((err) => {
              console.error(
                '[AudioVisualization] Error disconnecting WavStreamPlayer on unmount:',
                err
              );
            });
        }
      }
    };
  }, [wavStreamPlayerRef]);

  const renderVisualization = useCallback(() => {
    if (!isConnected) {
      return;
    }

    const wavRecorder = wavRecorderRef.current;
    const clientCanvas = clientCanvasRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    const serverCanvas = serverCanvasRef.current;

    const renderBars = (
      canvas: HTMLCanvasElement,
      ctx: CanvasRenderingContext2D,
      values: Float32Array,
      color: string
    ) => {
      const width = canvas.width;
      const height = canvas.height;
      const barCount = 64;
      const barWidth = Math.floor(width / barCount) - 1;
      const barSpacing = 1;
      const scaleFactor = 2;
      const maxBarHeight = height * 0.8;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = color;

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * values.length);
        let barHeight = values[dataIndex] * height * scaleFactor;
        barHeight = Math.min(barHeight, maxBarHeight);
        const x = i * (barWidth + barSpacing);
        const y = height - barHeight;
        ctx.fillRect(x, y, barWidth, barHeight);
      }
    };

    // Input Visualization
    if (clientCanvas && wavRecorder) {
      const clientCtx = clientCanvas.getContext('2d');
      if (clientCtx) {
        const recorderStatus = wavRecorder.getStatus();
        if (recorderStatus === 'recording') {
          try {
            const result = wavRecorder.getFrequencies('voice');
            const hasNonZeroValues = result.values.some((v) => v > 0);
            if (hasNonZeroValues) {
              renderBars(clientCanvas, clientCtx, result.values, '#0099ff');
            } else {
              clientCtx.clearRect(0, 0, clientCanvas.width, clientCanvas.height);
            }
          } catch (err) {
            console.error(
              '[AudioVisualization] Error getting input frequencies:',
              err
            );
          }
        }
      }
    }

    // Output Visualization
    if (serverCanvas && wavStreamPlayer) {
      const serverCtx = serverCanvas.getContext('2d');
      if (serverCtx) {
        try {
          const result = wavStreamPlayer.getFrequencies('voice');
          const hasNonZeroValues = result.values.some((v) => v > 0);
          if (hasNonZeroValues) {
            renderBars(serverCanvas, serverCtx, result.values, '#009900');
          } else {
            serverCtx.clearRect(0, 0, serverCanvas.width, serverCanvas.height);
          }
        } catch (err) {
          console.error(
            '[AudioVisualization] Error getting output frequencies:',
            err
          );
        }
      }
    }
  }, [isConnected, wavRecorderRef, wavStreamPlayerRef]);

  useEffect(() => {
    const animationFrameIdRef = { current: 0 };

    const animate = () => {
      renderVisualization();
      animationFrameIdRef.current = window.requestAnimationFrame(animate);
    };

    if (isConnected) {
      console.log('[AudioVisualization] Starting animation loop');
      animate();
    }

    return () => {
      if (animationFrameIdRef.current) {
        window.cancelAnimationFrame(animationFrameIdRef.current);
        console.log('[AudioVisualization] Animation loop stopped');
      }
    };
  }, [isConnected, renderVisualization]);

  const resetAudioVisualization = useCallback(async () => {
    console.log('[AudioVisualization] Resetting audio visualization');
    try {
      // Only reset the recorder if we manage it internally
      if (wavRecorderRef === internalWavRecorderRef && wavRecorderRef.current) {
        const recorderStatus = wavRecorderRef.current.getStatus();
        if (recorderStatus === 'recording' || recorderStatus === 'paused') {
          await wavRecorderRef.current.end();
        }
        await wavRecorderRef.current.begin();
        await wavRecorderRef.current.record();
      }
      setError(null);
    } catch (err) {
      console.error(
        '[AudioVisualization] Error resetting audio visualization:',
        err
      );
      setError('Failed to reset audio visualization');
    }
  }, [wavRecorderRef, internalWavRecorderRef]);

  return {
    clientCanvasRef,
    serverCanvasRef,
    error,
    resetAudioVisualization,
  };
};

export default useAudioVisualization;
