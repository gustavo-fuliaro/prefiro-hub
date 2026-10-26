// Reexporta as regras de usuários compartilhadas com a Edge Function admin-usuarios (código puro, sem Deno).
export { PAPEIS, SENHA_MIN, problemaSenha, validarEmail, validarNome, type Papel } from "../../supabase/functions/_shared/usuarios";

export const PAPEL_ROTULO = {
  admin: "Admin",
  estrategista: "Estrategista",
  criador: "Criador",
  leitura: "Leitura",
} as const;

export const PAPEL_DESCRICAO = {
  admin: "Tudo, inclusive cadastrar e gerenciar a equipe.",
  estrategista: "Perfis, metas e tarefas, inclusive excluir tarefas.",
  criador: "Cria, move e edita tarefas e comenta.",
  leitura: "Só vê e comenta.",
} as const;

export type UsuarioLista = {
  user_id: string;
  nome: string;
  email: string | null;
  conta: string | null;
  conta_id: number;
  papel: keyof typeof PAPEL_ROTULO;
  super_admin: boolean;
  ativo: boolean;
  deve_trocar_senha: boolean;
  criado_em: string | null;
  ultimo_acesso: string | null;
};
