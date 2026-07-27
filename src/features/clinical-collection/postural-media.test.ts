import assert from "node:assert/strict";
import test from "node:test";

import {
  isPosturalImageMimeType,
  isValidPosturalImageFile,
  POSTURAL_IMAGE_MAX_SIZE_BYTES,
} from "./postural-media";

test("aceita somente os formatos de imagem homologados", () => {
  assert.equal(isPosturalImageMimeType("image/jpeg"), true);
  assert.equal(isPosturalImageMimeType("image/png"), true);
  assert.equal(isPosturalImageMimeType("image/webp"), true);
  assert.equal(isPosturalImageMimeType("image/svg+xml"), false);
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
