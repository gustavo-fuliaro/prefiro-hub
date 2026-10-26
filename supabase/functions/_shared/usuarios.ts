// Regras da gestão de usuários (sem rede e sem Deno): valida pedidos e gera senhas provisórias.
// Usada pela Edge Function admin-usuarios e testada com Vitest.

export const SENHA_MIN = 10;

export type Pedido =
  | { acao: "listar" }
  | { acao: "criar"; nome: string; email: string; senha: string | null }
  | { acao: "editar"; user_id: string; nome: string; email: string }
  | { acao: "status"; user_id: string; ativo: boolean }
  | { acao: "redefinir_senha"; user_id: string }
  | { acao: "excluir"; user_id: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validarNome(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
  return s.length >= 2 && s.length <= 120 ? s : null;
}

export function validarEmail(v: unknown): string | null {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) ? s : null;
}

// Senha forte o bastante para um painel interno: 10+ caracteres, com letra e número.
export function problemaSenha(v: unknown): string | null {
  if (typeof v !== "string" || v.length < SENHA_MIN) return `A senha precisa ter pelo menos ${SENHA_MIN} caracteres.`;
  if (v.length > 72) return "A senha pode ter no máximo 72 caracteres.";
  if (!/[a-zA-Z]/.test(v) || !/[0-9]/.test(v)) return "A senha precisa ter letras e números.";
  return null;
}

// Sem caracteres que se confundem (0/O, 1/l/I), para ditar ou copiar sem erro.
const LETRAS = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
const NUMEROS = "23456789";
const SIMBOLOS = "#$%&*+-=?@";

function sortear(alfabeto: string, rnd: Uint32Array, i: number): string {
  return alfabeto[rnd[i] % alfabeto.length];
}

// Senha provisória com 16 caracteres, gerada com o gerador criptográfico do ambiente.
export function gerarSenhaProvisoria(tamanho = 16): string {
  const todos = LETRAS + NUMEROS + SIMBOLOS;
  const rnd = new Uint32Array(tamanho + 3);
  crypto.getRandomValues(rnd);
  const chars = [sortear(LETRAS, rnd, 0), sortear(NUMEROS, rnd, 1), sortear(SIMBOLOS, rnd, 2)];
  for (let i = 3; i < tamanho; i++) chars.push(sortear(todos, rnd, i));
  // Embaralha (Fisher-Yates) para a letra, o número e o símbolo garantidos não ficarem sempre no início.
  const ord = new Uint32Array(tamanho);
  crypto.getRandomValues(ord);
  for (let i = chars.length - 1; i > 0; i--) {
    const j = ord[i] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

export function lerPedido(corpo: unknown): { pedido: Pedido } | { erro: string } {
  const c = (corpo && typeof corpo === "object" ? corpo : {}) as Record<string, unknown>;
  const userId = typeof c.user_id === "string" && UUID.test(c.user_id) ? c.user_id : null;

  switch (c.acao) {
    case "listar":
      return { pedido: { acao: "listar" } };
    case "criar": {
      const nome = validarNome(c.nome);
      if (!nome) return { erro: "Informe o nome (2 a 120 caracteres)." };
      const email = validarEmail(c.email);
      if (!email) return { erro: "Informe um e-mail válido." };
      const senha = typeof c.senha === "string" && c.senha.length > 0 ? c.senha : null;
      if (senha !== null) {
        const p = problemaSenha(senha);
        if (p) return { erro: p };
      }
      return { pedido: { acao: "criar", nome, email, senha } };
    }
    case "editar": {
      if (!userId) return { erro: "Usuário inválido." };
      const nome = validarNome(c.nome);
      if (!nome) return { erro: "Informe o nome (2 a 120 caracteres)." };
      const email = validarEmail(c.email);
      if (!email) return { erro: "Informe um e-mail válido." };
      return { pedido: { acao: "editar", user_id: userId, nome, email } };
    }
    case "status":
      if (!userId) return { erro: "Usuário inválido." };
      if (typeof c.ativo !== "boolean") return { erro: "Informe se o acesso fica liberado ou bloqueado." };
      return { pedido: { acao: "status", user_id: userId, ativo: c.ativo } };
    case "redefinir_senha":
      if (!userId) return { erro: "Usuário inválido." };
      return { pedido: { acao: "redefinir_senha", user_id: userId } };
    case "excluir":
      if (!userId) return { erro: "Usuário inválido." };
      return { pedido: { acao: "excluir", user_id: userId } };
    default:
      return { erro: "Ação desconhecida." };
  }
}

// Ações que não podem atingir a conta administradora principal.
export function protegeSuperAdmin(acao: Pedido["acao"]): boolean {
  return acao === "status" || acao === "excluir" || acao === "redefinir_senha";
}
