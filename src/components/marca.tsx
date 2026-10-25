// Elementos da identidade Prefiro Consórcio. O logotipo vem do manual em vetor (public/marca)
// e nunca é redesenhado, recolorido ou distorcido aqui.

// Fundo claro: versão positiva, que troca para a negativa no modo escuro. Fundo escuro: `negativo`.
export function Logotipo({ negativo = false, largura = 148, className = "" }: { negativo?: boolean; largura?: number; className?: string }) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={negativo ? "/marca/prefiro-logo-negativo.svg" : "/marca/prefiro-logo.svg"}
      alt="Prefiro Consórcio"
      width={largura}
      height={Math.round((largura * 133) / 340)}
      className={className}
    />
  );
  if (negativo) return img;
  return (
    <picture>
      <source srcSet="/marca/prefiro-logo-negativo.svg" media="(prefers-color-scheme: dark)" />
      {img}
    </picture>
  );
}

// Balão de fala do símbolo (forma oficial, página 5 do manual). Usado nos padrões gráficos.
export function Balao({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="304 213 535 650" aria-hidden className={className} style={style}>
      <path
        transform="matrix(1,0,0,-1,784.1129,320.9254)"
        fill="currentColor"
        d="M0 0-10.36 13.032C-14.625 18.102-19.03 23.073-23.657 27.809-72.051 77.359-138.762 107.964-212.571 107.969-286.402 107.964-353.102 77.359-401.49 27.809-449.862-21.759-479.742-90.091-479.742-165.718-479.742-241.331-449.862-309.664-401.49-359.238-382.503-378.69-360.65-395.166-336.69-408.07L-330.126-411.511C-294.656-429.351-254.789-439.398-212.571-439.398-147.669-439.387-103.6-453.269-73.872-473.595-44.4-493.665-29.969-519.876-23.574-541.563-9.903-515.718 1.56-486.857 10.943-456.807 16.364-439.472 21.112-421.771 25.277-404.096L31.181-377.169C34.948-358.812 38.14-340.675 40.794-323.218 53.764-237.933 54.583-168.64 54.595-165.735V-165.718C54.583-103.367 34.236-46.007 0 0"
      />
    </svg>
  );
}

// Estrela do símbolo: "a escolha que realiza". No app, marca quem lidera (melhor post, maior ganho).
export function Estrela({ className = "size-4", titulo }: { className?: string; titulo?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role={titulo ? "img" : undefined} aria-label={titulo} aria-hidden={titulo ? undefined : true}>
      {titulo && <title>{titulo}</title>}
      <path
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
        d="M12 2.8l2.75 5.7 6.25.86-4.55 4.36 1.12 6.2L12 16.95l-5.57 2.97 1.12-6.2L3 9.36l6.25-.86z"
      />
    </svg>
  );
}

// As três linhas de mensagem do símbolo, usadas como indicador de carregamento.
export function LinhasCarregando({ rotulo = "Carregando" }: { rotulo?: string }) {
  return (
    <span className="linhas-carregando text-accent" role="status" aria-label={rotulo}>
      <span />
      <span />
      <span />
    </span>
  );
}
