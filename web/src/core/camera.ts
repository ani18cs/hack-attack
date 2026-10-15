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
   * Captures the current video frame, downscales to max 1024px wide, and returns a JPEG base64 string.
   */
  public captureFrame(maxWidth = 1024, quality = 0.7): string | null {
    if (!this.videoElement || this.videoElement.videoWidth === 0) {
      return null;
    }

    const video = this.videoElement;
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > maxWidth) {
      const scale = maxWidth / width;
      width = maxWidth;
      height = Math.round(height * scale);
    }

    if (!this.canvas) {
      this.canvas = document.createElement('canvas');
    }

    this.canvas.width = width;
    this.canvas.height = height;

    const ctx = this.canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);

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
