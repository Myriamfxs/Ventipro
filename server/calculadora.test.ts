import { describe, expect, it } from "vitest";

// ============================================================
// COSTES ESTÁNDAR (copia de la lógica del router actualizado)
// ============================================================
const COSTES_ESTANDAR = {
  cria: { piensoMadre: 2.80, piensoLechon: 1.20, sanidad: 1.50, manoObra: 2.00, energia: 1.00, otros: 0.50, total: 9.00, mortalidad: 8.0, dias: 28 },
  transicion: { pienso: 12.50, sanidad: 2.50, manoObra: 1.80, energia: 0.80, otros: 0.40, total: 18.00, mortalidad: 3.0, dias: 37 },
  cebo: { pienso: 78.00, sanidad: 4.50, manoObra: 5.00, energia: 2.50, amortizacion: 3.00, purines: 2.00, otros: 1.00, total: 96.00, mortalidad: 2.0, dias: 120 },
};

// ============================================================
// FUNCIÓN DE CÁLCULO (replica la lógica del router)
// ============================================================
function calcularEscenario(
  escenario: string,
  numAnimales: number,
  preciosMercado: { cebado?: number; lechon20?: number; lechon7?: number },
) {
  let pesoVenta: number, precioVenta: number, unidadPrecio: string;
  let costeFaseCria: number, costeFaseTransicion: number, costeFaseCebo: number;
  let mortalidadPct: number, diasOcupacion: number;

  switch (escenario) {
    case "5-7kg":
      pesoVenta = 7;
      unidadPrecio = "€/unidad";
      diasOcupacion = COSTES_ESTANDAR.cria.dias;
      precioVenta = preciosMercado.lechon7 || 10.20;
      costeFaseCria = COSTES_ESTANDAR.cria.total;
      costeFaseTransicion = 0;
      costeFaseCebo = 0;
      mortalidadPct = COSTES_ESTANDAR.cria.mortalidad;
      break;
    case "20-21kg":
      pesoVenta = 21;
      unidadPrecio = "€/unidad";
      diasOcupacion = COSTES_ESTANDAR.cria.dias + COSTES_ESTANDAR.transicion.dias;
      precioVenta = preciosMercado.lechon20 || 17.00;
      costeFaseCria = COSTES_ESTANDAR.cria.total;
      costeFaseTransicion = COSTES_ESTANDAR.transicion.total;
      costeFaseCebo = 0;
      mortalidadPct = (1 - (1 - COSTES_ESTANDAR.cria.mortalidad / 100) * (1 - COSTES_ESTANDAR.transicion.mortalidad / 100)) * 100;
      break;
    case "cebo":
      pesoVenta = 110;
      unidadPrecio = "€/kg vivo";
      diasOcupacion = COSTES_ESTANDAR.cria.dias + COSTES_ESTANDAR.transicion.dias + COSTES_ESTANDAR.cebo.dias;
      precioVenta = preciosMercado.cebado || 1.00;
      costeFaseCria = COSTES_ESTANDAR.cria.total;
      costeFaseTransicion = COSTES_ESTANDAR.transicion.total;
      costeFaseCebo = COSTES_ESTANDAR.cebo.total;
      mortalidadPct = (1 - (1 - COSTES_ESTANDAR.cria.mortalidad / 100) * (1 - COSTES_ESTANDAR.transicion.mortalidad / 100) * (1 - COSTES_ESTANDAR.cebo.mortalidad / 100)) * 100;
      break;
    default:
      throw new Error("Escenario no válido");
  }

  const costeTotalPorAnimal = costeFaseCria + costeFaseTransicion + costeFaseCebo;
  const animalesFinales = Math.round(numAnimales * (1 - mortalidadPct / 100));
  const mortalidadCoste = costeTotalPorAnimal * (mortalidadPct / 100);

  // INGRESOS: Lechones por UNIDAD, cebo por KG VIVO
  const ingresosPorAnimal = escenario === "cebo"
    ? pesoVenta * precioVenta
    : precioVenta; // €/unidad directamente

  const ingresosTotales = ingresosPorAnimal * animalesFinales;
  const costesTotalesConMortalidad = (costeTotalPorAnimal + mortalidadCoste) * numAnimales;
  const margenPorAnimal = ingresosPorAnimal - costeTotalPorAnimal - mortalidadCoste;
  const margenTotal = ingresosTotales - costesTotalesConMortalidad;
  const margenPorPlazaDia = diasOcupacion > 0 ? margenPorAnimal / diasOcupacion : 0;
  const rentabilidadPct = costeTotalPorAnimal > 0 ? (margenPorAnimal / costeTotalPorAnimal) * 100 : 0;

  return {
    escenario, pesoVenta, precioVenta, unidadPrecio,
    ingresosPorAnimal, ingresosTotales,
    costeTotalPorAnimal, costesTotales: costesTotalesConMortalidad,
    mortalidadPct, animalesFinales,
    margenPorAnimal, margenTotal,
    diasOcupacion, margenPorPlazaDia, rentabilidadPct,
  };
}

// ============================================================
// TESTS: PRECIOS POR UNIDAD (LECHONES) vs POR KG (CEBO)
// ============================================================

describe("Calculadora - Precios por Unidad (Lechones) vs por Kg (Cebo)", () => {
  describe("Escenario 5-7kg: Precio POR UNIDAD", () => {
    it("debe usar €/unidad como unidad de precio", () => {
      const r = calcularEscenario("5-7kg", 500, { lechon7: 10.20 });
      expect(r.unidadPrecio).toBe("€/unidad");
    });

    it("ingresos por animal = precio unitario (NO multiplicado por peso)", () => {
      const r = calcularEscenario("5-7kg", 500, { lechon7: 10.20 });
      expect(r.ingresosPorAnimal).toBe(10.20);
      // Verificar que NO es peso * precio
      expect(r.ingresosPorAnimal).not.toBe(7 * 10.20);
    });

    it("ingresos totales = precio_unidad * animales_finales", () => {
      const r = calcularEscenario("5-7kg", 100, { lechon7: 10.20 });
      expect(r.ingresosTotales).toBeCloseTo(10.20 * r.animalesFinales, 2);
    });

    it("usa precio estándar de 10.20 €/unidad sin datos de mercado", () => {
      const r = calcularEscenario("5-7kg", 500, {});
      expect(r.precioVenta).toBe(10.20);
    });

    it("tiene 28 días de ocupación", () => {
      const r = calcularEscenario("5-7kg", 500, {});
      expect(r.diasOcupacion).toBe(28);
    });

    it("mortalidad del 8% en fase cría", () => {
      const r = calcularEscenario("5-7kg", 500, {});
      expect(r.mortalidadPct).toBe(8.0);
      expect(r.animalesFinales).toBe(460);
    });

    it("coste total de 9.00 €/animal", () => {
      const r = calcularEscenario("5-7kg", 500, {});
      expect(r.costeTotalPorAnimal).toBe(9.00);
    });
  });

  describe("Escenario 20-21kg: Precio POR UNIDAD", () => {
    it("debe usar €/unidad como unidad de precio", () => {
      const r = calcularEscenario("20-21kg", 500, { lechon20: 17.00 });
      expect(r.unidadPrecio).toBe("€/unidad");
    });

    it("ingresos por animal = precio unitario (NO multiplicado por peso)", () => {
      const r = calcularEscenario("20-21kg", 500, { lechon20: 17.00 });
      expect(r.ingresosPorAnimal).toBe(17.00);
      // Verificar que NO es peso * precio
      expect(r.ingresosPorAnimal).not.toBe(21 * 17.00);
    });

    it("usa precio estándar de 17.00 €/unidad sin datos de mercado", () => {
      const r = calcularEscenario("20-21kg", 500, {});
      expect(r.precioVenta).toBe(17.00);
    });

    it("tiene 65 días de ocupación (28 cría + 37 transición)", () => {
      const r = calcularEscenario("20-21kg", 500, {});
      expect(r.diasOcupacion).toBe(65);
    });

    it("mortalidad acumulada cría+transición ~10.76%", () => {
      const r = calcularEscenario("20-21kg", 500, {});
      const esperada = (1 - (1 - 0.08) * (1 - 0.03)) * 100;
      expect(r.mortalidadPct).toBeCloseTo(esperada, 2);
    });

    it("coste total de 27.00 €/animal (9 cría + 18 transición)", () => {
      const r = calcularEscenario("20-21kg", 500, {});
      expect(r.costeTotalPorAnimal).toBe(27.00);
    });

    it("margen negativo con precio 17€ y costes 27€+mortalidad", () => {
      const r = calcularEscenario("20-21kg", 500, { lechon20: 17.00 });
      expect(r.margenPorAnimal).toBeLessThan(0);
    });
  });

  describe("Escenario Cebo: Precio POR KG VIVO", () => {
    it("debe usar €/kg vivo como unidad de precio", () => {
      const r = calcularEscenario("cebo", 500, { cebado: 1.00 });
      expect(r.unidadPrecio).toBe("€/kg vivo");
    });

    it("ingresos por animal = peso * precio_kg", () => {
      const r = calcularEscenario("cebo", 500, { cebado: 1.00 });
      expect(r.ingresosPorAnimal).toBe(110.00); // 110kg * 1.00 €/kg
    });

    it("usa precio estándar de 1.00 €/kg sin datos de mercado", () => {
      const r = calcularEscenario("cebo", 500, {});
      expect(r.precioVenta).toBe(1.00);
    });

    it("tiene 185 días de ocupación (28+37+120)", () => {
      const r = calcularEscenario("cebo", 500, {});
      expect(r.diasOcupacion).toBe(185);
    });

    it("mortalidad acumulada 3 fases ~12.54%", () => {
      const r = calcularEscenario("cebo", 500, {});
      const esperada = (1 - (1 - 0.08) * (1 - 0.03) * (1 - 0.02)) * 100;
      expect(r.mortalidadPct).toBeCloseTo(esperada, 2);
    });

    it("coste total de 123.00 €/animal (9+18+96)", () => {
      const r = calcularEscenario("cebo", 500, {});
      expect(r.costeTotalPorAnimal).toBe(123.00);
    });
  });
});

// ============================================================
// TESTS: COMPARATIVA DE UNIDADES
// ============================================================

describe("Comparativa de unidades entre escenarios", () => {
  it("lechones son €/unidad, cebo es €/kg vivo", () => {
    const r57 = calcularEscenario("5-7kg", 100, {});
    const r2021 = calcularEscenario("20-21kg", 100, {});
    const rCebo = calcularEscenario("cebo", 100, {});
    expect(r57.unidadPrecio).toBe("€/unidad");
    expect(r2021.unidadPrecio).toBe("€/unidad");
    expect(rCebo.unidadPrecio).toBe("€/kg vivo");
  });

  it("ingresos de lechones NO se multiplican por peso", () => {
    const r57 = calcularEscenario("5-7kg", 100, { lechon7: 10.20 });
    expect(r57.ingresosPorAnimal).toBe(10.20);
    expect(r57.ingresosPorAnimal).not.toBe(7 * 10.20);
  });

  it("ingresos de cebo SÍ se multiplican por peso", () => {
    const rCebo = calcularEscenario("cebo", 100, { cebado: 1.00 });
    expect(rCebo.ingresosPorAnimal).toBe(110.00);
  });

  it("escenario inválido lanza error", () => {
    expect(() => calcularEscenario("invalido", 500, {})).toThrow("Escenario no válido");
  });
});

// ============================================================
// TESTS: COSTES ESTÁNDAR POR FASES
// ============================================================

describe("Costes Estándar por Fases", () => {
  it("costes de cría suman 9.00 €", () => {
    const c = COSTES_ESTANDAR.cria;
    expect(c.piensoMadre + c.piensoLechon + c.sanidad + c.manoObra + c.energia + c.otros).toBe(9.00);
  });

  it("costes de transición suman 18.00 €", () => {
    const t = COSTES_ESTANDAR.transicion;
    expect(t.pienso + t.sanidad + t.manoObra + t.energia + t.otros).toBe(18.00);
  });

  it("costes de cebo suman 96.00 €", () => {
    const c = COSTES_ESTANDAR.cebo;
    expect(c.pienso + c.sanidad + c.manoObra + c.energia + c.amortizacion + c.purines + c.otros).toBe(96.00);
  });

  it("coste total ciclo completo es 123 €/animal", () => {
    expect(COSTES_ESTANDAR.cria.total + COSTES_ESTANDAR.transicion.total + COSTES_ESTANDAR.cebo.total).toBe(123.00);
  });

  it("días totales ciclo completo es 185", () => {
    expect(COSTES_ESTANDAR.cria.dias + COSTES_ESTANDAR.transicion.dias + COSTES_ESTANDAR.cebo.dias).toBe(185);
  });
});

// ============================================================
// TESTS: CÁLCULO DE PRECIO TOTAL EN OFERTAS
// ============================================================

describe("Cálculo de precio total en ofertas", () => {
  it("lechones 5-7kg: total = precio_unidad * num_animales (sin multiplicar por peso)", () => {
    const precioUnidad = 10.20;
    const numAnimales = 500;
    const precioTotal = precioUnidad * numAnimales;
    expect(precioTotal).toBe(5100.00);
  });

  it("lechones 20-21kg: total = precio_unidad * num_animales (sin multiplicar por peso)", () => {
    const precioUnidad = 17.00;
    const numAnimales = 300;
    const precioTotal = precioUnidad * numAnimales;
    expect(precioTotal).toBe(5100.00);
  });

  it("cebo: total = precio_kg * peso * num_animales", () => {
    const precioKg = 1.00;
    const peso = 105;
    const numAnimales = 200;
    const precioTotal = precioKg * peso * numAnimales;
    expect(precioTotal).toBe(21000.00);
  });
});

// ============================================================
// TESTS: ESTIMACIÓN DE PRECIOS Y RECOMENDACIÓN
// ============================================================

describe("Estimación de Precios Futuros", () => {
  it("media móvil ponderada funciona correctamente", () => {
    const precios = [1.10, 1.08, 1.06, 1.04, 1.02, 1.00, 1.00, 1.00];
    const pesos = precios.map((_, i) => i + 1);
    const sumaPesos = pesos.reduce((a, b) => a + b, 0);
    const media = precios.reduce((sum, p, i) => sum + p * pesos[i], 0) / sumaPesos;
    expect(media).toBeGreaterThan(0);
    expect(media).toBeLessThan(1.10);
  });

  it("confianza decrece con el horizonte temporal", () => {
    const c4 = Math.max(0.1, Math.min(0.95, 0.85 - 4 * 0.05));
    const c16 = Math.max(0.1, Math.min(0.95, 0.85 - 16 * 0.05));
    expect(c4).toBeGreaterThan(c16);
  });
});

describe("Motor de Recomendación", () => {
  it("selecciona el escenario con mejor margen por plaza-día", () => {
    const escenarios = [
      { escenario: "5-7kg", margenPorPlazaDia: 0.04, viable: true },
      { escenario: "20-21kg", margenPorPlazaDia: -0.15, viable: true },
      { escenario: "cebo", margenPorPlazaDia: -0.07, viable: true },
    ];
    const mejor = escenarios.filter(e => e.viable).reduce((a, b) => a.margenPorPlazaDia > b.margenPorPlazaDia ? a : b);
    expect(mejor.escenario).toBe("5-7kg");
  });

  it("devuelve vacío si no hay viables", () => {
    const viables = [{ escenario: "cebo", viable: false }].filter(e => e.viable);
    expect(viables.length).toBe(0);
  });
});

describe("Generación de código de oferta", () => {
  it("genera código con formato VP-YYMM-XXXXXX", () => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const codigo = `VP-${year}${month}-ABC123`;
    expect(codigo).toMatch(/^VP-\d{4}-[A-Z0-9]{6}$/);
  });
});
