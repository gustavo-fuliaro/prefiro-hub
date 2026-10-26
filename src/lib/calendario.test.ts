import { describe, expect, it } from "vitest";
import { deslocarMes, gradeDoMes, lerMes } from "./calendario";

describe("calendário", () => {
  it("monta semanas de domingo a sábado cobrindo o mês", () => {
    const g = gradeDoMes("2026-10", "2026-10-24");
    expect(g[0][0].data).toBe("2026-09-27"); // 1/10/2026 é quinta
    expect(g.at(-1)!.at(-1)!.data).toBe("2026-10-31");
    expect(g.flat().find((d) => d.hoje)?.data).toBe("2026-10-24");
    expect(g.flat().filter((d) => d.doMes)).toHaveLength(31);
  });

  it("lê e desloca meses", () => {
    expect(lerMes("2026-13", "2026-10-24")).toBe("2026-10");
    expect(deslocarMes("2026-12", 1)).toBe("2027-01");
    expect(deslocarMes("2026-01", -1)).toBe("2025-12");
  });
});
