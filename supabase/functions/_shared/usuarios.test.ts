import { describe, expect, it } from "vitest";
import { gerarSenhaProvisoria, lerPedido, podeAgirSobre, podeCriar, podeGerirUsuarios, problemaSenha, protegeSuperAdmin, validarEmail, validarNome } from "./usuarios";

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
      pedido: { acao: "criar", nome: "Ana", email: "ana@x.com", senha: null, papel: "admin", destino: "novo_ambiente" },
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

describe("equipes no mesmo ambiente", () => {
  const principal = { user_id: "p", conta_id: 1, super_admin: true, papel: "admin", ativo: true };
  const adminB = { user_id: "b", conta_id: 2, super_admin: false, papel: "admin", ativo: true };
  const criadorB = { ...adminB, user_id: "c", papel: "criador" };

  it("lê papel e destino do cadastro", () => {
    expect(lerPedido({ acao: "criar", nome: "Ana", email: "ana@x.com", destino: "equipe" })).toHaveProperty("pedido.papel", "criador");
    expect(lerPedido({ acao: "criar", nome: "Ana", email: "ana@x.com", destino: "equipe", papel: "estrategista" })).toHaveProperty("pedido.papel", "estrategista");
    expect(lerPedido({ acao: "criar", nome: "Ana", email: "ana@x.com", papel: "dono" })).toEqual({ erro: "Escolha um papel válido." });
    expect(lerPedido({ acao: "papel", user_id: ID, papel: "leitura" })).toEqual({ pedido: { acao: "papel", user_id: ID, papel: "leitura" } });
    expect(lerPedido({ acao: "papel", user_id: ID, papel: "super" })).toHaveProperty("erro");
  });

  it("só admin ativo ou conta principal gerencia usuários", () => {
    expect(podeGerirUsuarios(principal)).toBe(true);
    expect(podeGerirUsuarios(adminB)).toBe(true);
    expect(podeGerirUsuarios(criadorB)).toBe(false);
    expect(podeGerirUsuarios({ ...adminB, ativo: false })).toBe(false);
    expect(podeGerirUsuarios(null)).toBe(false);
  });

  it("admin de ambiente só age no próprio ambiente e nunca na conta principal", () => {
    expect(podeAgirSobre(adminB, { user_id: "x", conta_id: 2, super_admin: false })).toBe(true);
    expect(podeAgirSobre(adminB, { user_id: "x", conta_id: 1, super_admin: false })).toBe(false);
    expect(podeAgirSobre(adminB, { user_id: "p", conta_id: 2, super_admin: true })).toBe(false);
    expect(podeAgirSobre(principal, { user_id: "x", conta_id: 2, super_admin: false })).toBe(true);
  });

  it("ambiente novo é exclusivo da conta principal", () => {
    expect(podeCriar(principal, "novo_ambiente")).toBe(true);
    expect(podeCriar(adminB, "novo_ambiente")).toBe(false);
    expect(podeCriar(adminB, "equipe")).toBe(true);
    expect(podeCriar(criadorB, "equipe")).toBe(false);
  });
});
