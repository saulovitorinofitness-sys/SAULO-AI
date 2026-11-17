import assert from "node:assert/strict";
import test from "node:test";

import {
  isPosturalImageMimeType,
  isValidPosturalImageFile,
  isValidPosturalViewImage,
  POSTURAL_IMAGE_MAX_SIZE_BYTES,
} from "./postural-media";

test("aceita somente os formatos de imagem homologados", () => {
  assert.equal(isPosturalImageMimeType("image/jpeg"), true);
  assert.equal(isPosturalImageMimeType("image/png"), true);
  assert.equal(isPosturalImageMimeType("image/webp"), true);
  assert.equal(isPosturalImageMimeType("image/svg+xml"), false);
});

test("valida a coerência da imagem persistida", () => {
  const valid = {
    dataUrl: "data:image/png;base64,YQ==",
    fileName: "anterior.png",
    mimeType: "image/png",
    sizeBytes: 1,
    uploadedAt: "2026-07-31T12:00:00.000Z",
  };

  assert.equal(isValidPosturalViewImage(valid), true);
  assert.equal(
    isValidPosturalViewImage({ ...valid, mimeType: "image/jpeg" }),
    false,
  );
  assert.equal(isValidPosturalViewImage({ ...valid, sizeBytes: 2 }), false);
  assert.equal(
    isValidPosturalViewImage({ ...valid, dataUrl: "data:image/png;base64,YQ=" }),
    false,
  );
});

test("bloqueia arquivo vazio ou acima de 5 MB", () => {
  assert.equal(
    isValidPosturalImageFile({
      size: POSTURAL_IMAGE_MAX_SIZE_BYTES,
      type: "image/jpeg",
    }),
    true,
  );
  assert.equal(
    isValidPosturalImageFile({
      size: 0,
      type: "image/jpeg",
    }),
    false,
  );
  assert.equal(
    isValidPosturalImageFile({
      size: POSTURAL_IMAGE_MAX_SIZE_BYTES + 1,
      type: "image/jpeg",
    }),
    false,
  );
});
