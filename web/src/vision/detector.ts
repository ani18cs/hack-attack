import * as cocoSsd from '@tensorflow-models/coco-ssd';
import * as tf from '@tensorflow/tfjs';
import { RawDetection } from './spatial';

class DetectorController {
  private model: cocoSsd.ObjectDetection | null = null;
  private isModelLoading = false;
  private isDetecting = false;
  private minScore = 0.55;
  private lastRunTime = 0;
  private targetFps = 8;
  private animationFrameId: number | null = null;
  private listeners: Set<(detections: RawDetection[]) => void> = new Set();
  private loadListeners: Set<(loaded: boolean) => void> = new Set();

  /**
   * Initializes TensorFlow.js and loads the COCO-SSD model.
   */
  public async loadModel(): Promise<cocoSsd.ObjectDetection> {
    if (this.model) return this.model;
    if (this.isModelLoading) {
      // Wait for active loader
      return new Promise((resolve) => {
        const interval = setInterval(() => {
          if (this.model) {
            clearInterval(interval);
            resolve(this.model);
          }
        }, 100);
      });
    }

    this.isModelLoading = true;
    try {
      await tf.ready();
      // Use webgl if possible
      if (tf.getBackend() !== 'webgl') {
        await tf.setBackend('webgl').catch(() => {
          console.warn('WebGL backend failed, using default CPU/WASM');
        });
      }

      this.model = await cocoSsd.load({
        base: 'lite_mobilenet_v2',
      });
      this.isModelLoading = false;
      this.loadListeners.forEach((fn) => fn(true));
      return this.model;
    } catch (err) {
      this.isModelLoading = false;
      console.error('Failed to load COCO-SSD model:', err);
      throw err;
    }
  }

  public isLoaded(): boolean {
    return this.model !== null;
  }

  public onModelLoaded(listener: (loaded: boolean) => void): () => void {
    this.loadListeners.add(listener);
    listener(this.isLoaded());
    return () => this.loadListeners.delete(listener);
  }

  public subscribe(listener: (detections: RawDetection[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * One-off detection on a video frame element.
   */
  public async detect(videoElement: HTMLVideoElement): Promise<RawDetection[]> {
    const model = await this.loadModel();
    const predictions = await model.detect(videoElement);
    return predictions.map((p) => ({
      label: p.class,
      score: p.score,
      bbox: p.bbox as [number, number, number, number],
    }));
  }

  private videoElement: HTMLVideoElement | null = null;

  /**
   * Starts real-time detection on the provided video element.
   */
  public startDetection(videoElement: HTMLVideoElement): void {
    this.videoElement = videoElement;
    if (this.isDetecting) return;
    this.isDetecting = true;

    const frameIntervalMs = 1000 / this.targetFps;

    const loop = async (timestamp: number) => {
      if (!this.isDetecting) return;

      const v = this.videoElement;
      if (
        document.visibilityState !== 'hidden' &&
        v &&
        v.readyState >= 2 &&
        v.videoWidth > 0 &&
        timestamp - this.lastRunTime >= frameIntervalMs
      ) {
        this.lastRunTime = timestamp;

        if (this.model) {
          try {
            const predictions = await this.model.detect(v);
            const validDetections: RawDetection[] = predictions
              .filter((p) => p.score >= this.minScore)
              .map((p) => ({
                label: p.class,
                score: p.score,
                bbox: p.bbox as [number, number, number, number],
              }));

            this.listeners.forEach((fn) => fn(validDetections));
          } catch (e) {
            console.error('Detection frame error:', e);
          }
        }
      }

      this.animationFrameId = requestAnimationFrame(loop);
    };

    this.animationFrameId = requestAnimationFrame(loop);
  }

  public stopDetection(): void {
    this.isDetecting = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }
}

export const detector = new DetectorController();
