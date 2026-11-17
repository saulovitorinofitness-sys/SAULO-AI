import type {
  PosturalSymmetrograph,
  PosturalViewImage,
} from "./contracts";

export const POSTURAL_IMAGE_MAX_SIZE_BYTES = 5_000_000;
export const POSTURAL_IMAGE_MAX_DATA_URL_LENGTH = 6_666_700;
export const POSTURAL_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const satisfies readonly PosturalViewImage["mimeType"][];

export const DEFAULT_POSTURAL_SYMMETROGRAPH: PosturalSymmetrograph =
  {
    enabled: false,
    opacity: 0.45,
  };

export function isPosturalImageMimeType(
  value: unknown,
): value is PosturalViewImage["mimeType"] {
  return POSTURAL_IMAGE_MIME_TYPES.includes(
    value as PosturalViewImage["mimeType"],
  );
}

export function isValidPosturalImageFile({
  size,
  type,
}: {
  readonly size: number;
  readonly type: string;
}) {
  return (
    isPosturalImageMimeType(type) &&
    size > 0 &&
    size <= POSTURAL_IMAGE_MAX_SIZE_BYTES
  );
}

export function isValidPosturalViewImage(
  value: unknown,
): value is PosturalViewImage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const image = value as Record<string, unknown>;
  if (
    typeof image.dataUrl !== "string" ||
    image.dataUrl.length > POSTURAL_IMAGE_MAX_DATA_URL_LENGTH ||
    typeof image.fileName !== "string" ||
    image.fileName.trim().length === 0 ||
    image.fileName.length > 255 ||
    !isPosturalImageMimeType(image.mimeType) ||
    typeof image.sizeBytes !== "number" ||
    !Number.isInteger(image.sizeBytes) ||
    !isValidPosturalImageFile({
      size: image.sizeBytes,
      type: image.mimeType,
    }) ||
    typeof image.uploadedAt !== "string" ||
    Number.isNaN(Date.parse(image.uploadedAt))
  ) {
    return false;
  }

  const prefix = `data:${image.mimeType};base64,`;
  if (!image.dataUrl.startsWith(prefix)) return false;

  const encoded = image.dataUrl.slice(prefix.length);
  if (!encoded || encoded.length % 4 !== 0) return false;
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) return false;

  const padding = encoded.endsWith("==")
    ? 2
    : encoded.endsWith("=")
      ? 1
      : 0;
  const decodedSize = (encoded.length / 4) * 3 - padding;

  return decodedSize === image.sizeBytes;
}
