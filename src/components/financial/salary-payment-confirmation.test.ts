import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("./salary-payment-confirmation.tsx", import.meta.url), "utf8");

test("confirmação mantém líquido somente leitura e não oferece pagamento parcial", () => {
  assert.match(source, /Líquido exato a pagar/);
  assert.match(source, /Valor integral<input[^>]+readOnly/);
  assert.match(source, /paidAmount: candidate\.statement\.totals\.net/);
  assert.doesNotMatch(source, /partialAmount|installment|name="partial/i);
});

test("pagamento bancário aceita referência e comprovante opcionais e limita arquivo enviado", () => {
  assert.match(source, /MAX_PROOF_BYTES = 10 \* 1024 \* 1024/);
  assert.match(source, /application\/pdf/);
  assert.match(source, /image\/jpeg/);
  assert.match(source, /image\/png/);
  assert.match(source, /Referência da transação \(opcional\)/);
  assert.match(source, /Comprovante privado \(opcional\)/);
  assert.match(source, /acesso somente pela rota privada/);
});

test("seleciona forma e conta compatível e informa campos obrigatórios", () => {
  assert.match(source, /financialAccountId/);
  assert.match(source, /paymentMethodId/);
  assert.match(source, /Selecione a forma de pagamento/);
  assert.match(source, /Selecione a conta que receberá a liquidação/);
  assert.match(source, /Informe a data do pagamento/);
});

test("dinheiro informa assinatura manual e envio exige confirmação consciente", () => {
  assert.match(source, /Após a emissão, o recibo ficará aguardando assinatura manual do funcionário/);
  assert.match(source, /selectedAccountCompatible && confirmed/);
  assert.match(source, /Confirmo conscientemente/);
  assert.match(source, /state === "submitting"/);
});

test("tabelas exibem somente descrições profissionais sem rolagem horizontal", () => {
  assert.match(source, /salaryLineDescription\(item\)/);
  assert.match(source, />Descrição<\/th>/);
  assert.doesNotMatch(source, />Código<\/th>/);
  assert.doesNotMatch(source, /overflow-x-auto|min-w-\[30rem\]/);
  assert.match(source, /if \(!items\.length\) return null/);
});

test("sucesso abre exatamente o recibo retornado, sem gerar conteúdo no navegador", () => {
  assert.match(source, /payload\.receiptId/);
  assert.match(source, /window\.location\.assign\(`\/gestao\/documentos\/recibos-pagamento\//);
  assert.doesNotMatch(source, /document\.write|URL\.createObjectURL|data:application\/pdf/);
});
