import { urlMidia } from "@/lib/midia";

export function Avatar({ caminho, handle, tamanho = 36 }: { caminho: string | null; handle: string; tamanho?: number }) {
  const src = urlMidia(caminho);
  return (
    <span
      className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-accent-soft font-semibold text-accent"
      style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.4 }}
      aria-hidden="true"
    >
      {handle.slice(0, 1).toUpperCase()}
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" />
      )}
    </span>
  );
}
