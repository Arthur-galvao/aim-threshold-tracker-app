import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BackendError, formatBackendError, type TranslateFn } from "../src/lib/backend-error.ts";

/** Dicionário de teste: só as chaves listadas existem; as demais voltam como a própria chave. */
function makeT(dict: Record<string, string>): TranslateFn {
  return (key, params) => {
    const template = dict[key];
    if (template === undefined) return key;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      params && name in params ? String(params[name]) : match
    );
  };
}

const t = makeT({
  "error.rawaccel_not_found": "RawAccel não encontrado.",
  "error.read_dir_failed": "Falha ao ler a pasta: {detail}",
  "error.invalid_base_sens": "Sensibilidade base deve estar entre {detail} cm/360",
});

describe("formatBackendError", () => {
  it("traduz código sem detalhe", () => {
    assert.equal(formatBackendError("rawaccel_not_found", t), "RawAccel não encontrado.");
  });

  it("passa o detalhe para o template", () => {
    assert.equal(
      formatBackendError("read_dir_failed|C:/stats: acesso negado", t),
      "Falha ao ler a pasta: C:/stats: acesso negado"
    );
  });

  it("usa detalhe com separador de faixa", () => {
    assert.equal(
      formatBackendError("invalid_base_sens|10-200", t),
      "Sensibilidade base deve estar entre 10-200 cm/360"
    );
  });

  it("sem chave, mostra o código", () => {
    assert.equal(formatBackendError("unknown_code", t), "unknown_code");
  });

  it("sem chave e com detalhe, mostra código e detalhe", () => {
    assert.equal(formatBackendError("unknown_code|C:/x", t), "unknown_code: C:/x");
  });

  it("aceita string, Error e BackendError", () => {
    assert.equal(formatBackendError(new Error("rawaccel_not_found"), t), "RawAccel não encontrado.");
    assert.equal(formatBackendError(new BackendError("rawaccel_not_found"), t), "RawAccel não encontrado.");
    assert.equal(formatBackendError({ message: "rawaccel_not_found" }, t), "RawAccel não encontrado.");
  });

  it("detalhe pode conter barras verticais", () => {
    assert.equal(formatBackendError("unknown_code|a|b", t), "unknown_code: a|b");
  });
});
