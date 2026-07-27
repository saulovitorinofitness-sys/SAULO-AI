"use client";

import Image from "next/image";
import type {
  ChangeEvent,
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  WheelEvent,
} from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Button } from "@/components/ui/button";
import {
  isPosturalImageMimeType,
  isValidPosturalImageFile,
  calculatePosturalFitZoom,
  clampPosturalPan,
  clampPosturalZoom,
  POSTURAL_IMAGE_MIME_TYPES,
} from "@/features/clinical-collection";
import type {
  PosturalSymmetrograph,
  PosturalViewImage,
  PosturalViewKey,
} from "@/features/clinical-collection";

export interface PosturalViewportPoint {
  readonly x: number;
  readonly y: number;
}

export interface PosturalViewportState {
  readonly zoomPercent: number;
  readonly pan: PosturalViewportPoint;
  readonly fitMode: boolean;
}

export const DEFAULT_POSTURAL_VIEWPORT_STATE: PosturalViewportState = {
  zoomPercent: 100,
  pan: { x: 0, y: 0 },
  fitMode: true,
};

type Point = PosturalViewportPoint;

interface Size {
  readonly width: number;
  readonly height: number;
}

function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Não foi possível ler a imagem."));
    });
    reader.addEventListener("error", () =>
      reject(new Error("Não foi possível ler a imagem.")),
    );
    reader.readAsDataURL(file);
  });
}

function distance(first: Point, second: Point) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function SymmetrographOverlay({
  opacity,
}: {
  opacity: number;
}) {
  const style: CSSProperties = {
    backgroundImage:
      "linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)",
    backgroundSize: "10% 10%",
    opacity,
  };

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 text-emerald-300"
      style={style}
    >
      <span className="absolute inset-y-0 left-1/2 border-l-2 border-current" />
      <span className="absolute inset-x-0 top-1/2 border-t-2 border-current" />
    </div>
  );
}

function SymmetrographControls({
  idPrefix,
  onChange,
  readOnly,
  symmetrograph,
}: {
  idPrefix: string;
  onChange: (value: PosturalSymmetrograph) => void;
  readOnly: boolean;
  symmetrograph: PosturalSymmetrograph;
}) {
  const gridId = `${idPrefix}-symmetrograph`;
  const opacityId = `${idPrefix}-opacity`;

  return (
    <div className="mx-auto w-full max-w-[420px] space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <label
        className="flex min-h-10 cursor-pointer items-center gap-3 text-sm font-black text-slate-700"
        htmlFor={gridId}
      >
        <input
          checked={symmetrograph.enabled}
          className="size-4 accent-[#12664f]"
          disabled={readOnly}
          id={gridId}
          onChange={(event) =>
            onChange({
              ...symmetrograph,
              enabled: event.target.checked,
            })
          }
          type="checkbox"
        />
        Exibir Simetrógrafo
      </label>

      <label
        className="block text-xs font-bold text-slate-600"
        htmlFor={opacityId}
      >
        Transparência da grade:{" "}
        {Math.round(symmetrograph.opacity * 100)}%
      </label>
      <input
        className="w-full accent-[#12664f] disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!symmetrograph.enabled || readOnly}
        id={opacityId}
        max="1"
        min="0.1"
        onChange={(event) =>
          onChange({
            ...symmetrograph,
            opacity: Number(event.target.value),
          })
        }
        step="0.05"
        type="range"
        value={symmetrograph.opacity}
      />
    </div>
  );
}

export function PosturalImageInspectionViewer({
  imageUrl,
  inspection = false,
  onViewportChange,
  symmetrograph,
  title,
  viewportState,
}: {
  imageUrl: string;
  inspection?: boolean;
  onViewportChange?: (value: PosturalViewportState) => void;
  symmetrograph: PosturalSymmetrograph;
  title: string;
  viewportState?: PosturalViewportState;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointers = useRef(new Map<number, Point>());
  const dragStart = useRef<
    | {
        pointerId: number;
        pointer: Point;
        pan: Point;
      }
    | undefined
  >(undefined);
  const pinchStart = useRef<
    | {
        distance: number;
        zoom: number;
      }
    | undefined
  >(undefined);
  const [naturalSize, setNaturalSize] = useState<Size>();
  const [viewportSize, setViewportSize] = useState<Size>();
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [fitMode, setFitMode] = useState(true);
  const controlled = viewportState !== undefined;
  const sourceState = viewportState ?? {
    zoomPercent: zoom,
    pan,
    fitMode,
  };

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;

    const updateSize = () =>
      setViewportSize({
        width: element.clientWidth,
        height: element.clientHeight,
      });
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const fitZoom = useMemo(() => {
    if (!naturalSize || !viewportSize) return 100;

    return calculatePosturalFitZoom(
      naturalSize,
      viewportSize,
    );
  }, [naturalSize, viewportSize]);

  const clampZoom = useCallback(
    (value: number) => {
      return clampPosturalZoom(value, fitZoom);
    },
    [fitZoom],
  );
  const effectiveZoom = sourceState.fitMode
    ? fitZoom
    : clampZoom(sourceState.zoomPercent);

  const clampPan = useCallback(
    (value: Point, zoomPercent = effectiveZoom): Point => {
      if (!naturalSize || !viewportSize) return { x: 0, y: 0 };

      return clampPosturalPan({
        image: naturalSize,
        pan: value,
        viewport: viewportSize,
        zoomPercent,
      });
    },
    [effectiveZoom, naturalSize, viewportSize],
  );
  const effectivePan = clampPan(sourceState.pan, effectiveZoom);

  function updateViewport(next: PosturalViewportState) {
    const normalized = {
      ...next,
      zoomPercent: clampZoom(next.zoomPercent),
      pan: clampPan(next.pan, clampZoom(next.zoomPercent)),
    };
    if (!controlled) {
      setZoom(normalized.zoomPercent);
      setPan(normalized.pan);
      setFitMode(normalized.fitMode);
    }
    onViewportChange?.(normalized);
  }

  function applyZoom(value: number) {
    const nextZoom = clampZoom(value);
    updateViewport({
      zoomPercent: nextZoom,
      fitMode: Math.abs(nextZoom - fitZoom) < 0.01,
      pan: clampPan(effectivePan, nextZoom),
    });
  }

  function fitToViewport() {
    updateViewport({
      zoomPercent: fitZoom,
      fitMode: true,
      pan: { x: 0, y: 0 },
    });
  }

  function showAtOriginalSize() {
    updateViewport({
      zoomPercent: 100,
      fitMode: false,
      pan: { x: 0, y: 0 },
    });
  }

  function handleWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    applyZoom(effectiveZoom * factor);
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointers.current.size === 1) {
      dragStart.current = {
        pointerId: event.pointerId,
        pointer: { x: event.clientX, y: event.clientY },
        pan: effectivePan,
      };
    } else if (pointers.current.size === 2) {
      const [first, second] = [...pointers.current.values()];
      pinchStart.current = {
        distance: distance(first, second),
        zoom: effectiveZoom,
      };
      dragStart.current = undefined;
    }
  }

  function handlePointerMove(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!pointers.current.has(event.pointerId)) return;

    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });

    if (pointers.current.size >= 2 && pinchStart.current) {
      const [first, second] = [...pointers.current.values()];
      const currentDistance = distance(first, second);
      applyZoom(
        pinchStart.current.zoom *
          (currentDistance / pinchStart.current.distance),
      );
      return;
    }

    if (
      dragStart.current?.pointerId === event.pointerId &&
      effectiveZoom > fitZoom
    ) {
      updateViewport({
        zoomPercent: effectiveZoom,
        fitMode: false,
        pan: clampPan({
          x:
            dragStart.current.pan.x +
            event.clientX -
            dragStart.current.pointer.x,
          y:
            dragStart.current.pan.y +
            event.clientY -
            dragStart.current.pointer.y,
        }),
      });
    }
  }

  function handlePointerEnd(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    pointers.current.delete(event.pointerId);
    pinchStart.current = undefined;
    dragStart.current = undefined;

    const remaining = [...pointers.current.entries()][0];
    if (remaining) {
      dragStart.current = {
        pointerId: remaining[0],
        pointer: remaining[1],
        pan: effectivePan,
      };
    }
  }

  const canPan = effectiveZoom > fitZoom + 0.01;
  const imagePositionStyle: CSSProperties | undefined = naturalSize
    ? {
        height: naturalSize.height,
        width: naturalSize.width,
        transform: `translate(-50%, -50%) translate(${effectivePan.x}px, ${effectivePan.y}px)`,
      }
    : undefined;
  const imageScaleStyle: CSSProperties = {
    transform: `scale(${effectiveZoom / 100})`,
    transformOrigin: "center",
  };

  return (
    <div className="space-y-3">
      <div
        aria-label={`Visualizador da ${title.toLocaleLowerCase("pt-BR")}`}
        className={[
          "relative mx-auto w-full touch-none select-none overflow-hidden rounded-xl border border-slate-300 bg-slate-950 shadow-sm",
          inspection
            ? "h-[min(60vh,700px)] max-w-[1100px]"
            : "h-[clamp(360px,68vh,660px)] max-w-[420px]",
          canPan ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
        ].join(" ")}
        onDoubleClick={() =>
          effectiveZoom <= fitZoom + 0.01
            ? applyZoom(Math.max(100, fitZoom * 2))
            : fitToViewport()
        }
        onPointerCancel={handlePointerEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onWheel={handleWheel}
        ref={viewportRef}
        role="img"
      >
        <div
          className="absolute left-1/2 top-1/2 will-change-transform"
          style={imagePositionStyle}
        >
          <div
            className="relative size-full will-change-transform"
            style={imageScaleStyle}
          >
            <Image
              alt={`Fotografia da ${title.toLocaleLowerCase("pt-BR")}`}
              className="pointer-events-none object-contain"
              draggable={false}
              fill
              onLoad={(event) => {
                const element = event.currentTarget;
                setNaturalSize({
                  width: element.naturalWidth,
                  height: element.naturalHeight,
                });
              }}
              sizes={inspection ? "90vw" : "420px"}
              src={imageUrl}
              unoptimized
            />

            {symmetrograph.enabled ? (
              <SymmetrographOverlay
                opacity={symmetrograph.opacity}
              />
            ) : null}
          </div>
        </div>
      </div>

      <div
        aria-label="Controles de zoom e movimentação"
        className="flex flex-wrap items-center justify-center gap-1.5"
        role="group"
      >
        <Button
          aria-label="Diminuir zoom"
          onClick={() => applyZoom(effectiveZoom / 1.25)}
          size="small"
          type="button"
          variant="outline"
        >
          Zoom −
        </Button>

        <output
          aria-live="polite"
          className="min-w-14 text-center text-xs font-black text-slate-700"
        >
          {Math.round(effectiveZoom)}%
        </output>

        <Button
          aria-label="Aumentar zoom"
          onClick={() => applyZoom(effectiveZoom * 1.25)}
          size="small"
          type="button"
          variant="outline"
        >
          Zoom +
        </Button>

        <Button
          onClick={fitToViewport}
          size="small"
          type="button"
          variant="ghost"
        >
          Ajustar à tela
        </Button>

        <Button
          onClick={showAtOriginalSize}
          size="small"
          type="button"
          variant="ghost"
        >
          Visualização 100%
        </Button>

        <Button
          onClick={() =>
            updateViewport({
              ...sourceState,
              zoomPercent: effectiveZoom,
              pan: { x: 0, y: 0 },
            })
          }
          size="small"
          type="button"
          variant="ghost"
        >
          Centralizar
        </Button>
      </div>
    </div>
  );
}

export function PosturalImageViewer({
  assessmentId,
  gridEnabled,
  gridOpacity,
  image,
  imageUrl,
  onChange,
  onGridChange,
  onRemove,
  patientId,
  readOnly = false,
  title,
  viewType,
}: {
  assessmentId?: string;
  patientId: string;
  viewType: PosturalViewKey;
  image?: PosturalViewImage;
  imageUrl?: string;
  gridEnabled: boolean;
  gridOpacity: number;
  readOnly?: boolean;
  title: string;
  onChange: (image: PosturalViewImage) => void;
  onRemove: () => void;
  onGridChange: (
    symmetrograph: PosturalSymmetrograph,
  ) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [inspectionOpen, setInspectionOpen] = useState(false);
  const resolvedImageUrl = imageUrl ?? image?.dataUrl;
  const inputId = `postural-image-${viewType.toLocaleLowerCase("en-US")}`;
  const symmetrograph = {
    enabled: gridEnabled,
    opacity: Math.min(1, Math.max(0.1, gridOpacity)),
  };

  useEffect(() => {
    if (!inspectionOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setInspectionOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [inspectionOpen]);

  async function importImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!isPosturalImageMimeType(file.type)) {
      setError("Use uma imagem JPEG, PNG ou WebP.");
      return;
    }
    if (!isValidPosturalImageFile(file)) {
      setError("A imagem deve ter no máximo 5 MB.");
      return;
    }

    try {
      const dataUrl = await readImage(file);
      setError(undefined);
      onChange({
        dataUrl,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
      });
    } catch {
      setError("Não foi possível importar a imagem.");
    }
  }

  return (
    <section
      className="space-y-3"
      data-assessment-id={assessmentId}
      data-patient-id={patientId}
      data-view-type={viewType}
    >
      <input
        accept={POSTURAL_IMAGE_MIME_TYPES.join(",")}
        className="sr-only"
        id={inputId}
        onChange={importImage}
        ref={inputRef}
        type="file"
      />

      {resolvedImageUrl ? (
        <PosturalImageInspectionViewer
          imageUrl={resolvedImageUrl}
          symmetrograph={symmetrograph}
          title={title}
        />
      ) : (
        <div className="mx-auto flex h-64 w-full max-w-[420px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
          Nenhuma imagem importada para esta vista.
        </div>
      )}

      <div className="flex flex-wrap justify-center gap-1.5">
        {!readOnly ? (
          <Button
            onClick={() => inputRef.current?.click()}
            size="small"
            type="button"
            variant={resolvedImageUrl ? "outline" : "primary"}
          >
            {resolvedImageUrl
              ? "Alterar imagem"
              : "Importar imagem"}
          </Button>
        ) : null}

        {resolvedImageUrl ? (
          <>
            <Button
              onClick={() => setInspectionOpen(true)}
              size="small"
              type="button"
              variant="outline"
            >
              Ampliar
            </Button>

            <Button
              onClick={() => setInspectionOpen(true)}
              size="small"
              type="button"
              variant="outline"
            >
              Modo de inspeção
            </Button>

            {!readOnly ? (
              <Button
                onClick={() => {
                  setError(undefined);
                  onRemove();
                }}
                size="small"
                type="button"
                variant="destructive"
              >
                Remover imagem
              </Button>
            ) : null}
          </>
        ) : null}
      </div>

      {error ? (
        <p
          className="text-center text-sm font-semibold text-red-700"
          role="alert"
        >
          {error}
        </p>
      ) : null}

      <SymmetrographControls
        idPrefix={inputId}
        onChange={onGridChange}
        readOnly={readOnly}
        symmetrograph={symmetrograph}
      />

      <fieldset
        className="rounded-xl border border-slate-200 bg-slate-50 p-4"
        disabled
      >
        <legend className="px-1 text-sm font-black text-slate-600">
          Análise Assistida por IA
        </legend>
        <p className="text-sm font-semibold text-slate-500">
          Em desenvolvimento.
        </p>
      </fieldset>

      {inspectionOpen && resolvedImageUrl ? (
        <div
          aria-label={`Modo de inspeção da ${title.toLocaleLowerCase("pt-BR")}`}
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 px-[5vw] py-[5vh]"
          onClick={() => setInspectionOpen(false)}
          role="dialog"
        >
          <div
            className="flex h-[90vh] w-[90vw] flex-col gap-3 overflow-y-auto rounded-xl bg-white p-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-4">
              <p className="text-sm font-black text-slate-800">
                {title} · modo de inspeção
              </p>
              <Button
                autoFocus
                onClick={() => setInspectionOpen(false)}
                size="small"
                type="button"
                variant="outline"
              >
                Fechar
              </Button>
            </div>

            <div className="min-h-0 flex-1">
              <PosturalImageInspectionViewer
                imageUrl={resolvedImageUrl}
                inspection
                symmetrograph={symmetrograph}
                title={title}
              />
            </div>

            <SymmetrographControls
              idPrefix={`${inputId}-inspection`}
              onChange={onGridChange}
              readOnly={readOnly}
              symmetrograph={symmetrograph}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
