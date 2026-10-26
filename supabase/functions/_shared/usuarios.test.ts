import { describe, expect, it } from "vitest";
import { gerarSenhaProvisoria, lerPedido, problemaSenha, protegeSuperAdmin, validarEmail, validarNome } from "./usuarios";

const ID = "00000000-0000-4000-8000-000000000001";

describe("validações", () => {
  it("normaliza nome e e-mail", () => {
    expect(validarNome("  Ana   Souza ")).toBe("Ana Souza");
    expect(validarNome("A")).toBeNull();
    expect(validarEmail(" Ana@Empresa.COM.br ")).toBe("ana@empresa.com.br");
    expect(validarEmail("ana@empresa")).toBeNull();
    expect(validarEmail("ana empresa@x.com")).toBeNull();
  });

  it("exige senha com 10+ caracteres, letras e números", () => {
    expect(problemaSenha("curta1")).toContain("10");
    expect(problemaSenha("somenteletras")).toContain("letras e números");
    expect(problemaSenha("1234567890")).toContain("letras e números");
    expect(problemaSenha("senhaboa123")).toBeNull();
    expect(problemaSenha("a1".repeat(40))).toContain("72");
  });
});

describe("gerarSenhaProvisoria", () => {
  it("gera 16 caracteres válidos e diferentes a cada chamada", () => {
    const a = gerarSenhaProvisoria();
    const b = gerarSenhaProvisoria();
    expect(a).toHaveLength(16);
    expect(a).not.toBe(b);
    expect(problemaSenha(a)).toBeNull();
    expect(/[#$%&*+\-=?@]/.test(a)).toBe(true);
    expect(/[0O1lI]/.test(a)).toBe(false);
  });
});

describe("lerPedido", () => {
  it("aceita um cadastro com senha gerada pelo sistema", () => {
    expect(lerPedido({ acao: "criar", nome: "Ana", email: "ana@x.com" })).toEqual({
      pedido: { acao: "criar", nome: "Ana", email: "ana@x.com", senha: null },
    });
  });

  it("valida a senha informada no cadastro", () => {
    expect(lerPedido({ acao: "criar", nome: "Ana", email: "ana@x.com", senha: "fraca" })).toHaveProperty("erro");
    expect(lerPedido({ acao: "criar", nome: "Ana", email: "ana@x.com", senha: "forte12345" })).toHaveProperty("pedido.senha", "forte12345");
  });

  it("recusa ids que não são UUID e ações desconhecidas", () => {
    expect(lerPedido({ acao: "excluir", user_id: "1 or 1=1" })).toEqual({ erro: "Usuário inválido." });
    expect(lerPedido({ acao: "status", user_id: ID })).toHaveProperty("erro");
    expect(lerPedido({ acao: "apagar_tudo" })).toEqual({ erro: "Ação desconhecida." });
    expect(lerPedido(null)).toEqual({ erro: "Ação desconhecida." });
  });

  it("lê bloqueio, edição e redefinição", () => {
    expect(lerPedido({ acao: "status", user_id: ID, ativo: false })).toEqual({ pedido: { acao: "status", user_id: ID, ativo: false } });
    expect(lerPedido({ acao: "editar", user_id: ID, nome: "Bia", email: "BIA@x.com" })).toEqual({
      pedido: { acao: "editar", user_id: ID, nome: "Bia", email: "bia@x.com" },
    });
    expect(lerPedido({ acao: "redefinir_senha", user_id: ID })).toEqual({ pedido: { acao: "redefinir_senha", user_id: ID } });
  });

  it("protege a conta principal de bloqueio, exclusão e redefinição", () => {
    expect(protegeSuperAdmin("excluir")).toBe(true);
    expect(protegeSuperAdmin("status")).toBe(true);
    expect(protegeSuperAdmin("redefinir_senha")).toBe(true);
    expect(protegeSuperAdmin("editar")).toBe(false);
  });
});
