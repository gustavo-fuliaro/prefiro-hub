import { describe, expect, it } from "vitest";
import { doPerfil, lerEscolha, perfilPadrao, relatorioDoEscopo, rotuloEscopo, type PerfilProprio } from "./perfis-proprios";

const perfis: PerfilProprio[] = [
  { id: 4, handle: "prefiroconsorcio", nome: null, foto_path: null },
  { id: 5, handle: "dancarlossilva", nome: null, foto_path: null },
];

describe("lerEscolha", () => {
  it("aceita só perfis próprios do ambiente", () => {
    expect(lerEscolha("5", perfis)).toBe(5);
    expect(lerEscolha("99", perfis)).toBeNull();
    expect(lerEscolha("abc", perfis)).toBeNull();
    expect(lerEscolha("todos", perfis)).toBeNull();
    expect(lerEscolha(undefined, perfis)).toBeNull();
    expect(lerEscolha("4.5", perfis)).toBeNull();
  });
});

describe("doPerfil", () => {
  const itens = [{ id: 1, perfil_id: 4 }, { id: 2, perfil_id: 5 }, { id: 3, perfil_id: null }];
  it("grupo mostra tudo, inclusive sem perfil", () => {
    expect(doPerfil(itens, null).map((i) => i.id)).toEqual([1, 2, 3]);
  });
  it("individual mostra só o perfil", () => {
    expect(doPerfil(itens, 5).map((i) => i.id)).toEqual([2]);
  });
});

describe("rótulos e padrões", () => {
  it("rotuloEscopo", () => {
    expect(rotuloEscopo(perfis, null)).toBe("Todos os perfis");
    expect(rotuloEscopo(perfis, 4)).toBe("@prefiroconsorcio");
  });
  it("perfilPadrao", () => {
    expect(perfilPadrao(perfis, 5)).toBe(5);
    expect(perfilPadrao(perfis, null)).toBeNull();
    expect(perfilPadrao([perfis[0]], null)).toBe(4);
  });
  it("relatorioDoEscopo", () => {
    expect(relatorioDoEscopo(null, perfis, null)).toBe(true);
    expect(relatorioDoEscopo("dancarlossilva", perfis, null)).toBe(false);
    expect(relatorioDoEscopo("dancarlossilva", perfis, 5)).toBe(true);
    expect(relatorioDoEscopo(null, perfis, 5)).toBe(false);
  });
});
