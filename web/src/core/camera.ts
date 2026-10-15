import { speech } from './speech';

/**
 * Camera stream management and frame capture utility.
 */
class CameraController {
  private stream: MediaStream | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private canvas: HTMLCanvasElement | null = null;

  /**
   * Initializes the rear camera stream and connects it to the given HTMLVideoElement.
   */
  public async start(videoEl?: HTMLVideoElement): Promise<MediaStream> {
    if (this.stream && this.stream.active) {
      if (videoEl && this.videoElement !== videoEl) {
        this.videoElement = videoEl;
        this.videoElement.srcObject = this.stream;
        await this.videoElement.play().catch(() => {});
      }
      return this.stream;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera access not supported on this browser/environment.');
    }

    const constraints: MediaStreamConstraints = {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
      // Fallback without specific facingMode if back camera is not directly available
      console.warn('Fallback to basic video constraint:', err);
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      } catch (finalErr: any) {
        console.error('Camera permission denied or camera unavailable:', finalErr);
        speech.speak('Camera permission denied or camera unavailable.', { priority: 'danger' });
        throw finalErr;
      }
    }

    if (this.stream) {
      try {
        const videoTrack = this.stream.getVideoTracks()[0];
        if (videoTrack && typeof (videoTrack as any).getCapabilities === 'function') {
          const capabilities = (videoTrack as any).getCapabilities();
          if (capabilities && 'zoom' in capabilities) {
            const minZoom = capabilities.zoom?.min ?? 1;
            const maxZoom = capabilities.zoom?.max ?? 1;
            const targetZoom = Math.max(minZoom, Math.min(1.5, maxZoom));
            await (videoTrack.applyConstraints as any)({
              advanced: [{ zoom: targetZoom }],
            }).catch(() => {});
          }
        }
      } catch (zoomErr) {
        // Fail safely if unsupported on this browser
        console.warn('Camera zoom constraint not supported:', zoomErr);
      }
    }

    if (videoEl) {
      this.videoElement = videoEl;
      this.videoElement.srcObject = this.stream;
      this.videoElement.setAttribute('playsinline', 'true');
      this.videoElement.muted = true;
      await this.videoElement.play().catch((e) => console.warn('Autoplay prevented:', e));
    }

    return this.stream;
  }

  public setVideoElement(videoEl: HTMLVideoElement | null): void {
    this.videoElement = videoEl;
    if (this.videoElement && this.stream) {
      this.videoElement.srcObject = this.stream;
      this.videoElement.setAttribute('playsinline', 'true');
      this.videoElement.muted = true;
      this.videoElement.play().catch(() => {});
    }
  }

  public getVideoElement(): HTMLVideoElement | null {
    return this.videoElement;
  }

  public getStream(): MediaStream | null {
    return this.stream;
  }

  /**
   * Captures the current video frame, optionally cropped to the walking path corridor,
   * downscales to maxWidth, and returns a JPEG base64 string.
   */
  public captureFrame(maxWidth = 720, quality = 0.65, cropCorridor = false): string | null {
    if (!this.videoElement || this.videoElement.videoWidth === 0) {
      return null;
    }

    const video = this.videoElement;
    let sx = 0;
    let sy = 0;
    let sWidth = video.videoWidth;
    let sHeight = video.videoHeight;

    if (cropCorridor) {
      sx = Math.round(video.videoWidth * 0.2);
      sy = Math.round(video.videoHeight * 0.25);
      sWidth = Math.round(video.videoWidth * 0.6);
      sHeight = Math.round(video.videoHeight * 0.75);
    }

    let outWidth = sWidth;
    let outHeight = sHeight;

    if (outWidth > maxWidth) {
      const scale = maxWidth / outWidth;
      outWidth = maxWidth;
      outHeight = Math.round(outHeight * scale);
    }

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
    }

    this.canvas.width = outWidth;
    this.canvas.height = outHeight;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, outWidth, outHeight);

    // Returns data:image/jpeg;base64,...
    return this.canvas.toDataURL('image/jpeg', quality);
  }

  public stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }
  }

  public async restart(videoEl?: HTMLVideoElement): Promise<MediaStream> {
    this.stop();
    return this.start(videoEl || this.videoElement || undefined);
  }
}

export const camera = new CameraController();
