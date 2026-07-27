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
