"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

/**
 * Méthodes exposées via ref par {@link SignaturePad}.
 */
export interface SignaturePadHandle {
  /** Vide le canvas. */
  clear: () => void;
  /** True si rien n'a été dessiné. */
  isEmpty: () => boolean;
  /** Retourne la signature au format dataURL PNG (base64). */
  toDataURL: () => string;
}

interface SignaturePadProps {
  /** Hauteur du canvas en pixels (largeur = 100% du parent). */
  height?: number;
  /** Couleur du trait. */
  penColor?: string;
  /** Épaisseur du trait. */
  penWidth?: number;
  /** Classe CSS additionnelle sur le conteneur. */
  className?: string;
}

/**
 * Pad de signature HTML5 natif (souris + tactile).
 *
 * <p>Pas de dépendance externe — implémente le dessin via {@code canvas.getContext("2d")}
 * et la gestion fine du DPI pour rester net sur écran retina. Le composant est contrôlable
 * via une ref ({@link SignaturePadHandle}) pour clear / isEmpty / toDataURL.
 */
export const SignaturePad = forwardRef<SignaturePadHandle, SignaturePadProps>(
  function SignaturePad(
    { height = 200, penColor = "#111827", penWidth = 2, className },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const isDrawingRef = useRef(false);
    const lastPointRef = useRef<{ x: number; y: number } | null>(null);
    const [isEmpty, setIsEmpty] = useState(true);

    // Garde une copie de la dernière image rendue pour la restaurer après resize
    const snapshotRef = useRef<string | null>(null);

    const getContext = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = penColor;
      ctx.lineWidth = penWidth;
      return ctx;
    }, [penColor, penWidth]);

    const resizeCanvas = useCallback(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const ratio = window.devicePixelRatio || 1;
      const width = container.clientWidth;

      // Sauvegarde du contenu actuel avant resize (sinon le canvas est effacé)
      const hadContent = snapshotRef.current !== null;

      canvas.width = width * ratio;
      canvas.height = height * ratio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(ratio, ratio);
      }

      // Restaurer le tracé sauvegardé si présent
      if (hadContent && snapshotRef.current) {
        const img = new Image();
        img.onload = () => {
          ctx?.drawImage(img, 0, 0, width, height);
        };
        img.src = snapshotRef.current;
      }
    }, [height]);

    useEffect(() => {
      resizeCanvas();
      window.addEventListener("resize", resizeCanvas);
      return () => window.removeEventListener("resize", resizeCanvas);
    }, [resizeCanvas]);

    const getCoords = (
      e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    ): { x: number; y: number } | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      if ("touches" in e) {
        const touch = e.touches[0] ?? e.changedTouches[0];
        if (!touch) return null;
        return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      }
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const startDrawing = (
      e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    ) => {
      const ctx = getContext();
      const point = getCoords(e);
      if (!ctx || !point) return;
      isDrawingRef.current = true;
      lastPointRef.current = point;
      ctx.beginPath();
      ctx.moveTo(point.x, point.y);
    };

    const draw = (
      e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>,
    ) => {
      if (!isDrawingRef.current) return;
      const ctx = getContext();
      const point = getCoords(e);
      if (!ctx || !point) return;
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastPointRef.current = point;
      if (isEmpty) setIsEmpty(false);
    };

    const stopDrawing = () => {
      if (!isDrawingRef.current) return;
      isDrawingRef.current = false;
      lastPointRef.current = null;
      const canvas = canvasRef.current;
      if (canvas && !isEmpty) {
        snapshotRef.current = canvas.toDataURL("image/png");
      }
    };

    useImperativeHandle(
      ref,
      () => ({
        clear: () => {
          const canvas = canvasRef.current;
          const ctx = getContext();
          if (!canvas || !ctx) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          snapshotRef.current = null;
          setIsEmpty(true);
        },
        isEmpty: () => isEmpty,
        toDataURL: () => {
          const canvas = canvasRef.current;
          return canvas ? canvas.toDataURL("image/png") : "";
        },
      }),
      [getContext, isEmpty],
    );

    return (
      <div
        ref={containerRef}
        className={className ?? "w-full rounded-md border border-gray-300 bg-white"}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={(e) => {
            e.preventDefault();
            startDrawing(e);
          }}
          onTouchMove={(e) => {
            e.preventDefault();
            draw(e);
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            stopDrawing();
          }}
          className="block w-full touch-none cursor-crosshair"
          style={{ height: `${height}px` }}
        />
      </div>
    );
  },
);
