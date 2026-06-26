import { useEffect, useRef } from "react";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

// Fixed minimap viewport (CSS px). Content is fit into it.
const BOX_W = 208;
const BOX_H = 146;
const PAD = 80; // scene padding around the (elements ∪ viewport) frame, per 1.html

export type MinimapScene = {
  elements: readonly NonDeletedExcalidrawElement[];
  appState: AppState;
  files: BinaryFiles;
};

type Props = {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  subscribe: (fn: (d: MinimapScene) => void) => void;
};

// world<->minimap transform (recomputed each draw). Frame = elements ∪ viewport
// (matches the 1.html prototype: frame recomputes as you pan/zoom).
type Xform = {
  scale: number;
  offX: number;
  offY: number;
  minX: number;
  minY: number;
};

export function Minimap({ excalidrawAPI, subscribe }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef<MinimapScene | null>(null);
  const xform = useRef<Xform>({ scale: 1, offX: 0, offY: 0, minX: 0, minY: 0 });
  const raf = useRef<number | null>(null);

  const scheduleDraw = () => {
    if (raf.current != null) {
      return;
    }
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      draw();
    });
  };

  const draw = () => {
    const d = latest.current;
    const canvas = canvasRef.current;
    if (!d || !canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(BOX_W * dpr) || canvas.height !== Math.round(BOX_H * dpr)) {
      canvas.width = Math.round(BOX_W * dpr);
      canvas.height = Math.round(BOX_H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, BOX_W, BOX_H);

    const els = d.elements;
    const { appState } = d;

    // --- frame: elements ∪ viewport, PAD padding (1.html prototype) ---
    // real Excalidraw transform: screenX=(sceneX+scrollX)*zoom+offsetLeft
    //  => visible scene rect: x in [-scrollX, width/zoom - scrollX]
    const z = appState.zoom.value;
    const vLeft = -appState.scrollX;
    const vTop = -appState.scrollY;
    const vW = appState.width / z;
    const vH = appState.height / z;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of els) {
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + el.width);
      maxY = Math.max(maxY, el.y + el.height);
    }
    if (els.length === 0) {
      minX = vLeft;
      minY = vTop;
      maxX = vLeft + vW;
      maxY = vTop + vH;
    } else {
      minX = Math.min(minX, vLeft) - PAD;
      minY = Math.min(minY, vTop) - PAD;
      maxX = Math.max(maxX, vLeft + vW) + PAD;
      maxY = Math.max(maxY, vTop + vH) + PAD;
    }

    const worldW = Math.max(1, maxX - minX);
    const worldH = Math.max(1, maxY - minY);

    const scale = Math.min(BOX_W / worldW, BOX_H / worldH);
    const offX = (BOX_W - worldW * scale) / 2;
    const offY = (BOX_H - worldH * scale) / 2;
    xform.current = { scale, offX, offY, minX, minY };

    const toX = (wx: number) => (wx - minX) * scale + offX;
    const toY = (wy: number) => (wy - minY) * scale + offY;

    // --- draw elements as simplified shapes (cheap, realtime) ---
    for (const el of els) {
      const x = toX(el.x);
      const y = toY(el.y);
      const w = Math.max(0.6, el.width * scale);
      const h = Math.max(0.6, el.height * scale);

      ctx.save();
      ctx.translate(x + w / 2, y + h / 2);
      ctx.rotate(el.angle || 0);
      ctx.translate(-w / 2, -h / 2);

      const stroke = el.strokeColor || "#1b1b1f";
      const bg = el.backgroundColor;
      const filled = bg && bg !== "transparent";

      ctx.lineWidth = 1;
      ctx.strokeStyle = stroke;

      if (el.type === "ellipse") {
        ctx.beginPath();
        ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        if (filled) {
          ctx.fillStyle = bg as string;
          ctx.fill();
        }
        ctx.stroke();
      } else if (
        el.type === "line" ||
        el.type === "arrow" ||
        el.type === "freedraw"
      ) {
        const points =
          "points" in el ? (el as { points: readonly number[][] }).points : null;
        ctx.beginPath();
        if (points && points.length) {
          points.forEach((p, i) => {
            const px = p[0] * scale;
            const py = p[1] * scale;
            if (i === 0) {
              ctx.moveTo(px, py);
            } else {
              ctx.lineTo(px, py);
            }
          });
        } else {
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
        }
        ctx.stroke();
      } else {
        ctx.beginPath();
        if (el.type === "diamond") {
          ctx.moveTo(w / 2, 0);
          ctx.lineTo(w, h / 2);
          ctx.lineTo(w / 2, h);
          ctx.lineTo(0, h / 2);
          ctx.closePath();
        } else {
          ctx.rect(0, 0, w, h);
        }
        if (el.type === "text") {
          ctx.fillStyle = stroke;
          ctx.fillRect(0, 0, w, Math.max(1.2, h));
        } else {
          if (filled) {
            ctx.fillStyle = bg as string;
            ctx.fill();
          }
          ctx.stroke();
        }
      }
      ctx.restore();
    }

    // --- viewport rectangle (coords computed above with the frame) ---
    const rx = toX(vLeft);
    const ry = toY(vTop);
    const rw = Math.max(1, vW * scale);
    const rh = Math.max(1, vH * scale);

    // indigo dashed viewport (matches 1.html style)
    ctx.fillStyle = "rgba(79, 70, 229, 0.04)";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = "#4f46e5";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 3]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);

    if (wrapRef.current) {
      wrapRef.current.style.display = "block";
    }
  };

  useEffect(() => {
    subscribe((d) => {
      latest.current = d;
      scheduleDraw();
    });
    return () => {
      if (raf.current != null) {
        cancelAnimationFrame(raf.current);
      }
    };
  }, [subscribe]);

  // click/drag -> center that world point. From scene/scroll.ts centerScrollOn:
  //   scrollX = width/(2*zoom) - scenePoint.x
  const panToCenter = (clientX: number, clientY: number) => {
    const d = latest.current;
    const canvas = canvasRef.current;
    if (!d || !canvas || !excalidrawAPI) {
      return;
    }
    const r = canvas.getBoundingClientRect();
    const mx = ((clientX - r.left) / r.width) * BOX_W;
    const my = ((clientY - r.top) / r.height) * BOX_H;
    const { scale, offX, offY, minX, minY } = xform.current;
    const wx = (mx - offX) / scale + minX;
    const wy = (my - offY) / scale + minY;
    const z = d.appState.zoom.value;
    excalidrawAPI.updateScene({
      appState: {
        scrollX: d.appState.width / (2 * z) - wx,
        scrollY: d.appState.height / (2 * z) - wy,
      },
    });
  };

  let dragging = false;
  const onPointerDown = (e: React.PointerEvent) => {
    dragging = true;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    panToCenter(e.clientX, e.clientY);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging) {
      panToCenter(e.clientX, e.clientY);
    }
  };
  const onPointerUp = () => {
    dragging = false;
  };

  // reset viewpoint: recenter on all content
  const onReset = (e: React.MouseEvent) => {
    e.stopPropagation();
    excalidrawAPI?.scrollToContent();
  };

  return (
    <div className="minimap">
      <div
        ref={wrapRef}
        className="minimap__box"
        style={{ display: "none", width: BOX_W, height: BOX_H }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <canvas
          ref={canvasRef}
          style={{ width: BOX_W, height: BOX_H, display: "block" }}
        />
        <button
          type="button"
          className="minimap__reset"
          onClick={onReset}
          onPointerDown={(e) => e.stopPropagation()}
        >
          重置视角
        </button>
      </div>
    </div>
  );
}
