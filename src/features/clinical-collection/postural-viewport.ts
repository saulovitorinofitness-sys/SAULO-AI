export const POSTURAL_MAX_ZOOM_PERCENT = 500;
export const POSTURAL_MIN_VISIBLE_IMAGE_PX = 48;

export interface PosturalViewportPoint {
  readonly x: number;
  readonly y: number;
}

export interface PosturalViewportSize {
  readonly width: number;
  readonly height: number;
}

export function calculatePosturalFitZoom(
  image: PosturalViewportSize,
  viewport: PosturalViewportSize,
) {
  if (
    image.width <= 0 ||
    image.height <= 0 ||
    viewport.width <= 0 ||
    viewport.height <= 0
  ) {
    return 100;
  }

  return Math.max(
    1,
    Math.min(
      100,
      (viewport.width / image.width) * 100,
      (viewport.height / image.height) * 100,
    ),
  );
}

export function clampPosturalZoom(
  value: number,
  fitZoom: number,
) {
  if (!Number.isFinite(value)) return fitZoom;
  return Math.min(
    POSTURAL_MAX_ZOOM_PERCENT,
    Math.max(fitZoom, value),
  );
}

export function clampPosturalPan({
  image,
  pan,
  viewport,
  zoomPercent,
}: {
  readonly image: PosturalViewportSize;
  readonly pan: PosturalViewportPoint;
  readonly viewport: PosturalViewportSize;
  readonly zoomPercent: number;
}): PosturalViewportPoint {
  const scaledWidth = image.width * (zoomPercent / 100);
  const scaledHeight = image.height * (zoomPercent / 100);
  const maxX =
    scaledWidth <= viewport.width
      ? 0
      : Math.max(
          0,
          (scaledWidth + viewport.width) / 2 -
            POSTURAL_MIN_VISIBLE_IMAGE_PX,
        );
  const maxY =
    scaledHeight <= viewport.height
      ? 0
      : Math.max(
          0,
          (scaledHeight + viewport.height) / 2 -
            POSTURAL_MIN_VISIBLE_IMAGE_PX,
        );

  return {
    x: Math.min(maxX, Math.max(-maxX, pan.x)),
    y: Math.min(maxY, Math.max(-maxY, pan.y)),
  };
}
