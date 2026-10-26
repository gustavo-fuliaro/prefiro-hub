import { describe, expect, it } from "vitest";
import { diaSaoPaulo, erroDeCampo, idPostHub, interpretarBusinessDiscovery, mensagemErroMeta, urlBusinessDiscovery } from "./instagram";

const exemplo = {
  business_discovery: {
    id: "17841400000000001",
    username: "prefiroconsorcio",
    name: "Prefiro Consórcio",
    biography: "Consórcio sem enrolação",
    followers_count: 12345,
    follows_count: 321,
    media_count: 890,
    profile_picture_url: "https://cdn.example/foto.jpg",
    media: {
      data: [
        {
          id: "1",
          media_type: "VIDEO",
          media_product_type: "REELS",
          caption: "Reel",
          permalink: "https://instagram.com/reel/1",
          timestamp: "2026-10-20T15:00:00+0000",
          like_count: 120,
          comments_count: 8,
          view_count: 4321,
          media_url: "https://cdn.example/video.mp4",
          thumbnail_url: "https://cdn.example/capa.jpg",
        },
        {
          id: "2",
          media_type: "IMAGE",
          media_product_type: "FEED",
          timestamp: "2026-10-19T15:00:00+0000",
          comments_count: 3,
          media_url: "https://cdn.example/img.jpg",
        },
        { id: "3", media_type: "VIDEO", timestamp: "2026-10-18T15:00:00+0000" },
      ],
    },
  },
  id: "17841400000000099",
};

describe("interpretarBusinessDiscovery", () => {
  const p = interpretarBusinessDiscovery(exemplo);

  it("lê os números do perfil", () => {
    expect(p).toMatchObject({ username: "prefiroconsorcio", seguidores: 12345, seguindo: 321, total_posts: 890 });
  });

  it("usa a capa do vídeo e a imagem do post", () => {
    expect(p.posts[0].imagem_url).toBe("https://cdn.example/capa.jpg");
    expect(p.posts[1].imagem_url).toBe("https://cdn.example/img.jpg");
    expect(p.posts[2].imagem_url).toBeNull(); // vídeo sem capa não usa o .mp4
  });

  it("deixa curtidas ocultas como null, não zero", () => {
    expect(p.posts[1].likes).toBeNull();
    expect(p.posts[1].comentarios).toBe(3);
  });

  it("lê views dos Reels e deixa null onde a Meta não manda", () => {
    expect(p.posts[0].views).toBe(4321);
    expect(p.posts[1].views).toBeNull();
  });

  it("falha com resposta sem business_discovery", () => {
    expect(() => interpretarBusinessDiscovery({ id: "x" })).toThrow();
  });
});

describe("urlBusinessDiscovery", () => {
  it("monta a consulta com o @ e o limite", () => {
    const u = new URL(urlBusinessDiscovery({ versao: "v23.0", igUserId: "999", handle: "abc", token: "T", limiteMidias: 10 }));
    expect(u.pathname).toBe("/v23.0/999");
    expect(u.searchParams.get("fields")).toContain("business_discovery.username(abc)");
    expect(u.searchParams.get("fields")).toContain("media.limit(10)");
    expect(u.searchParams.get("access_token")).toBe("T");
  });

  it("pede view_count por padrão e permite tirar", () => {
    const com = new URL(urlBusinessDiscovery({ versao: "v23.0", igUserId: "1", handle: "a", token: "T" }));
    const sem = new URL(urlBusinessDiscovery({ versao: "v23.0", igUserId: "1", handle: "a", token: "T", comViews: false }));
    expect(com.searchParams.get("fields")).toContain("view_count");
    expect(sem.searchParams.get("fields")).not.toContain("view_count");
  });
});

describe("ids e erros de campo", () => {
  it("prefixa o id do post com o perfil", () => {
    expect(idPostHub(7, "1789")).toBe("7_1789");
  });
  it("reconhece erro de campo inexistente e ignora os outros", () => {
    expect(erroDeCampo({ error: { code: 100, message: "Tried accessing nonexisting field (view_count)" } })).toBe(true);
    expect(erroDeCampo({ error: { code: 190, message: "token" } })).toBe(false);
    expect(erroDeCampo({})).toBe(false);
  });
});

describe("mensagemErroMeta", () => {
  it.each([
    [{ error: { code: 190 } }, "Token da Meta inválido"],
    [{ error: { code: 4 } }, "Limite de chamadas"],
    [{ error: { code: 100, error_subcode: 2207013 } }, "não é conta Business"],
    [{ error: { code: 10 } }, "permissão"],
    [{}, "Erro HTTP 500"],
  ])("%j", (json, trecho) => {
    expect(mensagemErroMeta(json, 500)).toContain(trecho);
  });
});

describe("diaSaoPaulo", () => {
  it("usa o fuso de São Paulo", () => {
    expect(diaSaoPaulo(new Date("2026-10-23T02:30:00Z"))).toBe("2026-10-22");
    expect(diaSaoPaulo(new Date("2026-10-23T03:30:00Z"))).toBe("2026-10-23");
  });
});

describe("linhaPost e capas", () => {
  const post = { id: "99", tipo: "VIDEO", produto: "REELS", legenda: null, permalink: null, publicado_em: null, likes: 1, comentarios: 0, views: 10, imagem_url: null };

  it("sempre manda a capa explícita, preservando a já salva", async () => {
    const { linhaPost } = await import("./instagram");
    expect(linhaPost(4, post, null, "a/posts/99.jpg")).toMatchObject({ id: "4_99", thumb_path: "a/posts/99.jpg" });
    expect(linhaPost(4, post, "a/posts/99.jpg", null).thumb_path).toBe("a/posts/99.jpg");
    const vazia = linhaPost(4, post, null, null);
    expect("thumb_path" in vazia).toBe(true);
    expect(vazia.thumb_path).toBeNull();
  });

  it("monta o caminho da capa pelo id da Meta", async () => {
    const { caminhoCapa } = await import("./instagram");
    expect(caminhoCapa("prefiro", "1789")).toBe("prefiro/posts/1789.jpg");
  });

  it("aceita imagens do CDN mesmo sem tipo declarado", async () => {
    const { tipoImagem } = await import("./instagram");
    expect(tipoImagem("image/jpeg; charset=x", "https://x/a.jpg")).toBe("image/jpeg");
    expect(tipoImagem("application/octet-stream", "https://scontent.cdninstagram.com/v/t51.2885-15/abc.jpg?stp=1")).toBe("image/jpeg");
    expect(tipoImagem("application/octet-stream", "https://x/foto.heic")).toBeNull();
    expect(tipoImagem(null, "https://x/a.webp")).toBe("image/webp");
    expect(tipoImagem("video/mp4", "https://x/a.mp4")).toBeNull();
    expect(tipoImagem("text/html", "https://x/erro")).toBeNull();
  });
});

describe("capas de posts antigos", () => {
  it("pede só os campos de capa, com limite maior", async () => {
    const { urlCapasAntigas } = await import("./instagram");
    const f = new URL(urlCapasAntigas({ versao: "v23.0", igUserId: "1", handle: "abc", token: "T" })).searchParams.get("fields")!;
    expect(f).toContain("media.limit(80)");
    expect(f).toContain("thumbnail_url");
    expect(f).not.toContain("like_count");
  });

  it("usa a capa do vídeo e a imagem do post, ignorando vídeo sem capa", async () => {
    const { interpretarCapas } = await import("./instagram");
    const m = interpretarCapas({ business_discovery: { media: { data: [
      { id: "1", media_type: "VIDEO", thumbnail_url: "https://x/capa.jpg", media_url: "https://x/v.mp4" },
      { id: "2", media_type: "IMAGE", media_url: "https://x/img.jpg" },
      { id: "3", media_type: "VIDEO", media_url: "https://x/v2.mp4" },
    ] } } });
    expect([...m.entries()]).toEqual([["1", "https://x/capa.jpg"], ["2", "https://x/img.jpg"]]);
    expect(interpretarCapas({}).size).toBe(0);
  });
});
