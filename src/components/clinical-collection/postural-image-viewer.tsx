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
  useId,
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
  POSTURAL_IMAGE_MAX_SIZE_BYTES,
  POSTURAL_IMAGE_MIME_TYPES,
} from "@/features/clinical-collection";
import type {
  PosturalAnnotationLayer,
  PosturalAnnotationPoint,
  PosturalReferenceLine,
  PosturalReferenceLines,
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

type PosturalEditorTool =
  | "SELECT"
  | "MOVE"
  | "HORIZONTAL_LINES"
  | "VERTICAL_LINES"
  | "ARROW"
  | "CIRCLE"
  | "TEXT"
  | "FREEHAND";

export const DEFAULT_POSTURAL_REFERENCE_LINES: PosturalReferenceLines = {
  enabled: true,
  horizontal: [
    {
      id: "horizontal-1",
      orientation: "HORIZONTAL",
      position: 0.34,
      color: "#ef4444",
      thicknessPx: 2,
      opacity: 0.95,
      visible: true,
    },
    {
      id: "horizontal-2",
      orientation: "HORIZONTAL",
      position: 0.66,
      color: "#ef4444",
      thicknessPx: 2,
      opacity: 0.95,
      visible: true,
    },
  ],
  vertical: [
    {
      id: "vertical-1",
      orientation: "VERTICAL",
      position: 0.4,
      color: "#38bdf8",
      thicknessPx: 2,
      opacity: 0.95,
      visible: true,
    },
    {
      id: "vertical-2",
      orientation: "VERTICAL",
      position: 0.6,
      color: "#38bdf8",
      thicknessPx: 2,
      opacity: 0.95,
      visible: true,
    },
  ],
};

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
      className="pointer-events-none absolute inset-0 text-sky-300"
      style={style}
    >
      <span className="absolute inset-y-0 left-1/2 border-l-2 border-current" />
      <span className="absolute inset-x-0 top-1/2 border-t-2 border-current" />
    </div>
  );
}


function ReferenceLine({
  line,
  onChange,
}: {
  line: PosturalReferenceLine;
  onChange: (line: PosturalReferenceLine) => void;
}) {
  const lineRef = useRef<HTMLDivElement>(null);

  if (line.visible === false) return null;

  const isHorizontal = line.orientation === "HORIZONTAL";
  const thickness = line.thicknessPx ?? 2;
  const opacity = line.opacity ?? 1;

  function updatePosition(event: ReactPointerEvent<HTMLDivElement>) {
    const viewport = lineRef.current?.parentElement;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const raw = isHorizontal
      ? (event.clientY - rect.top) / rect.height
      : (event.clientX - rect.left) / rect.width;

    onChange({
      ...line,
      position: Math.min(0.98, Math.max(0.02, raw)),
    });
  }

  return (
    <div
      aria-label={
        isHorizontal
          ? "Linha horizontal móvel"
          : "Linha vertical móvel"
      }
      className={[
        "absolute z-30 touch-none select-none",
        isHorizontal
          ? "left-0 right-0 cursor-row-resize"
          : "bottom-0 top-0 cursor-col-resize",
      ].join(" ")}
      onPointerDown={(event) => {
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        updatePosition(event);
      }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
          return;
        }
        event.stopPropagation();
        updatePosition(event);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      }}
      ref={lineRef}
      role="slider"
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(line.position * 100)}
      style={
        isHorizontal
          ? {
              top: `${line.position * 100}%`,
              height: Math.max(14, thickness + 12),
              transform: "translateY(-50%)",
            }
          : {
              left: `${line.position * 100}%`,
              width: Math.max(14, thickness + 12),
              transform: "translateX(-50%)",
            }
      }
      tabIndex={0}
    >
      <span
        className={[
          "pointer-events-none absolute",
          isHorizontal
            ? "left-0 right-0 top-1/2 -translate-y-1/2"
            : "bottom-0 left-1/2 top-0 -translate-x-1/2",
        ].join(" ")}
        style={
          isHorizontal
            ? {
                height: thickness,
                backgroundColor: line.color,
                opacity,
              }
            : {
                width: thickness,
                backgroundColor: line.color,
                opacity,
              }
        }
      />
      <span
        className="pointer-events-none absolute left-1/2 top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
        style={{
          backgroundColor: line.color,
          opacity,
        }}
      />
    </div>
  );
}

function ReferenceLinesOverlay({
  lines,
  onChange,
}: {
  lines: PosturalReferenceLines;
  onChange: (lines: PosturalReferenceLines) => void;
}) {
  if (lines.enabled === false) return null;

  function updateLine(
    group: "horizontal" | "vertical",
    index: 0 | 1,
    line: PosturalReferenceLine,
  ) {
    if (group === "horizontal") {
      const next = [...lines.horizontal] as [
        PosturalReferenceLine,
        PosturalReferenceLine,
      ];
      next[index] = line;
      onChange({ ...lines, horizontal: next });
      return;
    }

    const next = [...lines.vertical] as [
      PosturalReferenceLine,
      PosturalReferenceLine,
    ];
    next[index] = line;
    onChange({ ...lines, vertical: next });
  }

  return (
    <>
      <ReferenceLine
        line={lines.horizontal[0]}
        onChange={(line) => updateLine("horizontal", 0, line)}
      />
      <ReferenceLine
        line={lines.horizontal[1]}
        onChange={(line) => updateLine("horizontal", 1, line)}
      />
      <ReferenceLine
        line={lines.vertical[0]}
        onChange={(line) => updateLine("vertical", 0, line)}
      />
      <ReferenceLine
        line={lines.vertical[1]}
        onChange={(line) => updateLine("vertical", 1, line)}
      />
    </>
  );
}


function normalizedPoint(
  event: ReactPointerEvent<SVGSVGElement>,
): PosturalAnnotationPoint {
  const rect = event.currentTarget.getBoundingClientRect();

  return {
    x: Math.min(
      1,
      Math.max(0, (event.clientX - rect.left) / rect.width),
    ),
    y: Math.min(
      1,
      Math.max(0, (event.clientY - rect.top) / rect.height),
    ),
  };
}

function ArrowAnnotationsOverlay({
  activeTool,
  annotations,
  onChange,
  onSelect,
  selectedId,
}: {
  activeTool: PosturalEditorTool;
  annotations: readonly PosturalAnnotationLayer[];
  onChange: (annotations: readonly PosturalAnnotationLayer[]) => void;
  onSelect: (id?: string) => void;
  selectedId?: string;
}) {
  const [draft, setDraft] =
    useState<PosturalAnnotationLayer>();
  const draftRef = useRef<PosturalAnnotationLayer | undefined>(undefined);
  const dragRef = useRef<
    | {
        id: string;
        startPointer: PosturalAnnotationPoint;
        originalStart: PosturalAnnotationPoint;
        originalEnd: PosturalAnnotationPoint;
      }
    | undefined
  >(undefined);

  const arrows = annotations.filter(
    (annotation) => annotation.type === "ARROW",
  );

  function clearDraft() {
    draftRef.current = undefined;
    setDraft(undefined);
  }

  function finishArrow() {
    const currentDraft = draftRef.current;
    if (!currentDraft) return;

    const start = currentDraft.start;
    const end = currentDraft.end;

    clearDraft();

    if (!start || !end) return;

    const arrowDistance = Math.hypot(
      end.x - start.x,
      end.y - start.y,
    );

    if (arrowDistance < 0.015) return;

    onChange([...annotations, currentDraft]);
    onSelect(currentDraft.id);
  }

  function startArrow(event: ReactPointerEvent<SVGSVGElement>) {
    if (activeTool !== "ARROW") return;

    event.preventDefault();
    event.stopPropagation();

    const point = normalizedPoint(event);
    const nextDraft: PosturalAnnotationLayer = {
      id: `arrow-${Date.now()}`,
      type: "ARROW",
      visible: true,
      color: "#f97316",
      opacity: 0.9,
      thicknessPx: 1.5,
      start: point,
      end: point,
    };

    draftRef.current = nextDraft;
    setDraft(nextDraft);
    onSelect(undefined);

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePointer(event: ReactPointerEvent<SVGSVGElement>) {
    const currentDraft = draftRef.current;

    if (currentDraft && activeTool === "ARROW") {
      event.preventDefault();
      event.stopPropagation();

      const point = normalizedPoint(event);
      const nextDraft = {
        ...currentDraft,
        end: point,
      };

      draftRef.current = nextDraft;
      setDraft(nextDraft);
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;

    event.preventDefault();
    event.stopPropagation();

    const pointer = normalizedPoint(event);
    const deltaX = pointer.x - drag.startPointer.x;
    const deltaY = pointer.y - drag.startPointer.y;

    const nextStart = {
      x: Math.min(1, Math.max(0, drag.originalStart.x + deltaX)),
      y: Math.min(1, Math.max(0, drag.originalStart.y + deltaY)),
    };
    const nextEnd = {
      x: Math.min(1, Math.max(0, drag.originalEnd.x + deltaX)),
      y: Math.min(1, Math.max(0, drag.originalEnd.y + deltaY)),
    };

    onChange(
      annotations.map((annotation) =>
        annotation.id === drag.id
          ? {
              ...annotation,
              start: nextStart,
              end: nextEnd,
            }
          : annotation,
      ),
    );
  }

  function endPointer(event: ReactPointerEvent<SVGSVGElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (draftRef.current && activeTool === "ARROW") {
      finishArrow();
    }

    dragRef.current = undefined;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function cancelPointer(event: ReactPointerEvent<SVGSVGElement>) {
    event.preventDefault();
    event.stopPropagation();

    clearDraft();
    dragRef.current = undefined;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function beginMove(
    event: ReactPointerEvent<SVGLineElement>,
    annotation: PosturalAnnotationLayer,
  ) {
    if (!annotation.start || !annotation.end) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const point = {
      x: Math.min(
        1,
        Math.max(0, (event.clientX - rect.left) / rect.width),
      ),
      y: Math.min(
        1,
        Math.max(0, (event.clientY - rect.top) / rect.height),
      ),
    };

    onSelect(annotation.id);
    dragRef.current = {
      id: annotation.id,
      startPointer: point,
      originalStart: annotation.start,
      originalEnd: annotation.end,
    };

    svg.setPointerCapture(event.pointerId);
  }

  const interactive = activeTool === "ARROW";

  const rendered = draft ? [...arrows, draft] : arrows;

  return (
    <svg
      aria-label="Camada de anotações posturais"
      className={[
        "absolute inset-0 z-40 size-full",
        interactive ? "pointer-events-auto" : "pointer-events-none",
        activeTool === "ARROW"
          ? "cursor-crosshair"
          : activeTool === "SELECT"
            ? "cursor-default"
            : "",
      ].join(" ")}
      onLostPointerCapture={() => {
        if (draftRef.current && activeTool === "ARROW") {
          finishArrow();
        }
        dragRef.current = undefined;
      }}
      onPointerCancel={cancelPointer}
      onPointerDown={startArrow}
      onPointerMove={movePointer}
      onPointerUp={endPointer}
    >
      <defs>
        <marker
          id="postural-arrow-head"
          markerHeight="6"
          markerWidth="6"
          orient="auto"
          refX="5.6"
          refY="2.5"
          viewBox="0 0 6 5"
        >
          <path d="M0,0 L6,2.5 L0,5 Z" fill="context-stroke" />
        </marker>
      </defs>

      {rendered.map((annotation) => {
        if (
          !annotation.start ||
          !annotation.end ||
          annotation.visible === false
        ) {
          return null;
        }

        const selected = annotation.id === selectedId;
        const color = annotation.color || "#f97316";
        const thickness = Math.min(
          annotation.thicknessPx ?? 1.5,
          1.75,
        );
        const opacity = annotation.opacity ?? 0.9;
        const midpoint = {
          x: (annotation.start.x + annotation.end.x) / 2,
          y: (annotation.start.y + annotation.end.y) / 2,
        };

        return (
          <g key={annotation.id}>
            {selected ? (
              <line
                className="pointer-events-none"
                x1={`${annotation.start.x * 100}%`}
                y1={`${annotation.start.y * 100}%`}
                x2={`${annotation.end.x * 100}%`}
                y2={`${annotation.end.y * 100}%`}
                stroke="#ffffff"
                strokeLinecap="round"
                strokeWidth={thickness + 3}
                opacity={0.75}
              />
            ) : null}

            <line
              className="cursor-pointer"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();

                onSelect(annotation.id);
                beginMove(event, annotation);
              }}
              x1={`${annotation.start.x * 100}%`}
              y1={`${annotation.start.y * 100}%`}
              x2={`${annotation.end.x * 100}%`}
              y2={`${annotation.end.y * 100}%`}
              stroke="transparent"
              strokeLinecap="round"
              strokeWidth="18"
              style={{ pointerEvents: "stroke" }}
            />

            <line
              className="pointer-events-none"
              markerEnd="url(#postural-arrow-head)"
              x1={`${annotation.start.x * 100}%`}
              y1={`${annotation.start.y * 100}%`}
              x2={`${annotation.end.x * 100}%`}
              y2={`${annotation.end.y * 100}%`}
              stroke={color}
              strokeLinecap="round"
              strokeWidth={selected ? thickness + 0.35 : thickness}
              opacity={opacity}
            />

            {selected ? (
              <>
                <circle
                  className="pointer-events-none"
                  cx={`${annotation.start.x * 100}%`}
                  cy={`${annotation.start.y * 100}%`}
                  fill={color}
                  r="3.5"
                  stroke="white"
                  strokeWidth="2"
                />
                <circle
                  className="pointer-events-none"
                  cx={`${annotation.end.x * 100}%`}
                  cy={`${annotation.end.y * 100}%`}
                  fill={color}
                  r="3.5"
                  stroke="white"
                  strokeWidth="2"
                />

                <g
                  className="cursor-pointer"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    dragRef.current = undefined;
                    onChange(
                      annotations.filter(
                        (item) => item.id !== annotation.id,
                      ),
                    );
                    onSelect(undefined);
                  }}
                  role="button"
                >
                  <circle
                    cx={`${midpoint.x * 100}%`}
                    cy={`${midpoint.y * 100}%`}
                    fill="#ffffff"
                    r="9"
                    stroke="#dc2626"
                    strokeWidth="1.5"
                  />
                  <line
                    x1={`${midpoint.x * 100 - 0.7}%`}
                    y1={`${midpoint.y * 100 - 0.7}%`}
                    x2={`${midpoint.x * 100 + 0.7}%`}
                    y2={`${midpoint.y * 100 + 0.7}%`}
                    stroke="#dc2626"
                    strokeLinecap="round"
                    strokeWidth="2"
                  />
                  <line
                    x1={`${midpoint.x * 100 + 0.7}%`}
                    y1={`${midpoint.y * 100 - 0.7}%`}
                    x2={`${midpoint.x * 100 - 0.7}%`}
                    y2={`${midpoint.y * 100 + 0.7}%`}
                    stroke="#dc2626"
                    strokeLinecap="round"
                    strokeWidth="2"
                  />
                </g>
              </>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}


function CircleAnnotationsOverlay({
  activeTool,
  annotations,
  onChange,
  onSelect,
  selectedId,
}: {
  activeTool: PosturalEditorTool;
  annotations: readonly PosturalAnnotationLayer[];
  onChange: (annotations: readonly PosturalAnnotationLayer[]) => void;
  onSelect: (id?: string) => void;
  selectedId?: string;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] =
    useState<PosturalAnnotationLayer>();
  const draftRef = useRef<PosturalAnnotationLayer | undefined>(undefined);
  const dragRef = useRef<
    | {
        id: string;
        pointerId: number;
        pointerStart: PosturalAnnotationPoint;
        originalCenter: PosturalAnnotationPoint;
      }
    | undefined
  >(undefined);

  const circles = annotations.filter(
    (annotation) => annotation.type === "CIRCLE",
  );

  function pointFromEvent(
    event: ReactPointerEvent<HTMLDivElement>,
  ): PosturalAnnotationPoint {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    return {
      x: Math.min(
        1,
        Math.max(0, (event.clientX - rect.left) / rect.width),
      ),
      y: Math.min(
        1,
        Math.max(0, (event.clientY - rect.top) / rect.height),
      ),
    };
  }

  function radiusFromEvent(
    event: ReactPointerEvent<HTMLDivElement>,
    center: PosturalAnnotationPoint,
  ) {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return 0;

    const centerX = rect.left + center.x * rect.width;
    const centerY = rect.top + center.y * rect.height;
    const radiusPx = Math.hypot(
      event.clientX - centerX,
      event.clientY - centerY,
    );

    return Math.min(0.48, radiusPx / rect.width);
  }

  function clearDraft() {
    draftRef.current = undefined;
    setDraft(undefined);
  }

  function finishDraft() {
    const current = draftRef.current;
    clearDraft();

    if (
      !current ||
      !current.center ||
      !current.radius ||
      current.radius < 0.015
    ) {
      return;
    }

    onChange([...annotations, current]);
    onSelect(current.id);
  }

  function handlePointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (activeTool !== "CIRCLE") return;

    event.preventDefault();
    event.stopPropagation();

    const center = pointFromEvent(event);
    const next: PosturalAnnotationLayer = {
      id: `circle-${Date.now()}`,
      type: "CIRCLE",
      visible: true,
      color: "#2563eb",
      opacity: 0.9,
      thicknessPx: 1.5,
      center,
      radius: 0.001,
    };

    draftRef.current = next;
    setDraft(next);
    onSelect(undefined);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    const currentDraft = draftRef.current;

    if (
      currentDraft &&
      activeTool === "CIRCLE" &&
      currentDraft.center
    ) {
      event.preventDefault();
      event.stopPropagation();

      const next = {
        ...currentDraft,
        radius: radiusFromEvent(event, currentDraft.center),
      };

      draftRef.current = next;
      setDraft(next);
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;

    event.preventDefault();
    event.stopPropagation();

    const pointer = pointFromEvent(event);
    const deltaX = pointer.x - drag.pointerStart.x;
    const deltaY = pointer.y - drag.pointerStart.y;

    onChange(
      annotations.map((annotation) =>
        annotation.id === drag.id
          ? {
              ...annotation,
              center: {
                x: Math.min(
                  1,
                  Math.max(
                    0,
                    drag.originalCenter.x + deltaX,
                  ),
                ),
                y: Math.min(
                  1,
                  Math.max(
                    0,
                    drag.originalCenter.y + deltaY,
                  ),
                ),
              },
            }
          : annotation,
      ),
    );
  }

  function handlePointerEnd(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (draftRef.current && activeTool === "CIRCLE") {
      event.preventDefault();
      event.stopPropagation();
      finishDraft();
    }

    dragRef.current = undefined;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function beginMove(
    event: ReactPointerEvent<HTMLDivElement>,
    annotation: PosturalAnnotationLayer,
  ) {
    if (!annotation.center) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const overlay = overlayRef.current;
    if (!overlay) return;

    const rect = overlay.getBoundingClientRect();
    const pointerStart = {
      x: Math.min(
        1,
        Math.max(0, (event.clientX - rect.left) / rect.width),
      ),
      y: Math.min(
        1,
        Math.max(0, (event.clientY - rect.top) / rect.height),
      ),
    };

    onSelect(annotation.id);
    dragRef.current = {
      id: annotation.id,
      pointerId: event.pointerId,
      pointerStart,
      originalCenter: annotation.center,
    };
    overlay.setPointerCapture(event.pointerId);
  }

  const rendered = draft ? [...circles, draft] : circles;

  return (
    <div
      aria-label="Camada de círculos posturais"
      className={[
        "absolute inset-0 z-[41]",
        activeTool === "CIRCLE"
          ? "pointer-events-auto cursor-crosshair"
          : "pointer-events-none",
      ].join(" ")}
      onLostPointerCapture={() => {
        if (draftRef.current && activeTool === "CIRCLE") {
          finishDraft();
        }
        dragRef.current = undefined;
      }}
      onPointerCancel={(event) => {
        event.stopPropagation();
        clearDraft();
        dragRef.current = undefined;
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      ref={overlayRef}
    >
      {rendered.map((annotation) => {
        if (
          !annotation.center ||
          !annotation.radius ||
          annotation.visible === false
        ) {
          return null;
        }

        const selected = annotation.id === selectedId;
        const color = annotation.color || "#2563eb";
        const thickness = Math.min(
          annotation.thicknessPx ?? 1.5,
          1.75,
        );
        const diameterPercent = annotation.radius * 200;

        return (
          <div
            className={[
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-full",
              "pointer-events-auto cursor-move",
            ].join(" ")}
            key={annotation.id}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelect(annotation.id);
              beginMove(event, annotation);
            }}
            style={{
              left: `${annotation.center.x * 100}%`,
              top: `${annotation.center.y * 100}%`,
              width: `${diameterPercent}%`,
              aspectRatio: "1 / 1",
              borderStyle: "solid",
              borderWidth: selected
                ? thickness + 0.35
                : thickness,
              borderColor: color,
              opacity: annotation.opacity ?? 0.9,
              boxShadow: selected
                ? "0 0 0 3px rgba(255,255,255,0.85)"
                : undefined,
            }}
          >
            {selected ? (
              <button
                aria-label="Excluir círculo"
                className="pointer-events-auto absolute -right-3 -top-3 flex size-6 items-center justify-center rounded-full border border-red-300 bg-white text-sm font-black leading-none text-red-600 shadow-md hover:bg-red-50"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange(
                    annotations.filter(
                      (item) => item.id !== annotation.id,
                    ),
                  );
                  onSelect(undefined);
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                type="button"
              >
                ×
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}


function TextAnnotationsOverlay({
  activeTool,
  annotations,
  onChange,
  onSelect,
  selectedId,
}: {
  activeTool: PosturalEditorTool;
  annotations: readonly PosturalAnnotationLayer[];
  onChange: (annotations: readonly PosturalAnnotationLayer[]) => void;
  onSelect: (id?: string) => void;
  selectedId?: string;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const generatedId = useId();
  const nextGeneratedId = useRef(0);
  const [editing, setEditing] = useState<{
    id: string;
    center: PosturalAnnotationPoint;
    value: string;
    isNew: boolean;
  }>();
  const dragRef = useRef<
    | {
        id: string;
        pointerId: number;
        pointerStart: PosturalAnnotationPoint;
        originalCenter: PosturalAnnotationPoint;
      }
    | undefined
  >(undefined);

  const texts = annotations.filter(
    (annotation) => annotation.type === "TEXT",
  );

  const editingId = editing?.id;

  useEffect(() => {
    if (!editingId) return;

    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });

    return () => cancelAnimationFrame(frame);
  }, [editingId]);

  function pointFromEvent(
    event: ReactPointerEvent<HTMLDivElement>,
  ): PosturalAnnotationPoint {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    return {
      x: Math.min(
        0.98,
        Math.max(0.02, (event.clientX - rect.left) / rect.width),
      ),
      y: Math.min(
        0.98,
        Math.max(0.02, (event.clientY - rect.top) / rect.height),
      ),
    };
  }

  function commitEditing() {
    if (!editing) return;

    const value = editing.value.trim();

    if (!value) {
      if (!editing.isNew) {
        onChange(
          annotations.filter(
            (annotation) => annotation.id !== editing.id,
          ),
        );
        onSelect(undefined);
      }
      setEditing(undefined);
      return;
    }

    if (editing.isNew) {
      onChange([
        ...annotations,
        {
          id: editing.id,
          type: "TEXT",
          visible: true,
          color: "#0f172a",
          opacity: 0.96,
          center: editing.center,
          text: value,
        },
      ]);
    } else {
      onChange(
        annotations.map((annotation) =>
          annotation.id === editing.id
            ? {
                ...annotation,
                center: editing.center,
                text: value,
              }
            : annotation,
        ),
      );
    }

    onSelect(editing.id);
    setEditing(undefined);
  }

  function cancelEditing() {
    if (!editing) return;
    setEditing(undefined);
  }

  function startText(event: ReactPointerEvent<HTMLDivElement>) {
    if (activeTool !== "TEXT" || editing) return;

    event.preventDefault();
    event.stopPropagation();

    const center = pointFromEvent(event);
    const id = `text-${generatedId}-${nextGeneratedId.current++}`;

    setEditing({
      id,
      center,
      value: "",
      isNew: true,
    });
    onSelect(undefined);
  }

  function beginMove(
    event: ReactPointerEvent<HTMLDivElement>,
    annotation: PosturalAnnotationLayer,
  ) {
    if (!annotation.center || editing) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const overlay = overlayRef.current;
    if (!overlay) return;

    const pointerStart = pointFromEvent(event);
    onSelect(annotation.id);

    dragRef.current = {
      id: annotation.id,
      pointerId: event.pointerId,
      pointerStart,
      originalCenter: annotation.center,
    };

    overlay.setPointerCapture(event.pointerId);
  }

  function moveText(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;

    event.preventDefault();
    event.stopPropagation();

    const pointer = pointFromEvent(event);
    const deltaX = pointer.x - drag.pointerStart.x;
    const deltaY = pointer.y - drag.pointerStart.y;

    onChange(
      annotations.map((annotation) =>
        annotation.id === drag.id
          ? {
              ...annotation,
              center: {
                x: Math.min(
                  0.98,
                  Math.max(
                    0.02,
                    drag.originalCenter.x + deltaX,
                  ),
                ),
                y: Math.min(
                  0.98,
                  Math.max(
                    0.02,
                    drag.originalCenter.y + deltaY,
                  ),
                ),
              },
            }
          : annotation,
      ),
    );
  }

  function endMove(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;

    event.preventDefault();
    event.stopPropagation();
    dragRef.current = undefined;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      aria-label="Camada de textos posturais"
      className={[
        "absolute inset-0 z-[42]",
        activeTool === "TEXT"
          ? "pointer-events-auto cursor-text"
          : "pointer-events-none",
      ].join(" ")}
      onPointerDown={startText}
      onPointerMove={moveText}
      onPointerUp={endMove}
      ref={overlayRef}
    >
      {texts.map((annotation) => {
        if (
          !annotation.center ||
          !annotation.text ||
          annotation.visible === false
        ) {
          return null;
        }

        const selected = annotation.id === selectedId;
        const isEditing = editing?.id === annotation.id;

        if (isEditing) return null;

        return (
          <div
            className={[
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-white/90 px-2 py-1 text-[12px] font-bold leading-4 text-slate-800 shadow-sm backdrop-blur-sm",
              selected
                ? "border-blue-500 ring-2 ring-white/90"
                : "border-slate-200",
              "pointer-events-auto cursor-move",
            ].join(" ")}
            key={annotation.id}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();

              setEditing({
                id: annotation.id,
                center: annotation.center!,
                value: annotation.text ?? "",
                isNew: false,
              });
              onSelect(annotation.id);
            }}
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onSelect(annotation.id);
              beginMove(event, annotation);
            }}
            style={{
              left: `${annotation.center.x * 100}%`,
              top: `${annotation.center.y * 100}%`,
              color: annotation.color || "#0f172a",
              opacity: annotation.opacity ?? 0.96,
              maxWidth: "42%",
              whiteSpace: "nowrap",
            }}
          >
            {annotation.text}

            {selected ? (
              <button
                aria-label="Excluir texto"
                className="absolute -right-3 -top-3 flex size-6 items-center justify-center rounded-full border border-red-300 bg-white text-sm font-black leading-none text-red-600 shadow-md hover:bg-red-50"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange(
                    annotations.filter(
                      (item) => item.id !== annotation.id,
                    ),
                  );
                  onSelect(undefined);
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                type="button"
              >
                ×
              </button>
            ) : null}
          </div>
        );
      })}

      {editing ? (
        <div
          className="pointer-events-auto absolute z-50 -translate-x-1/2 -translate-y-1/2"
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            left: `${editing.center.x * 100}%`,
            top: `${editing.center.y * 100}%`,
          }}
        >
          <input
            aria-label="Texto da anotação"
            className="w-48 rounded-lg border border-blue-400 bg-white px-2.5 py-2 text-xs font-bold text-slate-800 shadow-xl outline-none ring-2 ring-blue-100"
            onBlur={commitEditing}
            onChange={(event) =>
              setEditing((current) =>
                current
                  ? {
                      ...current,
                      value: event.target.value,
                    }
                  : current,
              )
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitEditing();
              }

              if (event.key === "Escape") {
                event.preventDefault();
                cancelEditing();
              }
            }}
            placeholder="Digite a observação..."
            ref={inputRef}
            value={editing.value}
          />
        </div>
      ) : null}
    </div>
  );
}


function FreehandAnnotationsOverlay({
  activeTool,
  annotations,
  onChange,
  onSelect,
  selectedId,
}: {
  activeTool: PosturalEditorTool;
  annotations: readonly PosturalAnnotationLayer[];
  onChange: (annotations: readonly PosturalAnnotationLayer[]) => void;
  onSelect: (id?: string) => void;
  selectedId?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const generatedId = useId();
  const nextGeneratedId = useRef(0);
  const [draft, setDraft] =
    useState<PosturalAnnotationLayer>();
  const draftRef = useRef<PosturalAnnotationLayer | undefined>(undefined);
  const dragRef = useRef<
    | {
        id: string;
        pointerStart: PosturalAnnotationPoint;
        originalPoints: readonly PosturalAnnotationPoint[];
      }
    | undefined
  >(undefined);

  const strokes = annotations.filter(
    (annotation) => annotation.type === "FREEHAND",
  );

  function pointFromEvent(
    event: ReactPointerEvent<SVGSVGElement>,
  ): PosturalAnnotationPoint {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    return {
      x: Math.min(
        1,
        Math.max(0, (event.clientX - rect.left) / rect.width),
      ),
      y: Math.min(
        1,
        Math.max(0, (event.clientY - rect.top) / rect.height),
      ),
    };
  }

  function clearDraft() {
    draftRef.current = undefined;
    setDraft(undefined);
  }

  function finishDraft() {
    const current = draftRef.current;
    clearDraft();

    if (!current?.points || current.points.length < 2) {
      return;
    }

    onChange([...annotations, current]);
    onSelect(current.id);
  }

  function startStroke(
    event: ReactPointerEvent<SVGSVGElement>,
  ) {
    if (activeTool !== "FREEHAND") return;

    event.preventDefault();
    event.stopPropagation();

    const point = pointFromEvent(event);
    const next: PosturalAnnotationLayer = {
      id: `freehand-${generatedId}-${nextGeneratedId.current++}`,
      type: "FREEHAND",
      visible: true,
      color: "#2563eb",
      opacity: 0.9,
      thicknessPx: 1.5,
      points: [point],
    };

    draftRef.current = next;
    setDraft(next);
    onSelect(undefined);

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveStroke(
    event: ReactPointerEvent<SVGSVGElement>,
  ) {
    const currentDraft = draftRef.current;

    if (currentDraft && activeTool === "FREEHAND") {
      event.preventDefault();
      event.stopPropagation();

      const point = pointFromEvent(event);
      const currentPoints = currentDraft.points ?? [];
      const lastPoint = currentPoints.at(-1);

      if (
        lastPoint &&
        Math.hypot(
          point.x - lastPoint.x,
          point.y - lastPoint.y,
        ) < 0.0025
      ) {
        return;
      }

      const next = {
        ...currentDraft,
        points: [...currentPoints, point],
      };

      draftRef.current = next;
      setDraft(next);
      return;
    }

    const drag = dragRef.current;
    if (!drag) return;

    event.preventDefault();
    event.stopPropagation();

    const pointer = pointFromEvent(event);
    const deltaX = pointer.x - drag.pointerStart.x;
    const deltaY = pointer.y - drag.pointerStart.y;

    const translated = drag.originalPoints.map((point) => ({
      x: Math.min(1, Math.max(0, point.x + deltaX)),
      y: Math.min(1, Math.max(0, point.y + deltaY)),
    }));

    onChange(
      annotations.map((annotation) =>
        annotation.id === drag.id
          ? {
              ...annotation,
              points: translated,
            }
          : annotation,
      ),
    );
  }

  function endStroke(
    event: ReactPointerEvent<SVGSVGElement>,
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (draftRef.current && activeTool === "FREEHAND") {
      finishDraft();
    }

    dragRef.current = undefined;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function beginMove(
    event: ReactPointerEvent<SVGPathElement>,
    annotation: PosturalAnnotationLayer,
  ) {
    if (!annotation.points || annotation.points.length < 2) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const svg = svgRef.current;
    if (!svg) return;

    const rect = svg.getBoundingClientRect();
    const pointerStart = {
      x: Math.min(
        1,
        Math.max(0, (event.clientX - rect.left) / rect.width),
      ),
      y: Math.min(
        1,
        Math.max(0, (event.clientY - rect.top) / rect.height),
      ),
    };

    onSelect(annotation.id);
    dragRef.current = {
      id: annotation.id,
      pointerStart,
      originalPoints: annotation.points,
    };

    svg.setPointerCapture(event.pointerId);
  }

  function pathFromPoints(
    points: readonly PosturalAnnotationPoint[],
  ) {
    if (points.length === 0) return "";

    const first = points[0];
    const rest = points.slice(1);

    return [
      `M ${first.x * 100} ${first.y * 100}`,
      ...rest.map(
        (point) => `L ${point.x * 100} ${point.y * 100}`,
      ),
    ].join(" ");
  }

  function bounds(
    points: readonly PosturalAnnotationPoint[],
  ) {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);

    return {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };
  }

  const rendered = draft ? [...strokes, draft] : strokes;

  return (
    <svg
      aria-label="Camada de desenho livre postural"
      className={[
        "absolute inset-0 z-[43] size-full",
        activeTool === "FREEHAND"
          ? "pointer-events-auto"
          : "pointer-events-none",
        activeTool === "FREEHAND" ? "cursor-crosshair" : "",
      ].join(" ")}
      onLostPointerCapture={() => {
        if (draftRef.current && activeTool === "FREEHAND") {
          finishDraft();
        }
        dragRef.current = undefined;
      }}
      onPointerCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        clearDraft();
        dragRef.current = undefined;
      }}
      onPointerDown={startStroke}
      onPointerMove={moveStroke}
      onPointerUp={endStroke}
      ref={svgRef}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {rendered.map((annotation) => {
        const points = annotation.points ?? [];
        if (
          points.length < 2 ||
          annotation.visible === false
        ) {
          return null;
        }

        const selected = annotation.id === selectedId;
        const color = annotation.color || "#2563eb";
        const thickness = Math.min(
          annotation.thicknessPx ?? 1.5,
          1.75,
        );
        const opacity = annotation.opacity ?? 0.9;
        const path = pathFromPoints(points);
        const box = bounds(points);
        const deletePoint = {
          x: Math.min(0.97, box.maxX),
          y: Math.max(0.03, box.minY),
        };

        return (
          <g key={annotation.id}>
            {selected ? (
              <path
                className="pointer-events-none"
                d={path}
                fill="none"
                stroke="#ffffff"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={thickness + 1.2}
                vectorEffect="non-scaling-stroke"
                opacity={0.85}
              />
            ) : null}

            <path
              className="cursor-move"
              d={path}
              fill="none"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onSelect(annotation.id);
                beginMove(event, annotation);
              }}
              stroke="transparent"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="12"
              vectorEffect="non-scaling-stroke"
              style={{ pointerEvents: "stroke" }}
            />

            <path
              className="pointer-events-none"
              d={path}
              fill="none"
              stroke={color}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={
                selected ? thickness + 0.25 : thickness
              }
              vectorEffect="non-scaling-stroke"
              opacity={opacity}
            />

            {selected ? (
              <g
                className="cursor-pointer"
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  dragRef.current = undefined;
                  onChange(
                    annotations.filter(
                      (item) => item.id !== annotation.id,
                    ),
                  );
                  onSelect(undefined);
                }}
                role="button"
              >
                <circle
                  cx={deletePoint.x * 100}
                  cy={deletePoint.y * 100}
                  fill="#ffffff"
                  r="2.4"
                  stroke="#dc2626"
                  strokeWidth="0.5"
                />
                <text
                  x={deletePoint.x * 100}
                  y={deletePoint.y * 100}
                  dominantBaseline="middle"
                  fill="#dc2626"
                  fontSize="4"
                  fontWeight="900"
                  pointerEvents="none"
                  textAnchor="middle"
                >
                  ×
                </text>
              </g>
            ) : null}
          </g>
        );
      })}
    </svg>
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
    <div className="mx-auto w-full max-w-[420px] space-y-3 rounded-2xl border border-blue-100 bg-blue-50/60 p-4 shadow-sm">
      <label
        className="flex min-h-10 cursor-pointer items-center gap-3 text-sm font-black text-slate-800"
        htmlFor={gridId}
      >
        <input
          checked={symmetrograph.enabled}
          className="size-4 accent-[#1768a6]"
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
        className="w-full accent-[#1768a6] disabled:cursor-not-allowed disabled:opacity-50"
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
  activeTool = "MOVE",
  annotations = [],
  imageUrl,
  inspection = false,
  onAnnotationsChange,
  onReferenceLinesChange,
  onSelectedAnnotationChange,
  onViewportChange,
  referenceLines,
  selectedAnnotationId,
  symmetrograph,
  title,
  viewportState,
}: {
  activeTool?: PosturalEditorTool;
  annotations?: readonly PosturalAnnotationLayer[];
  imageUrl: string;
  inspection?: boolean;
  onAnnotationsChange?: (
    value: readonly PosturalAnnotationLayer[],
  ) => void;
  onReferenceLinesChange?: (value: PosturalReferenceLines) => void;
  onSelectedAnnotationChange?: (id?: string) => void;
  onViewportChange?: (value: PosturalViewportState) => void;
  referenceLines?: PosturalReferenceLines;
  selectedAnnotationId?: string;
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
      if (activeTool !== "MOVE") {
        dragStart.current = undefined;
        return;
      }

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

    if (dragStart.current?.pointerId === event.pointerId) {
      const deltaX =
        event.clientX - dragStart.current.pointer.x;
      const deltaY =
        event.clientY - dragStart.current.pointer.y;

      if (effectiveZoom > fitZoom) {
        updateViewport({
          zoomPercent: effectiveZoom,
          fitMode: false,
          pan: clampPan({
            x: dragStart.current.pan.x + deltaX,
            y: dragStart.current.pan.y + deltaY,
          }),
        });
      }
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
    <div className="space-y-4">
      <div
        aria-label={`Visualizador da ${title.toLocaleLowerCase("pt-BR")}`}
        className={[
          "relative mx-auto w-full touch-none select-none overflow-hidden rounded-2xl border border-blue-200 bg-slate-950 shadow-lg ring-1 ring-blue-100/70",
          inspection
            ? "h-[min(60vh,700px)] max-w-[1100px]"
            : "h-[clamp(360px,68vh,660px)] max-w-[420px]",
          activeTool === "MOVE"
            ? "cursor-grab active:cursor-grabbing"
            : activeTool === "SELECT"
              ? "cursor-default"
              : "cursor-crosshair",
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
          </div>
        </div>

        {symmetrograph.enabled ? (
          <>
            <SymmetrographOverlay
              opacity={symmetrograph.opacity}
            />


          </>
        ) : null}

        {referenceLines && onReferenceLinesChange ? (
          <ReferenceLinesOverlay
            lines={referenceLines}
            onChange={onReferenceLinesChange}
          />
        ) : null}

        {onAnnotationsChange && onSelectedAnnotationChange ? (
          <>
            <ArrowAnnotationsOverlay
              activeTool={activeTool}
              annotations={annotations}
              onChange={onAnnotationsChange}
              onSelect={onSelectedAnnotationChange}
              selectedId={selectedAnnotationId}
            />
            <CircleAnnotationsOverlay
              activeTool={activeTool}
              annotations={annotations}
              onChange={onAnnotationsChange}
              onSelect={onSelectedAnnotationChange}
              selectedId={selectedAnnotationId}
            />
            <TextAnnotationsOverlay
              activeTool={activeTool}
              annotations={annotations}
              onChange={onAnnotationsChange}
              onSelect={onSelectedAnnotationChange}
              selectedId={selectedAnnotationId}
            />
            <FreehandAnnotationsOverlay
              activeTool={activeTool}
              annotations={annotations}
              onChange={onAnnotationsChange}
              onSelect={onSelectedAnnotationChange}
              selectedId={selectedAnnotationId}
            />
          </>
        ) : null}

      </div>

      <div
        aria-label="Controles de zoom e movimentação"
        className="mx-auto flex w-full max-w-[620px] flex-wrap items-center justify-center gap-2 rounded-2xl border border-blue-100 bg-white p-3 shadow-sm"
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
          className="min-w-16 rounded-lg bg-blue-50 px-2 py-1.5 text-center text-xs font-black text-blue-800"
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
          className="border border-slate-300 bg-white px-3 font-black text-slate-700 shadow-sm hover:bg-slate-50"
          onClick={fitToViewport}
          size="small"
          type="button"
          variant="outline"
        >
          Ajustar à tela
        </Button>

        <Button
          className="border border-slate-300 bg-white px-3 font-black text-slate-700 shadow-sm hover:bg-slate-50"
          onClick={showAtOriginalSize}
          size="small"
          type="button"
          variant="outline"
        >
          Visualização 100%
        </Button>

        <Button
          className="border border-slate-300 bg-white px-3 font-black text-slate-700 shadow-sm hover:bg-slate-50"
          onClick={() =>
            updateViewport({
              ...sourceState,
              zoomPercent: effectiveZoom,
              pan: { x: 0, y: 0 },
            })
          }
          size="small"
          type="button"
          variant="outline"
        >
          Centralizar
        </Button>
      </div>
    </div>
  );
}

export function PosturalImageViewer({
  annotations,
  assessmentId,
  gridEnabled,
  gridOpacity,
  image,
  imageUrl,
  onAnnotationsChange,
  onChange,
  onGridChange,
  onReferenceLinesChange,
  onRemove,
  onSelectedAnnotationChange,
  patientId,
  readOnly = false,
  referenceLines,
  selectedAnnotationId,
  title,
  viewType,
}: {
  annotations: readonly PosturalAnnotationLayer[];
  assessmentId?: string;
  patientId: string;
  viewType: PosturalViewKey;
  image?: PosturalViewImage;
  imageUrl?: string;
  gridEnabled: boolean;
  gridOpacity: number;
  readOnly?: boolean;
  referenceLines: PosturalReferenceLines;
  selectedAnnotationId?: string;
  title: string;
  onAnnotationsChange: (
    annotations: readonly PosturalAnnotationLayer[],
  ) => void;
  onChange: (image: PosturalViewImage) => void;
  onRemove: () => void;
  onGridChange: (
    symmetrograph: PosturalSymmetrograph,
  ) => void;
  onReferenceLinesChange: (
    referenceLines: PosturalReferenceLines,
  ) => void;
  onSelectedAnnotationChange: (id?: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [importing, setImporting] = useState(false);
  const [activeTool, setActiveTool] =
    useState<PosturalEditorTool>("MOVE");
  const resolvedImageUrl = imageUrl ?? image?.dataUrl;
  const inputId = `postural-image-${viewType.toLocaleLowerCase("en-US")}`;
  const symmetrograph = {
    enabled: gridEnabled,
    opacity: Math.min(1, Math.max(0.1, gridOpacity)),
  };

  async function importImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!isPosturalImageMimeType(file.type)) {
      setError("Use uma imagem JPEG, PNG ou WebP.");
      return;
    }
    if (file.size <= 0) {
      setError("A imagem selecionada está vazia.");
      return;
    }
    if (file.size > POSTURAL_IMAGE_MAX_SIZE_BYTES) {
      setError("A imagem excede o limite de 5 MB.");
      return;
    }
    if (!isValidPosturalImageFile(file)) {
      setError("A imagem selecionada é inválida.");
      return;
    }

    setImporting(true);
    setError(undefined);
    try {
      const dataUrl = await readImage(file);
      onChange({
        dataUrl,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
      });
    } catch {
      setError("Não foi possível importar a imagem.");
    } finally {
      setImporting(false);
    }
  }

  function toggleReferenceGroup(
    group: "horizontal" | "vertical",
  ) {
    const currentGroup = referenceLines[group];
    const shouldShow = currentGroup.some(
      (line) => line.visible === false,
    );

    const nextGroup = currentGroup.map((line) => ({
      ...line,
      visible: shouldShow,
    })) as [
      PosturalReferenceLine,
      PosturalReferenceLine,
    ];

    onReferenceLinesChange({
      ...referenceLines,
      enabled: true,
      [group]: nextGroup,
    });

    setActiveTool(
      group === "horizontal"
        ? "HORIZONTAL_LINES"
        : "VERTICAL_LINES",
    );
  }

  return (
    <section
      className="space-y-4"
      data-assessment-id={assessmentId}
      data-patient-id={patientId}
      data-view-type={viewType}
    >
      <input
        accept={POSTURAL_IMAGE_MIME_TYPES.join(",")}
        className="sr-only"
        id={inputId}
        disabled={readOnly || importing}
        onChange={importImage}
        ref={inputRef}
        type="file"
      />

      <div className="mx-auto w-full max-w-[620px] rounded-2xl border border-blue-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
              Editor postural
            </p>
            <p className="mt-0.5 max-w-[220px] text-[11px] font-semibold leading-4 text-slate-500">
              Selecione uma ferramenta para analisar e marcar a imagem.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-blue-50 px-2 py-1 text-[9px] font-black uppercase tracking-wide text-blue-700">
            Ferramentas
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-2 2xl:grid-cols-3">
          <button
            className={`flex min-h-11 items-center justify-center rounded-xl border px-2 text-center text-xs font-black leading-4 transition ${
              activeTool === "SELECT"
                ? "border-blue-500 bg-blue-600 text-white"
                : "border-blue-100 bg-blue-50/50 text-blue-800 hover:bg-blue-100"
            }`}
            onClick={() => setActiveTool("SELECT")}
            type="button"
          >
            Selecionar
          </button>

          <button
            className={`flex min-h-11 items-center justify-center rounded-xl border px-2 text-center text-xs font-black leading-4 transition ${
              activeTool === "MOVE"
                ? "border-blue-500 bg-blue-600 text-white"
                : "border-blue-100 bg-blue-50/50 text-blue-800 hover:bg-blue-100"
            }`}
            onClick={() => setActiveTool("MOVE")}
            type="button"
          >
            Mover imagem
          </button>

          <button
            className={`flex min-h-11 items-center justify-center rounded-xl border px-2 text-center text-xs font-black leading-4 transition ${
              symmetrograph.enabled
                ? "border-blue-500 bg-blue-600 text-white"
                : "border-blue-100 bg-blue-50/50 text-blue-800 hover:bg-blue-100"
            }`}
            onClick={() =>
              onGridChange({
                ...symmetrograph,
                enabled: !symmetrograph.enabled,
              })
            }
            type="button"
          >
            Simetrógrafo
          </button>

          <button
            className={`flex min-h-11 items-center justify-center rounded-xl border px-2 text-center text-xs font-black leading-4 transition ${
              activeTool === "HORIZONTAL_LINES"
                ? "border-red-400 bg-red-50 text-red-700"
                : "border-blue-100 bg-blue-50/50 text-blue-800 hover:bg-blue-100"
            }`}
            onClick={() => toggleReferenceGroup("horizontal")}
            type="button"
          >
            2 Horizontais
          </button>

          <button
            className={`flex min-h-11 items-center justify-center rounded-xl border px-2 text-center text-xs font-black leading-4 transition ${
              activeTool === "VERTICAL_LINES"
                ? "border-red-400 bg-red-50 text-red-700"
                : "border-blue-100 bg-blue-50/50 text-blue-800 hover:bg-blue-100"
            }`}
            onClick={() => toggleReferenceGroup("vertical")}
            type="button"
          >
            2 Verticais
          </button>

          <button
            className={`flex min-h-11 items-center justify-center rounded-xl border px-2 text-center text-xs font-black leading-4 transition ${
              activeTool === "ARROW"
                ? "border-red-400 bg-red-50 text-red-700"
                : "border-blue-100 bg-blue-50/50 text-blue-800 hover:bg-blue-100"
            }`}
            onClick={() => {
              setActiveTool("ARROW");
              onSelectedAnnotationChange(undefined);
            }}
            type="button"
          >
            Seta
          </button>

          <button
            className={`flex min-h-11 items-center justify-center rounded-xl border px-2 text-center text-xs font-black leading-4 transition ${
              activeTool === "CIRCLE"
                ? "border-red-400 bg-red-50 text-red-700"
                : "border-blue-100 bg-blue-50/50 text-blue-800 hover:bg-blue-100"
            }`}
            onClick={() => {
              setActiveTool("CIRCLE");
              onSelectedAnnotationChange(undefined);
            }}
            type="button"
          >
            Círculo
          </button>

          <button
            className={`flex min-h-11 items-center justify-center rounded-xl border px-2 text-center text-xs font-black leading-4 transition ${
              activeTool === "TEXT"
                ? "border-red-400 bg-red-50 text-red-700"
                : "border-blue-100 bg-blue-50/50 text-blue-800 hover:bg-blue-100"
            }`}
            onClick={() => {
              setActiveTool("TEXT");
              onSelectedAnnotationChange(undefined);
            }}
            type="button"
          >
            Texto
          </button>

          <button
            className={`flex min-h-11 items-center justify-center rounded-xl border px-2 text-center text-xs font-black leading-4 transition ${
              activeTool === "FREEHAND"
                ? "border-red-400 bg-red-50 text-red-700"
                : "border-blue-100 bg-blue-50/50 text-blue-800 hover:bg-blue-100"
            }`}
            onClick={() => {
              setActiveTool("FREEHAND");
              onSelectedAnnotationChange(undefined);
            }}
            type="button"
          >
            Mão livre
          </button>
        </div>
      </div>

      {selectedAnnotationId ? (
        <div className="mx-auto flex w-full max-w-[620px] items-center justify-between gap-3 rounded-xl border border-orange-200 bg-orange-50 px-3 py-2">
          <div>
            <p className="text-xs font-black text-orange-900">
              Anotação selecionada
            </p>
            <p className="text-[11px] font-semibold text-orange-700">
              Arraste para mover ou use “Excluir” para remover esta anotação.
            </p>
          </div>

          <button
            className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-2 text-[11px] font-black text-red-700 transition hover:bg-red-50"
            onClick={() => {
              onAnnotationsChange(
                annotations.filter(
                  (annotation) =>
                    annotation.id !== selectedAnnotationId,
                ),
              );
              onSelectedAnnotationChange(undefined);
            }}
            type="button"
          >
            Excluir
          </button>
        </div>
      ) : null}

      <SymmetrographControls
        idPrefix={inputId}
        onChange={onGridChange}
        readOnly={readOnly}
        symmetrograph={symmetrograph}
      />

      {resolvedImageUrl ? (
        <PosturalImageInspectionViewer
          activeTool={activeTool}
          annotations={annotations}
          imageUrl={resolvedImageUrl}
          onAnnotationsChange={onAnnotationsChange}
          onReferenceLinesChange={onReferenceLinesChange}
          onSelectedAnnotationChange={onSelectedAnnotationChange}
          referenceLines={referenceLines}
          selectedAnnotationId={selectedAnnotationId}
          symmetrograph={symmetrograph}
          title={title}
        />
      ) : (
        <div className="mx-auto flex h-64 w-full max-w-[420px] items-center justify-center rounded-2xl border-2 border-dashed border-blue-200 bg-gradient-to-b from-blue-50/70 to-white p-6 text-center text-sm font-semibold leading-6 text-slate-500 shadow-sm">
          Nenhuma imagem importada para esta vista.
        </div>
      )}

      <div className="mx-auto flex w-full max-w-[620px] flex-wrap justify-center gap-2 rounded-2xl border border-blue-100 bg-blue-50/40 p-3">
        {!readOnly ? (
          <Button
            disabled={importing}
            loading={importing}
            onClick={() => inputRef.current?.click()}
            size="small"
            type="button"
            variant={resolvedImageUrl ? "outline" : "primary"}
          >
            {resolvedImageUrl
              ? "Alterar imagem"
              : importing
                ? "Importando..."
                : "Importar imagem"}
          </Button>
        ) : null}

        {resolvedImageUrl ? (
          <>
            {!readOnly ? (
              <Button
                disabled={importing}
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

      <fieldset
        className="rounded-2xl border border-blue-100 bg-slate-50/80 p-4"
        disabled
      >
        <legend className="px-1 text-sm font-black text-blue-800">
          Análise Assistida por IA
        </legend>
        <p className="text-sm font-semibold text-slate-500">
          Em desenvolvimento.
        </p>
      </fieldset>

    </section>
  );
}
