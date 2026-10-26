// Calendário: grade do mês (domingo a sábado) e navegação entre meses. Código puro.

export type DiaCalendario = { data: string; doMes: boolean; hoje: boolean };

// Semanas (domingo a sábado) que cobrem o mês. `mes` no formato AAAA-MM.
export function gradeDoMes(mes: string, hoje: string): DiaCalendario[][] {
  const [ano, m] = mes.split("-").map(Number);
  const primeiro = new Date(Date.UTC(ano, m - 1, 1));
  const inicio = new Date(primeiro);
  inicio.setUTCDate(1 - primeiro.getUTCDay());
  const semanas: DiaCalendario[][] = [];
  const cursor = new Date(inicio);
  do {
    const semana: DiaCalendario[] = [];
    for (let i = 0; i < 7; i++) {
      const data = cursor.toISOString().slice(0, 10);
      semana.push({ data, doMes: cursor.getUTCMonth() === m - 1, hoje: data === hoje });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    semanas.push(semana);
  } while (cursor.getUTCMonth() === m - 1);
  return semanas;
}

export function lerMes(v: unknown, hoje: string): string {
  return typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v) ? v : hoje.slice(0, 7);
}

export function deslocarMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}
