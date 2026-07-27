-- SV-NUT-001
-- A sequência do PostgreSQL é concorrente, não transacional e não reutiliza
-- valores consumidos por transações posteriormente revertidas.
CREATE SEQUENCE "Patient_clinicalCode_seq"
  AS BIGINT
  MINVALUE 1
  MAXVALUE 999999
  START WITH 1
  INCREMENT BY 1
  NO CYCLE;

ALTER TABLE "Patient"
  ADD COLUMN "clinicalCode" VARCHAR(8),
  ADD COLUMN "observations" TEXT;

-- Pacientes anteriores recebem códigos previsíveis sem alterar nenhum outro
-- dado. A ordenação por criação e UUID resolve empates de forma determinística.
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "Patient" WHERE "clinicalCode" IS NULL) > 999999 THEN
    RAISE EXCEPTION
      'Há mais pacientes sem código do que a faixa SV000001-SV999999 suporta.';
  END IF;
END
$$;

WITH "orderedPatients" AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (ORDER BY "createdAt" ASC, "id" ASC) AS "sequenceNumber"
  FROM "Patient"
  WHERE "clinicalCode" IS NULL
)
UPDATE "Patient" AS "patient"
SET "clinicalCode" = 'SV' || LPAD(
  "orderedPatients"."sequenceNumber"::TEXT,
  6,
  '0'
)
FROM "orderedPatients"
WHERE "patient"."id" = "orderedPatients"."id";

DO $$
DECLARE
  "highestClinicalCode" BIGINT;
BEGIN
  SELECT COALESCE(
    MAX(SUBSTRING("clinicalCode" FROM 3)::BIGINT),
    0
  )
  INTO "highestClinicalCode"
  FROM "Patient"
  WHERE "clinicalCode" ~ '^SV[0-9]{6}$';

  IF "highestClinicalCode" >= 999999 THEN
    RAISE EXCEPTION
      'A sequência de códigos clínicos SV atingiu o limite de SV999999.';
  ELSIF "highestClinicalCode" = 0 THEN
    PERFORM SETVAL('"Patient_clinicalCode_seq"', 1, FALSE);
  ELSE
    PERFORM SETVAL(
      '"Patient_clinicalCode_seq"',
      "highestClinicalCode" + 1,
      FALSE
    );
  END IF;
END
$$;

ALTER TABLE "Patient"
  ALTER COLUMN "clinicalCode" SET NOT NULL,
  ADD CONSTRAINT "Patient_clinicalCode_format_check"
    CHECK ("clinicalCode" ~ '^SV[0-9]{6}$');

CREATE UNIQUE INDEX "Patient_clinicalCode_key"
  ON "Patient"("clinicalCode");

CREATE FUNCTION "prevent_patient_clinical_code_update"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."clinicalCode" IS DISTINCT FROM OLD."clinicalCode" THEN
    RAISE EXCEPTION 'O código clínico SV é imutável.';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "Patient_clinicalCode_immutable"
BEFORE UPDATE OF "clinicalCode" ON "Patient"
FOR EACH ROW
EXECUTE FUNCTION "prevent_patient_clinical_code_update"();
