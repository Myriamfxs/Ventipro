import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getParametrosActivos, getAllParametros, createParametros, updateParametros, getCentros, logActividad, createHistorialCalculo } from "../db";
import { obtenerPreciosActuales, estimarPrecioFuturo } from "../services/preciosMercado";

// ============================================================
// TIPOS
// ============================================================

type DesgloseCostes = {
  costeFaseCria: number;
  costeFaseTransicion: number;
  costeFaseCebo: number;
  costePiensoTotal: number;
  costeSanidadTotal: number;
  costeFijosTotal: number;
  mortalidadCoste: number;
};

type EscenarioResult = {
  nombre: string;
  escenario: string;
  pesoVenta: number;
  precioVenta: number;       // Precio de venta (€/unidad para lechones, €/kg para cebo)
  unidadPrecio: string;      // "€/unidad" o "€/kg vivo"
  precioFuente: string;
  ingresosPorAnimal: number;
  ingresosTotales: number;
  desgloseCostes: DesgloseCostes;
  costeTotalPorAnimal: number;
  costesTotales: number;
  mortalidadPct: number;
  animalesFinales: number;
  margenPorAnimal: number;
  margenTotal: number;
  diasOcupacion: number;
  margenPorPlazaDia: number;
  rentabilidadPct: number;
  viable: boolean;
  razonNoViable?: string;
  usaCostesEstimados: boolean;
};

type Recomendacion = {
  escenarioRecomendado: string;
  razon: string;
  factores: string[];
  confianza: number;
  alternativa?: string;
  razonAlternativa?: string;
};

// ============================================================
// COSTES ESTÁNDAR ESTIMADOS DEL SECTOR
// ============================================================

const COSTES_ESTANDAR = {
  // Fase Cría (0-7kg): ~28 días
  cria: {
    piensoMadre: 2.80,       // €/lechón (parte proporcional pienso madre)
    piensoLechon: 1.20,      // €/lechón (pre-starter)
    sanidad: 1.50,            // €/lechón (vacunas iniciales)
    manoObra: 2.00,           // €/lechón (parte proporcional)
    energia: 1.00,            // €/lechón (calefacción nido)
    otros: 0.50,              // €/lechón (limpieza, desinfección)
    total: 9.00,              // €/lechón total fase cría
    mortalidad: 8.0,          // % mortalidad en fase
    dias: 28,
  },
  // Fase Transición (7-21kg): ~37 días
  transicion: {
    pienso: 12.50,            // €/lechón (starter + transición)
    sanidad: 2.50,            // €/lechón (refuerzos vacunales)
    manoObra: 1.80,           // €/lechón
    energia: 0.80,            // €/lechón
    otros: 0.40,              // €/lechón
    total: 18.00,             // €/lechón total fase transición
    mortalidad: 3.0,          // % mortalidad en fase
    dias: 37,
  },
  // Fase Cebo (21-110kg): ~120 días
  cebo: {
    pienso: 78.00,            // €/cerdo (crecimiento + acabado, IC ~2.8)
    sanidad: 4.50,            // €/cerdo (preventivos)
    manoObra: 5.00,           // €/cerdo
    energia: 2.50,            // €/cerdo
    amortizacion: 3.00,       // €/cerdo (plaza cebadero)
    purines: 2.00,            // €/cerdo (gestión)
    otros: 1.00,              // €/cerdo
    total: 96.00,             // €/cerdo total fase cebo
    mortalidad: 2.0,          // % mortalidad en fase
    dias: 120,
  },
};

// ============================================================
// FUNCIONES DE CÁLCULO
// ============================================================

function calcularEscenarioMejorado(
  escenario: string,
  numAnimales: number,
  params: any | null,
  plazasDisponibles: number,
  preciosMercado: { cebado?: number; lechon20?: number; lechon7?: number },
  usarCostesEstimados: boolean,
): EscenarioResult {
  let pesoVenta: number, precioVenta: number, unidadPrecio: string, precioFuente: string;
  let costeFaseCria: number, costeFaseTransicion: number, costeFaseCebo: number;
  let costePiensoTotal: number, costeSanidadTotal: number, costeFijosTotal: number;
  let mortalidadPct: number, diasOcupacion: number, nombre: string;
  let ingresosPorAnimalCalc: number;

  switch (escenario) {
    case "5-7kg": {
      nombre = "Venta Lechón 5-7 kg";
      pesoVenta = 7;
      unidadPrecio = "€/unidad";
      diasOcupacion = usarCostesEstimados ? COSTES_ESTANDAR.cria.dias : (params?.diasEstancia5_7 || 28);

      // Precio POR UNIDAD: mercado > parámetros > estándar
      // Los lechones de 5-7kg se venden por unidad, NO por kg
      if (preciosMercado.lechon7) {
        precioVenta = preciosMercado.lechon7; // Ya viene en €/unidad
        precioFuente = "Mercado (estimado ref. Mercolleida)";
      } else if (params?.precioVenta5_7) {
        precioVenta = parseFloat(params.precioVenta5_7); // €/unidad
        precioFuente = "Parámetros manuales";
      } else {
        precioVenta = 10.20; // ~10.20 €/unidad estándar (60% de 17€ lechón 20kg)
        precioFuente = "Estándar del sector";
      }

      if (usarCostesEstimados) {
        costeFaseCria = COSTES_ESTANDAR.cria.total;
        costeFaseTransicion = 0;
        costeFaseCebo = 0;
        costePiensoTotal = COSTES_ESTANDAR.cria.piensoMadre + COSTES_ESTANDAR.cria.piensoLechon;
        costeSanidadTotal = COSTES_ESTANDAR.cria.sanidad;
        costeFijosTotal = COSTES_ESTANDAR.cria.manoObra + COSTES_ESTANDAR.cria.energia + COSTES_ESTANDAR.cria.otros;
        mortalidadPct = COSTES_ESTANDAR.cria.mortalidad;
      } else {
        costePiensoTotal = parseFloat(params?.costePienso5_7 || "8.50");
        costeSanidadTotal = parseFloat(params?.costeSanidad5_7 || "1.50");
        const costesFijosMes = parseFloat(params?.costeManoObra || "3500") + parseFloat(params?.costeEnergia || "1200") + parseFloat(params?.costeAmortizacion || "800") + parseFloat(params?.costePurines || "400");
        costeFijosTotal = numAnimales > 0 ? (costesFijosMes / 30 / numAnimales) * diasOcupacion : 0;
        costeFaseCria = costePiensoTotal + costeSanidadTotal + costeFijosTotal;
        costeFaseTransicion = 0;
        costeFaseCebo = 0;
        mortalidadPct = parseFloat(params?.mortalidad5_7 || "8.00");
      }
      break;
    }
    case "20-21kg": {
      nombre = "Venta Transición 20-21 kg";
      pesoVenta = 21;
      unidadPrecio = "€/unidad";
      diasOcupacion = usarCostesEstimados
        ? COSTES_ESTANDAR.cria.dias + COSTES_ESTANDAR.transicion.dias
        : (params?.diasEstancia20_21 || 65);

      // Precio POR UNIDAD: los lechones de 20kg se venden por unidad
      if (preciosMercado.lechon20) {
        precioVenta = preciosMercado.lechon20; // Ya viene en €/unidad
        precioFuente = "Mercado (Mercolleida)";
      } else if (params?.precioVenta20_21) {
        precioVenta = parseFloat(params.precioVenta20_21); // €/unidad
        precioFuente = "Parámetros manuales";
      } else {
        precioVenta = 17.00; // ~17 €/unidad estándar Mercolleida
        precioFuente = "Estándar del sector";
      }

      if (usarCostesEstimados) {
        costeFaseCria = COSTES_ESTANDAR.cria.total;
        costeFaseTransicion = COSTES_ESTANDAR.transicion.total;
        costeFaseCebo = 0;
        costePiensoTotal = COSTES_ESTANDAR.cria.piensoMadre + COSTES_ESTANDAR.cria.piensoLechon + COSTES_ESTANDAR.transicion.pienso;
        costeSanidadTotal = COSTES_ESTANDAR.cria.sanidad + COSTES_ESTANDAR.transicion.sanidad;
        costeFijosTotal = COSTES_ESTANDAR.cria.manoObra + COSTES_ESTANDAR.cria.energia + COSTES_ESTANDAR.cria.otros + COSTES_ESTANDAR.transicion.manoObra + COSTES_ESTANDAR.transicion.energia + COSTES_ESTANDAR.transicion.otros;
        // Mortalidad acumulada: 1 - (1 - cria) * (1 - transicion)
        mortalidadPct = (1 - (1 - COSTES_ESTANDAR.cria.mortalidad / 100) * (1 - COSTES_ESTANDAR.transicion.mortalidad / 100)) * 100;
      } else {
        costePiensoTotal = parseFloat(params?.costePienso20_21 || "22.00");
        costeSanidadTotal = parseFloat(params?.costeSanidad20_21 || "3.00");
        const costesFijosMes = parseFloat(params?.costeManoObra || "3500") + parseFloat(params?.costeEnergia || "1200") + parseFloat(params?.costeAmortizacion || "800") + parseFloat(params?.costePurines || "400");
        costeFijosTotal = numAnimales > 0 ? (costesFijosMes / 30 / numAnimales) * diasOcupacion : 0;
        costeFaseCria = costePiensoTotal * 0.35 + costeSanidadTotal * 0.4 + costeFijosTotal * 0.4;
        costeFaseTransicion = costePiensoTotal * 0.65 + costeSanidadTotal * 0.6 + costeFijosTotal * 0.6;
        costeFaseCebo = 0;
        mortalidadPct = parseFloat(params?.mortalidad20_21 || "3.00");
      }
      break;
    }
    case "cebo": {
      nombre = "Cebo Final 100-110 kg";
      pesoVenta = 110;
      unidadPrecio = "€/kg vivo";
      diasOcupacion = usarCostesEstimados
        ? COSTES_ESTANDAR.cria.dias + COSTES_ESTANDAR.transicion.dias + COSTES_ESTANDAR.cebo.dias
        : (params?.diasEstanciaCebo || 160);

      // Precio POR KG VIVO: el cerdo cebado se vende al peso
      if (preciosMercado.cebado) {
        precioVenta = preciosMercado.cebado; // €/kg vivo
        precioFuente = "Mercado (Mercolleida)";
      } else if (params?.precioVentaCebo) {
        precioVenta = parseFloat(params.precioVentaCebo); // €/kg vivo
        precioFuente = "Parámetros manuales";
      } else {
        precioVenta = 1.00; // 1.00 €/kg vivo actual Mercolleida
        precioFuente = "Estándar del sector";
      }

      if (usarCostesEstimados) {
        costeFaseCria = COSTES_ESTANDAR.cria.total;
        costeFaseTransicion = COSTES_ESTANDAR.transicion.total;
        costeFaseCebo = COSTES_ESTANDAR.cebo.total;
        costePiensoTotal = COSTES_ESTANDAR.cria.piensoMadre + COSTES_ESTANDAR.cria.piensoLechon + COSTES_ESTANDAR.transicion.pienso + COSTES_ESTANDAR.cebo.pienso;
        costeSanidadTotal = COSTES_ESTANDAR.cria.sanidad + COSTES_ESTANDAR.transicion.sanidad + COSTES_ESTANDAR.cebo.sanidad;
        costeFijosTotal = COSTES_ESTANDAR.cria.manoObra + COSTES_ESTANDAR.cria.energia + COSTES_ESTANDAR.cria.otros + COSTES_ESTANDAR.transicion.manoObra + COSTES_ESTANDAR.transicion.energia + COSTES_ESTANDAR.transicion.otros + COSTES_ESTANDAR.cebo.manoObra + COSTES_ESTANDAR.cebo.energia + COSTES_ESTANDAR.cebo.amortizacion + COSTES_ESTANDAR.cebo.purines + COSTES_ESTANDAR.cebo.otros;
        // Mortalidad acumulada total
        mortalidadPct = (1 - (1 - COSTES_ESTANDAR.cria.mortalidad / 100) * (1 - COSTES_ESTANDAR.transicion.mortalidad / 100) * (1 - COSTES_ESTANDAR.cebo.mortalidad / 100)) * 100;
      } else {
        costePiensoTotal = parseFloat(params?.costePiensoCebo || "95.00");
        costeSanidadTotal = parseFloat(params?.costeSanidadCebo || "5.50");
        const costesFijosMes = parseFloat(params?.costeManoObra || "3500") + parseFloat(params?.costeEnergia || "1200") + parseFloat(params?.costeAmortizacion || "800") + parseFloat(params?.costePurines || "400");
        costeFijosTotal = numAnimales > 0 ? (costesFijosMes / 30 / numAnimales) * diasOcupacion : 0;
        costeFaseCria = costePiensoTotal * 0.1 + costeSanidadTotal * 0.2 + costeFijosTotal * 0.15;
        costeFaseTransicion = costePiensoTotal * 0.2 + costeSanidadTotal * 0.3 + costeFijosTotal * 0.2;
        costeFaseCebo = costePiensoTotal * 0.7 + costeSanidadTotal * 0.5 + costeFijosTotal * 0.65;
        mortalidadPct = parseFloat(params?.mortalidadCebo || "2.00");
      }
      break;
    }
    default:
      throw new Error("Escenario no válido");
  }

  const costeTotalPorAnimal = usarCostesEstimados
    ? costeFaseCria + costeFaseTransicion + costeFaseCebo
    : costePiensoTotal + costeSanidadTotal + costeFijosTotal;

  const animalesFinales = Math.round(numAnimales * (1 - mortalidadPct / 100));
  const mortalidadCoste = costeTotalPorAnimal * (mortalidadPct / 100);

  // INGRESOS: Para lechones (5-7kg y 20-21kg) el precio es POR UNIDAD
  // Para cebo, el precio es POR KG VIVO (precio * peso)
  if (escenario === "cebo") {
    ingresosPorAnimalCalc = pesoVenta * precioVenta; // kg * €/kg
  } else {
    ingresosPorAnimalCalc = precioVenta; // €/unidad directamente
  }

  const ingresosPorAnimal = ingresosPorAnimalCalc;
  const ingresosTotales = ingresosPorAnimal * animalesFinales;
  const costesTotalesConMortalidad = (costeTotalPorAnimal + mortalidadCoste) * numAnimales;
  const margenPorAnimal = ingresosPorAnimal - costeTotalPorAnimal - mortalidadCoste;
  const margenTotal = ingresosTotales - costesTotalesConMortalidad;
  const margenPorPlazaDia = diasOcupacion > 0 ? margenPorAnimal / diasOcupacion : 0;
  const rentabilidadPct = costeTotalPorAnimal > 0 ? (margenPorAnimal / costeTotalPorAnimal) * 100 : 0;

  let viable = true;
  let razonNoViable: string | undefined;
  if (escenario === "cebo" && numAnimales > plazasDisponibles && plazasDisponibles > 0) {
    viable = false;
    razonNoViable = `Se necesitan ${numAnimales} plazas de cebo pero solo hay ${plazasDisponibles} disponibles`;
  }

  const r = (v: number) => Math.round(v * 100) / 100;

  return {
    nombre,
    escenario,
    pesoVenta,
    precioVenta: r(precioVenta),
    unidadPrecio,
    precioFuente,
    ingresosPorAnimal: r(ingresosPorAnimal),
    ingresosTotales: r(ingresosTotales),
    desgloseCostes: {
      costeFaseCria: r(costeFaseCria),
      costeFaseTransicion: r(costeFaseTransicion),
      costeFaseCebo: r(costeFaseCebo),
      costePiensoTotal: r(costePiensoTotal),
      costeSanidadTotal: r(costeSanidadTotal),
      costeFijosTotal: r(costeFijosTotal),
      mortalidadCoste: r(mortalidadCoste),
    },
    costeTotalPorAnimal: r(costeTotalPorAnimal + mortalidadCoste),
    costesTotales: r(costesTotalesConMortalidad),
    mortalidadPct: r(mortalidadPct),
    animalesFinales,
    margenPorAnimal: r(margenPorAnimal),
    margenTotal: r(margenTotal),
    diasOcupacion,
    margenPorPlazaDia: r(margenPorPlazaDia),
    rentabilidadPct: r(rentabilidadPct),
    viable,
    razonNoViable,
    usaCostesEstimados: usarCostesEstimados,
  };
}

function generarRecomendacion(escenarios: EscenarioResult[], plazasCebo: number): Recomendacion {
  const viables = escenarios.filter(e => e.viable);

  if (viables.length === 0) {
    return {
      escenarioRecomendado: "ninguno",
      razon: "Ningún escenario es viable con la capacidad actual. Considere ampliar plazas de cebo o reducir el tamaño del lote.",
      factores: ["Capacidad insuficiente en todos los escenarios"],
      confianza: 0,
    };
  }

  // Ordenar por margen por plaza-día (eficiencia)
  const porEficiencia = [...viables].sort((a, b) => b.margenPorPlazaDia - a.margenPorPlazaDia);
  // Ordenar por margen total (beneficio absoluto)
  const porMargenTotal = [...viables].sort((a, b) => b.margenTotal - a.margenTotal);
  // Ordenar por rentabilidad %
  const porRentabilidad = [...viables].sort((a, b) => b.rentabilidadPct - a.rentabilidadPct);

  const mejor = porEficiencia[0];
  const factores: string[] = [];
  let confianza = 0.7;

  // Factor 1: Margen por plaza-día
  factores.push(`Mejor margen por plaza-día: ${mejor.margenPorPlazaDia.toFixed(2)} €/plaza/día`);

  // Factor 2: Margen total
  if (porMargenTotal[0].escenario === mejor.escenario) {
    factores.push(`También ofrece el mayor margen total: ${mejor.margenTotal.toFixed(2)} €`);
    confianza += 0.1;
  } else {
    factores.push(`Margen total: ${mejor.margenTotal.toFixed(2)} € (vs ${porMargenTotal[0].margenTotal.toFixed(2)} € del escenario "${porMargenTotal[0].nombre}")`);
  }

  // Factor 3: Rentabilidad
  factores.push(`Rentabilidad sobre costes: ${mejor.rentabilidadPct.toFixed(1)}%`);

  // Factor 4: Días de ocupación
  factores.push(`Días de ocupación: ${mejor.diasOcupacion} días (liberación de plazas más ${mejor.diasOcupacion < 100 ? "rápida" : "lenta"})`);

  // Factor 5: Capacidad
  if (mejor.escenario === "cebo") {
    factores.push(`Utiliza ${mejor.animalesFinales} de ${plazasCebo} plazas de cebo disponibles`);
  }

  // Factor 6: Precio de mercado
  factores.push(`Precio de venta: ${mejor.precioVenta.toFixed(2)} ${mejor.unidadPrecio} (${mejor.precioFuente})`);

  // Alternativa
  let alternativa: string | undefined;
  let razonAlternativa: string | undefined;
  if (viables.length > 1) {
    const segundo = porEficiencia[1];
    alternativa = segundo.escenario;
    razonAlternativa = `"${segundo.nombre}" como alternativa con margen de ${segundo.margenPorPlazaDia.toFixed(2)} €/plaza/día`;
  }

  return {
    escenarioRecomendado: mejor.escenario,
    razon: `Se recomienda "${mejor.nombre}" por ofrecer el mejor equilibrio entre rentabilidad (${mejor.rentabilidadPct.toFixed(1)}%), margen por plaza-día (${mejor.margenPorPlazaDia.toFixed(2)} €) y margen total (${mejor.margenTotal.toFixed(2)} €).`,
    factores,
    confianza: Math.min(confianza, 0.95),
    alternativa,
    razonAlternativa,
  };
}

// ============================================================
// ROUTER
// ============================================================

export const calculadoraRouter = router({
  parametros: router({
    getActivos: protectedProcedure.query(async () => {
      const params = await getParametrosActivos();
      return params ?? null;
    }),

    getAll: protectedProcedure.query(async () => {
      return getAllParametros();
    }),

    create: protectedProcedure
      .input(z.object({
        nombre: z.string().min(1),
        precioVenta5_7: z.string().default("3.50"),
        precioVenta20_21: z.string().default("2.80"),
        precioVentaCebo: z.string().default("1.45"),
        costePienso5_7: z.string().default("8.50"),
        costePienso20_21: z.string().default("22.00"),
        costePiensoCebo: z.string().default("95.00"),
        costeSanidad5_7: z.string().default("1.50"),
        costeSanidad20_21: z.string().default("3.00"),
        costeSanidadCebo: z.string().default("5.50"),
        mortalidad5_7: z.string().default("8.00"),
        mortalidad20_21: z.string().default("3.00"),
        mortalidadCebo: z.string().default("2.00"),
        costeManoObra: z.string().default("3500.00"),
        costeEnergia: z.string().default("1200.00"),
        costeAmortizacion: z.string().default("800.00"),
        costePurines: z.string().default("400.00"),
        indicConversion5_7: z.string().default("1.80"),
        indicConversion20_21: z.string().default("2.20"),
        indicConversionCebo: z.string().default("2.80"),
        diasEstancia5_7: z.number().default(28),
        diasEstancia20_21: z.number().default(65),
        diasEstanciaCebo: z.number().default(160),
      }))
      .mutation(async ({ input, ctx }) => {
        const result = await createParametros(input);
        await logActividad({
          tipo: "parametros_creados",
          descripcion: `Nuevos parámetros económicos "${input.nombre}" configurados`,
          modulo: "calculadora",
          userId: ctx.user.id,
        });
        return result;
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        nombre: z.string().min(1).optional(),
        precioVenta5_7: z.string().optional(),
        precioVenta20_21: z.string().optional(),
        precioVentaCebo: z.string().optional(),
        costePienso5_7: z.string().optional(),
        costePienso20_21: z.string().optional(),
        costePiensoCebo: z.string().optional(),
        costeSanidad5_7: z.string().optional(),
        costeSanidad20_21: z.string().optional(),
        costeSanidadCebo: z.string().optional(),
        mortalidad5_7: z.string().optional(),
        mortalidad20_21: z.string().optional(),
        mortalidadCebo: z.string().optional(),
        costeManoObra: z.string().optional(),
        costeEnergia: z.string().optional(),
        costeAmortizacion: z.string().optional(),
        costePurines: z.string().optional(),
        indicConversion5_7: z.string().optional(),
        indicConversion20_21: z.string().optional(),
        indicConversionCebo: z.string().optional(),
        diasEstancia5_7: z.number().optional(),
        diasEstancia20_21: z.number().optional(),
        diasEstanciaCebo: z.number().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const { id, ...data } = input;
        await updateParametros(id, data);
        await logActividad({
          tipo: "parametros_actualizados",
          descripcion: `Parámetros económicos ID ${id} actualizados`,
          modulo: "calculadora",
          userId: ctx.user.id,
        });
        return { success: true };
      }),
  }),

  costesEstandar: protectedProcedure.query(() => {
    return COSTES_ESTANDAR;
  }),

  calcular: protectedProcedure
    .input(z.object({
      numAnimales: z.number().min(1),
      usarCostesEstimados: z.boolean().default(true),
      // Optional overrides for quick calculations
      precioVenta5_7: z.string().optional(),
      precioVenta20_21: z.string().optional(),
      precioVentaCebo: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const params = await getParametrosActivos();

      // Obtener precios de mercado actuales
      let preciosMercado: { cebado?: number; lechon20?: number; lechon7?: number } = {};
      try {
        const precios = await obtenerPreciosActuales();
        for (const p of precios) {
          if (p.producto.includes("Cebado")) preciosMercado.cebado = p.precio;
          if (p.producto.includes("Lechón 20")) preciosMercado.lechon20 = p.precio;
          if (p.producto.includes("Lechón 5-7")) preciosMercado.lechon7 = p.precio;
        }
      } catch {
        // Si falla, se usarán parámetros manuales o estándar
      }

      // Aplicar overrides del usuario
      if (input.precioVenta5_7) preciosMercado.lechon7 = parseFloat(input.precioVenta5_7);
      if (input.precioVenta20_21) preciosMercado.lechon20 = parseFloat(input.precioVenta20_21) * 20;
      if (input.precioVentaCebo) preciosMercado.cebado = parseFloat(input.precioVentaCebo);

      // Get available cebo capacity
      const allCentros = await getCentros();
      const cebaderos = allCentros.filter(c => c.tipo === "engorde");
      const plazasCeboDisponibles = cebaderos.reduce((sum, c) => sum + (c.plazasTotales - c.plazasOcupadas), 0);

      const usarEstimados = input.usarCostesEstimados || !params;

      const escenarios = [
        calcularEscenarioMejorado("5-7kg", input.numAnimales, params, plazasCeboDisponibles, preciosMercado, usarEstimados),
        calcularEscenarioMejorado("20-21kg", input.numAnimales, params, plazasCeboDisponibles, preciosMercado, usarEstimados),
        calcularEscenarioMejorado("cebo", input.numAnimales, params, plazasCeboDisponibles, preciosMercado, usarEstimados),
      ];

      // Generar recomendación detallada
      const recomendacion = generarRecomendacion(escenarios, plazasCeboDisponibles);

      // Estimaciones de precio futuro
      let estimaciones: Record<string, { precio: number; confianza: number; metodo: string }> = {};
      try {
        estimaciones = {
          cebado_4sem: estimarPrecioFuturo("cerdo_cebado", 4),
          cebado_8sem: estimarPrecioFuturo("cerdo_cebado", 8),
          cebado_16sem: estimarPrecioFuturo("cerdo_cebado", 16),
          lechon_4sem: estimarPrecioFuturo("lechon_20kg", 4),
        };
      } catch {
        // Silently skip if estimation fails
      }

      await logActividad({
        tipo: "calculo_realizado",
        descripcion: `Cálculo de escenarios para ${input.numAnimales} animales (costes ${usarEstimados ? "estimados" : "manuales"}). Recomendado: ${recomendacion.escenarioRecomendado}`,
        modulo: "calculadora",
        userId: ctx.user.id,
      });

      // Guardar automáticamente en historial
      try {
        const e57 = escenarios.find(e => e.escenario === "5-7kg");
        const e2021 = escenarios.find(e => e.escenario === "20-21kg");
        const eCebo = escenarios.find(e => e.escenario === "cebo");
        await createHistorialCalculo({
          userId: ctx.user.id,
          numAnimales: input.numAnimales,
          usaCostesEstimados: usarEstimados ? 1 : 0,
          e57_precioKg: e57?.precioVenta?.toString() || null,
          e57_ingresosPorAnimal: e57?.ingresosPorAnimal?.toString() || null,
          e57_costeTotalPorAnimal: e57?.costeTotalPorAnimal?.toString() || null,
          e57_margenPorAnimal: e57?.margenPorAnimal?.toString() || null,
          e57_margenTotal: e57?.margenTotal?.toString() || null,
          e57_margenPorPlazaDia: e57?.margenPorPlazaDia?.toString() || null,
          e57_rentabilidadPct: e57?.rentabilidadPct?.toString() || null,
          e57_mortalidadPct: e57?.mortalidadPct?.toString() || null,
          e57_viable: e57?.viable ? 1 : 0,
          e2021_precioKg: e2021?.precioVenta?.toString() || null,
          e2021_ingresosPorAnimal: e2021?.ingresosPorAnimal?.toString() || null,
          e2021_costeTotalPorAnimal: e2021?.costeTotalPorAnimal?.toString() || null,
          e2021_margenPorAnimal: e2021?.margenPorAnimal?.toString() || null,
          e2021_margenTotal: e2021?.margenTotal?.toString() || null,
          e2021_margenPorPlazaDia: e2021?.margenPorPlazaDia?.toString() || null,
          e2021_rentabilidadPct: e2021?.rentabilidadPct?.toString() || null,
          e2021_mortalidadPct: e2021?.mortalidadPct?.toString() || null,
          e2021_viable: e2021?.viable ? 1 : 0,
          eCebo_precioKg: eCebo?.precioVenta?.toString() || null,
          eCebo_ingresosPorAnimal: eCebo?.ingresosPorAnimal?.toString() || null,
          eCebo_costeTotalPorAnimal: eCebo?.costeTotalPorAnimal?.toString() || null,
          eCebo_margenPorAnimal: eCebo?.margenPorAnimal?.toString() || null,
          eCebo_margenTotal: eCebo?.margenTotal?.toString() || null,
          eCebo_margenPorPlazaDia: eCebo?.margenPorPlazaDia?.toString() || null,
          eCebo_rentabilidadPct: eCebo?.rentabilidadPct?.toString() || null,
          eCebo_mortalidadPct: eCebo?.mortalidadPct?.toString() || null,
          eCebo_viable: eCebo?.viable ? 1 : 0,
          escenarioRecomendado: recomendacion.escenarioRecomendado,
          confianzaRecomendacion: recomendacion.confianza?.toString() || null,
          precioMercadoCebado: preciosMercado.cebado?.toString() || null,
          precioMercadoLechon20: preciosMercado.lechon20?.toString() || null,
          precioMercadoLechon7: preciosMercado.lechon7?.toString() || null,
        } as any);
      } catch (err) {
        console.warn("[Historial] Error guardando cálculo:", err);
      }

      return {
        escenarios,
        recomendacion,
        plazasCeboDisponibles,
        estimaciones,
        usaCostesEstimados: usarEstimados,
        costesEstandar: usarEstimados ? COSTES_ESTANDAR : null,
      };
    }),
});
