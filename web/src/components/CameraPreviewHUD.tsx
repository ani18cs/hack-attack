import React, { useEffect, useRef } from 'react';
import { SceneObject } from '../types';
import { FOCUS_CONFIG } from '../vision/focus';

interface CameraPreviewHUDProps {
  videoRef: React.RefObject<HTMLVideoElement>;
  detectedObjects: SceneObject[];
  fps?: number;
  activeModeName?: string;
  isOnline?: boolean;
}

/**
 * Live Camera Preview HUD with real-time bounding box annotations.
 * Renders the actual live camera video feed with overlaid bounding boxes,
 * corridor boundaries, zone labels, and collision warnings.
 */
export const CameraPreviewHUD: React.FC<CameraPreviewHUDProps> = ({
  videoRef,
  detectedObjects,
  fps = 8.5,
  activeModeName = 'Idle',
  isOnline = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Render bounding boxes over canvas matching video coordinates
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef?.current;
    if (!canvas) return;

    // Synchronize canvas coordinate resolution with actual video stream
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear previous frame
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw the walking path corridor rectangle and zone labels
    const cw = canvas.width;
    const ch = canvas.height;
    const corridorLeft = cw * FOCUS_CONFIG.corridor.xMin;
    const corridorRight = cw * FOCUS_CONFIG.corridor.xMax;
    const corridorWidth = corridorRight - corridorLeft;
    const corridorTop = ch * FOCUS_CONFIG.ignoreTop;
    const corridorHeight = ch - corridorTop;

    // 1. Upper Ignored Zone
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fillRect(0, 0, cw, corridorTop);
    ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('Upper Zone (Ignored)', 10, Math.min(20, corridorTop - 6));

    // 2. Side Danger-Only Zones
    ctx.fillStyle = 'rgba(15, 23, 42, 0.25)';
    ctx.fillRect(0, corridorTop, corridorLeft, corridorHeight);
    ctx.fillRect(corridorRight, corridorTop, cw - corridorRight, corridorHeight);

    ctx.fillStyle = 'rgba(234, 179, 8, 0.85)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText('Side Zone (Danger only)', 10, corridorTop + 20);
    ctx.fillText('Side Zone (Danger only)', Math.max(10, cw - 130), corridorTop + 20);

    // 3. Central Walking Corridor Box
    ctx.save();
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(corridorLeft, corridorTop, corridorWidth, corridorHeight);
    ctx.restore();

    ctx.fillStyle = '#22c55e';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.fillText('Walking Path Corridor', corridorLeft + 8, corridorTop + 18);

    if (detectedObjects.length === 0) {
      // Subtle center targeting crosshair
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      ctx.strokeStyle = 'rgba(250, 204, 21, 0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx - 16, cy);
      ctx.lineTo(cx + 16, cy);
      ctx.moveTo(cx, cy - 16);
      ctx.lineTo(cx, cy + 16);
      ctx.stroke();
      return;
    }

    detectedObjects.forEach((obj) => {
      const [bx, by, bw, bh] = obj.bbox;
      const isDanger = obj.danger;
      const strokeColor = isDanger ? '#ef4444' : '#facc15';
      const fillColor = isDanger ? 'rgba(239, 68, 68, 0.22)' : 'rgba(250, 204, 21, 0.16)';

      // 1. Draw bounding box rectangle
      ctx.lineWidth = 3;
      ctx.strokeStyle = strokeColor;
      ctx.strokeRect(bx, by, bw, bh);

      // Corner accent brackets
      const bracketLen = Math.min(14, bw / 4, bh / 4);
      ctx.lineWidth = 4;
      // top-left
      ctx.beginPath();
      ctx.moveTo(bx, by + bracketLen);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + bracketLen, by);
      // top-right
      ctx.moveTo(bx + bw - bracketLen, by);
      ctx.lineTo(bx + bw, by);
      ctx.lineTo(bx + bw, by + bracketLen);
      // bottom-left
      ctx.moveTo(bx, by + bh - bracketLen);
      ctx.lineTo(bx, by + bh);
      ctx.lineTo(bx + bracketLen, by + bh);
      // bottom-right
      ctx.moveTo(bx + bw - bracketLen, by + bh);
      ctx.lineTo(bx + bw, by + bh);
      ctx.lineTo(bx + bw, by + bh - bracketLen);
      ctx.stroke();

      ctx.fillStyle = fillColor;
      ctx.fillRect(bx, by, bw, bh);

      // 2. Draw label badge with rounded pill
      const zoneStr = obj.zone ? `[${obj.zone}] ` : '';
      const distStr = obj.formattedDistance || obj.distance;
      const labelText = `${isDanger ? '⚠️ ' : ''}${zoneStr}${obj.label.toUpperCase()} · ${distStr} · ${obj.direction}`;
      ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
      const textMetrics = ctx.measureText(labelText);
      const textWidth = textMetrics.width;

      const badgeX = Math.max(0, bx);
      const badgeY = Math.max(18, by - 6);

      ctx.fillStyle = isDanger ? '#dc2626' : '#ca8a04';
      if (typeof ctx.roundRect === 'function') {
        ctx.beginPath();
        ctx.roundRect(badgeX, badgeY - 15, textWidth + 10, 18, 4);
        ctx.fill();
      } else {
        ctx.fillRect(badgeX, badgeY - 15, textWidth + 10, 18);
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillText(labelText, badgeX + 5, badgeY - 2);
    });
  }, [detectedObjects, videoRef]);

  return (
    <div className="relative w-full h-44 sm:h-52 bg-zinc-950 rounded-2xl overflow-hidden border-2 border-yellow-400 shadow-xl flex items-center justify-center">
      {/* Live Video Feed attached to user's rear camera */}
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Canvas for real-time bounding box marking */}
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none z-10"
      />

      {/* Top telemetry badges */}
      <div className="absolute top-2 left-3 right-3 z-20 flex items-center justify-between pointer-events-none text-[11px] font-mono">
        <div className="flex items-center gap-1.5 bg-black/85 backdrop-blur px-2.5 py-1 rounded-full border border-yellow-400/60 text-yellow-300">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>AI VISION HUD · {fps.toFixed(1)} FPS</span>
        </div>

        <div className="flex items-center gap-1.5 bg-black/85 backdrop-blur px-2.5 py-1 rounded-full border border-zinc-700 text-zinc-300">
          <span className="text-zinc-400 uppercase text-[10px]">MODE:</span>
          <span className="font-bold text-white">{activeModeName}</span>
          <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400' : 'bg-red-400'}`} />
        </div>
      </div>

      {/* Bottom object counter & collision warning */}
      <div className="absolute bottom-2 left-3 right-3 z-20 pointer-events-none flex items-center justify-between">
        <div className="bg-black/85 backdrop-blur px-2.5 py-0.5 rounded text-[11px] font-mono text-zinc-300 border border-zinc-850">
          TRACKS: <span className="font-bold text-yellow-300">{detectedObjects.length}</span>
          {detectedObjects.length > 0 && ` (${detectedObjects.map((o) => o.label).slice(0, 3).join(', ')})`}
        </div>
        {detectedObjects.some((o) => o.danger) && (
          <div className="bg-red-600/90 text-white font-bold px-2 py-0.5 rounded text-[10px] animate-pulse">
            ⚠️ COLLISION WARNING
          </div>
        )}
      </div>
    </div>
  );
};
