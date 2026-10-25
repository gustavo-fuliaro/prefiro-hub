import { describe, expect, it } from "vitest";
import { fontePadrao, isGrupo, normalizarHandle } from "./perfis";

describe("normalizarHandle", () => {
  it.each([
    ["prefiroconsorcio", "prefiroconsorcio"],
    ["@DanCarlosSilva", "dancarlossilva"],
    ["  @gustavo_fuliaro  ", "gustavo_fuliaro"],
    ["https://www.instagram.com/prefiroconsorcio/", "prefiroconsorcio"],
    ["instagram.com/prefiroconsorcio?igsh=abc", "prefiroconsorcio"],
    ["http://instagram.com/a.b_c#x", "a.b_c"],
  ])("%s → %s", (entrada, esperado) => {
    expect(normalizarHandle(entrada)).toBe(esperado);
  });

  it.each(["", "   ", "@", "nome com espaço", "ç", ".comeca", "termina.", "dois..pontos", "a".repeat(31)])(
    "rejeita %j",
    (entrada) => {
      expect(normalizarHandle(entrada)).toBeNull();
    },
  );
});

describe("grupos e fontes", () => {
  it("reconhece grupos válidos", () => {
    expect(isGrupo("concorrente")).toBe(true);
    expect(isGrupo("outro")).toBe(false);
    expect(isGrupo("toString")).toBe(false);
  });

  it("sugere a fonte pelo grupo", () => {
    expect(fontePadrao("proprio")).toBe("graph_api");
    expect(fontePadrao("concorrente")).toBe("business_discovery");
  });
});
