// Reexporta as regras de usuários compartilhadas com a Edge Function admin-usuarios (código puro, sem Deno).
export { SENHA_MIN, problemaSenha, validarEmail, validarNome } from "../../supabase/functions/_shared/usuarios";

export type UsuarioLista = {
  user_id: string;
  nome: string;
  email: string | null;
  conta: string | null;
  super_admin: boolean;
  ativo: boolean;
  deve_trocar_senha: boolean;
  criado_em: string | null;
  ultimo_acesso: string | null;
};
