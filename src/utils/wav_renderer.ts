// src/utils/wav_renderer.ts

export class WavRenderer {
  static drawBars(
    canvas: HTMLCanvasElement,
    ctx: CanvasRenderingContext2D,
    values: Float32Array,
    color: string,
    barWidth: number,
    barSpacing: number,
    minHeight: number,
    scaleFactor = 1 // Updated parameter without explicit type annotation
  ) {
    const width = canvas.width;
    const height = canvas.height;
    const barCount = Math.floor(width / (barWidth + barSpacing));
    const multiplier = Math.floor(values.length / barCount) || 1; // Avoid division by zero

    ctx.fillStyle = color;

    for (let i = 0; i < barCount; i++) {
      const sliceStart = i * multiplier;
      const sliceEnd = sliceStart + multiplier;
      const chunk = values.slice(sliceStart, sliceEnd);
      const sum = chunk.reduce((a, b) => a + b, 0);
      const average = sum / chunk.length;
      const scaledAverage = average * scaleFactor;
      const barHeight = Math.max(scaledAverage * height, minHeight);

      ctx.fillRect(
        i * (barWidth + barSpacing),
        height - barHeight,
        barWidth,
        barHeight
      );
    }
  }
}
