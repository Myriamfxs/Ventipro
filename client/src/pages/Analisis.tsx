import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3, TrendingUp, TrendingDown, Calendar, Target, Award, AlertTriangle,
  ArrowUpRight, ArrowDownRight, Minus, History, PiggyBank, LineChart as LineChartIcon,
  Table2, RefreshCw, Info,
} from "lucide-react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Area, AreaChart, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Radar,
} from "recharts";
import { useState, useMemo } from "react";

const ESCENARIO_COLORS = {
  "5-7kg": "#10b981",
  "20-21kg": "#3b82f6",
  "cebo": "#f59e0b",
};

const ESCENARIO_LABELS: Record<string, string> = {
  "5-7kg": "Lechón 5-7 kg",
  "20-21kg": "Transición 20-21 kg",
  "cebo": "Cebo Final",
};

const METRICA_LABELS: Record<string, string> = {
  margenTotal: "Margen Total (€)",
  margenPorAnimal: "Margen por Animal (€)",
  margenPorPlazaDia: "Margen por Plaza/Día (€)",
  rentabilidadPct: "Rentabilidad (%)",
  precioKg: "Precio de Venta (€)",
};

function formatCurrency(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === null || num === undefined || isNaN(num)) return "—";
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(num);
}

function formatPct(value: number | string | null | undefined): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (num === null || num === undefined || isNaN(num)) return "—";
  return `${num.toFixed(1)}%`;
}

function formatDate(date: string | Date | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" });
}

function formatShortDate(date: string): string {
  const d = new Date(date);
  return d.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
}

function TrendIcon({ value }: { value: number }) {
  if (value > 0) return <ArrowUpRight className="h-4 w-4 text-green-600" />;
  if (value < 0) return <ArrowDownRight className="h-4 w-4 text-red-600" />;
  return <Minus className="h-4 w-4 text-muted-foreground" />;
}

export default function AnalisisPage() {
  const [metrica, setMetrica] = useState("margenTotal");
  const [meses, setMeses] = useState(6);
  const [filtroEscenario, setFiltroEscenario] = useState("todos");

  const { data: historial, isLoading: loadingHistorial } = trpc.analisis.historial.useQuery({
    escenarioRecomendado: filtroEscenario !== "todos" ? filtroEscenario : undefined,
    limit: 200,
  });

  const { data: stats, isLoading: loadingStats } = trpc.analisis.stats.useQuery();

  const { data: evolucion, isLoading: loadingEvolucion } = trpc.analisis.evolucionTemporal.useQuery({
    meses,
    metrica: metrica as any,
  });

  // Preparar datos para la tabla comparativa
  const tablaData = useMemo(() => {
    if (!historial) return [];
    return historial.map((c) => ({
      id: c.id,
      fecha: c.createdAt,
      animales: c.numAnimales,
      costes: c.usaCostesEstimados ? "Estimados" : "Manuales",
      recomendado: c.escenarioRecomendado,
      confianza: c.confianzaRecomendacion,
      // 5-7kg
      m57_margen: c.e57_margenTotal,
      m57_rentabilidad: c.e57_rentabilidadPct,
      m57_plazaDia: c.e57_margenPorPlazaDia,
      m57_precio: c.e57_precioKg,
      // 20-21kg
      m2021_margen: c.e2021_margenTotal,
      m2021_rentabilidad: c.e2021_rentabilidadPct,
      m2021_plazaDia: c.e2021_margenPorPlazaDia,
      m2021_precio: c.e2021_precioKg,
      // Cebo
      mCebo_margen: c.eCebo_margenTotal,
      mCebo_rentabilidad: c.eCebo_rentabilidadPct,
      mCebo_plazaDia: c.eCebo_margenPorPlazaDia,
      mCebo_precio: c.eCebo_precioKg,
      // Mercado
      precioCebado: c.precioMercadoCebado,
      precioLechon20: c.precioMercadoLechon20,
    }));
  }, [historial]);

  // Preparar datos para el radar chart (último cálculo)
  const radarData = useMemo(() => {
    if (!historial || historial.length === 0) return [];
    const ultimo = historial[0];
    return [
      {
        metrica: "Margen/Animal",
        "5-7kg": Math.max(0, parseFloat(ultimo.e57_margenPorAnimal || "0")),
        "20-21kg": Math.max(0, parseFloat(ultimo.e2021_margenPorAnimal || "0")),
        "cebo": Math.max(0, parseFloat(ultimo.eCebo_margenPorAnimal || "0")),
      },
      {
        metrica: "Rentabilidad",
        "5-7kg": Math.max(0, parseFloat(ultimo.e57_rentabilidadPct || "0")),
        "20-21kg": Math.max(0, parseFloat(ultimo.e2021_rentabilidadPct || "0")),
        "cebo": Math.max(0, parseFloat(ultimo.eCebo_rentabilidadPct || "0")),
      },
      {
        metrica: "€/Plaza/Día",
        "5-7kg": Math.max(0, parseFloat(ultimo.e57_margenPorPlazaDia || "0") * 100),
        "20-21kg": Math.max(0, parseFloat(ultimo.e2021_margenPorPlazaDia || "0") * 100),
        "cebo": Math.max(0, parseFloat(ultimo.eCebo_margenPorPlazaDia || "0") * 100),
      },
      {
        metrica: "Viabilidad",
        "5-7kg": ultimo.e57_viable ? 100 : 0,
        "20-21kg": ultimo.e2021_viable ? 100 : 0,
        "cebo": ultimo.eCebo_viable ? 100 : 0,
      },
    ];
  }, [historial]);

  // Datos para el gráfico de barras comparativo (últimos 10 cálculos)
  const barrasData = useMemo(() => {
    if (!historial) return [];
    return historial.slice(0, 10).reverse().map((c, i) => ({
      nombre: `#${historial.length - historial.slice(0, 10).length + i + 1}`,
      fecha: formatShortDate(c.createdAt as any),
      "5-7kg": parseFloat(c.e57_margenTotal || "0"),
      "20-21kg": parseFloat(c.e2021_margenTotal || "0"),
      "cebo": parseFloat(c.eCebo_margenTotal || "0"),
    }));
  }, [historial]);

  const isLoading = loadingHistorial || loadingStats || loadingEvolucion;
  const hasData = historial && historial.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-green-700" />
            Análisis Histórico
          </h1>
          <p className="text-muted-foreground mt-1">
            Compara la rentabilidad de tus cálculos a lo largo del tiempo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={meses.toString()} onValueChange={(v) => setMeses(parseInt(v))}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Último mes</SelectItem>
              <SelectItem value="3">3 meses</SelectItem>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroEscenario} onValueChange={setFiltroEscenario}>
            <SelectTrigger className="w-[160px]">
              <Target className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="5-7kg">Lechón 5-7 kg</SelectItem>
              <SelectItem value="20-21kg">Transición 20-21 kg</SelectItem>
              <SelectItem value="cebo">Cebo Final</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Cálculos</p>
                <p className="text-3xl font-bold text-green-800">{stats?.totalCalculos || 0}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.ultimoCalculo ? `Último: ${formatDate(stats.ultimoCalculo)}` : "Sin cálculos aún"}
                </p>
              </div>
              <History className="h-10 w-10 text-green-600/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Mejor Margen</p>
                <p className="text-3xl font-bold text-blue-800">
                  {stats?.mejorMargen ? formatCurrency(stats.mejorMargen.margen) : "—"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.mejorMargen ? `${stats.mejorMargen.numAnimales} animales · ${ESCENARIO_LABELS[stats.mejorMargen.escenario || ""] || ""}` : "Sin datos"}
                </p>
              </div>
              <Award className="h-10 w-10 text-blue-600/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Media Margen 5-7kg</p>
                <p className="text-3xl font-bold text-amber-800">{formatCurrency(stats?.mediaMargen57)}</p>
                <p className="text-xs text-muted-foreground mt-1">Promedio histórico</p>
              </div>
              <PiggyBank className="h-10 w-10 text-amber-600/30" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Media Margen Cebo</p>
                <p className="text-3xl font-bold text-purple-800">{formatCurrency(stats?.mediaMargenCebo)}</p>
                <p className="text-xs text-muted-foreground mt-1">Promedio histórico</p>
              </div>
              <TrendingUp className="h-10 w-10 text-purple-600/30" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Empty state */}
      {!isLoading && !hasData && (
        <Card className="border-dashed">
          <CardContent className="py-16 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-lg">Sin datos históricos</h3>
              <p className="text-muted-foreground mt-1 max-w-md">
                Los cálculos realizados en la Calculadora de Rentabilidad se guardan automáticamente aquí.
                Realiza tu primer cálculo para empezar a ver tendencias y comparativas.
              </p>
            </div>
            <Button
              variant="default"
              className="bg-green-700 hover:bg-green-800"
              onClick={() => window.location.href = "/calculadora"}
            >
              Ir a la Calculadora
            </Button>
          </CardContent>
        </Card>
      )}

      {hasData && (
        <Tabs defaultValue="evolucion" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="evolucion" className="gap-2">
              <LineChartIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Evolución</span>
            </TabsTrigger>
            <TabsTrigger value="comparativa" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Comparativa</span>
            </TabsTrigger>
            <TabsTrigger value="radar" className="gap-2">
              <Target className="h-4 w-4" />
              <span className="hidden sm:inline">Radar</span>
            </TabsTrigger>
            <TabsTrigger value="tabla" className="gap-2">
              <Table2 className="h-4 w-4" />
              <span className="hidden sm:inline">Detalle</span>
            </TabsTrigger>
          </TabsList>

          {/* Tab: Evolución Temporal */}
          <TabsContent value="evolucion" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">Evolución Temporal</CardTitle>
                    <CardDescription>
                      Tendencia de {METRICA_LABELS[metrica]?.toLowerCase() || metrica} por escenario
                    </CardDescription>
                  </div>
                  <Select value={metrica} onValueChange={setMetrica}>
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(METRICA_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {evolucion && evolucion.length > 0 ? (
                  <ResponsiveContainer width="100%" height={380}>
                    <AreaChart data={evolucion} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="color57" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={ESCENARIO_COLORS["5-7kg"]} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={ESCENARIO_COLORS["5-7kg"]} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="color2021" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={ESCENARIO_COLORS["20-21kg"]} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={ESCENARIO_COLORS["20-21kg"]} stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorCebo" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={ESCENARIO_COLORS["cebo"]} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={ESCENARIO_COLORS["cebo"]} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="fecha" tickFormatter={formatShortDate} className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        formatter={(value: number) => {
                          if (metrica === "rentabilidadPct") return formatPct(value);
                          return formatCurrency(value);
                        }}
                        labelFormatter={(label) => formatDate(label)}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                      />
                      <Legend />
                      <Area type="monotone" dataKey="5-7kg" name="Lechón 5-7 kg" stroke={ESCENARIO_COLORS["5-7kg"]} fill="url(#color57)" strokeWidth={2} connectNulls />
                      <Area type="monotone" dataKey="20-21kg" name="Transición 20-21 kg" stroke={ESCENARIO_COLORS["20-21kg"]} fill="url(#color2021)" strokeWidth={2} connectNulls />
                      <Area type="monotone" dataKey="cebo" name="Cebo Final" stroke={ESCENARIO_COLORS["cebo"]} fill="url(#colorCebo)" strokeWidth={2} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[380px] text-muted-foreground">
                    <div className="text-center">
                      <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>No hay datos suficientes para mostrar la evolución en este período</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Comparativa de Barras */}
          <TabsContent value="comparativa" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Comparativa de Últimos Cálculos</CardTitle>
                <CardDescription>Margen total por escenario en los últimos 10 cálculos realizados</CardDescription>
              </CardHeader>
              <CardContent>
                {barrasData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={380}>
                    <BarChart data={barrasData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="fecha" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }}
                      />
                      <Legend />
                      <Bar dataKey="5-7kg" name="Lechón 5-7 kg" fill={ESCENARIO_COLORS["5-7kg"]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="20-21kg" name="Transición 20-21 kg" fill={ESCENARIO_COLORS["20-21kg"]} radius={[4, 4, 0, 0]} />
                      <Bar dataKey="cebo" name="Cebo Final" fill={ESCENARIO_COLORS["cebo"]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[380px] text-muted-foreground">
                    Realiza cálculos para ver la comparativa
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Radar */}
          <TabsContent value="radar" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Perfil de Escenarios (Último Cálculo)</CardTitle>
                <CardDescription>Comparativa multidimensional del último cálculo realizado</CardDescription>
              </CardHeader>
              <CardContent>
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metrica" className="text-xs" />
                      <PolarRadiusAxis className="text-xs" />
                      <Radar name="Lechón 5-7 kg" dataKey="5-7kg" stroke={ESCENARIO_COLORS["5-7kg"]} fill={ESCENARIO_COLORS["5-7kg"]} fillOpacity={0.2} strokeWidth={2} />
                      <Radar name="Transición 20-21 kg" dataKey="20-21kg" stroke={ESCENARIO_COLORS["20-21kg"]} fill={ESCENARIO_COLORS["20-21kg"]} fillOpacity={0.2} strokeWidth={2} />
                      <Radar name="Cebo Final" dataKey="cebo" stroke={ESCENARIO_COLORS["cebo"]} fill={ESCENARIO_COLORS["cebo"]} fillOpacity={0.2} strokeWidth={2} />
                      <Legend />
                      <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb" }} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                    Sin datos para el radar
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Tabla Detallada */}
          <TabsContent value="tabla" className="space-y-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Historial Detallado de Cálculos</CardTitle>
                <CardDescription>Todos los cálculos realizados con métricas por escenario</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium text-muted-foreground sticky left-0 bg-muted/50">Fecha</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Animales</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Costes</th>
                        <th className="text-center p-3 font-medium" style={{ color: ESCENARIO_COLORS["5-7kg"] }}>5-7kg Margen</th>
                        <th className="text-center p-3 font-medium" style={{ color: ESCENARIO_COLORS["5-7kg"] }}>5-7kg Rent.</th>
                        <th className="text-center p-3 font-medium" style={{ color: ESCENARIO_COLORS["20-21kg"] }}>20-21kg Margen</th>
                        <th className="text-center p-3 font-medium" style={{ color: ESCENARIO_COLORS["20-21kg"] }}>20-21kg Rent.</th>
                        <th className="text-center p-3 font-medium" style={{ color: ESCENARIO_COLORS["cebo"] }}>Cebo Margen</th>
                        <th className="text-center p-3 font-medium" style={{ color: ESCENARIO_COLORS["cebo"] }}>Cebo Rent.</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Recomendado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tablaData.map((row) => (
                        <tr key={row.id} className="border-b hover:bg-muted/30 transition-colors">
                          <td className="p-3 font-medium sticky left-0 bg-background">{formatDate(row.fecha)}</td>
                          <td className="p-3 text-center">{row.animales}</td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className="text-xs">{row.costes}</Badge>
                          </td>
                          <td className="p-3 text-center font-mono text-sm">
                            <span className={parseFloat(row.m57_margen || "0") >= 0 ? "text-green-700" : "text-red-600"}>
                              {formatCurrency(row.m57_margen)}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono text-sm">{formatPct(row.m57_rentabilidad)}</td>
                          <td className="p-3 text-center font-mono text-sm">
                            <span className={parseFloat(row.m2021_margen || "0") >= 0 ? "text-green-700" : "text-red-600"}>
                              {formatCurrency(row.m2021_margen)}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono text-sm">{formatPct(row.m2021_rentabilidad)}</td>
                          <td className="p-3 text-center font-mono text-sm">
                            <span className={parseFloat(row.mCebo_margen || "0") >= 0 ? "text-green-700" : "text-red-600"}>
                              {formatCurrency(row.mCebo_margen)}
                            </span>
                          </td>
                          <td className="p-3 text-center font-mono text-sm">{formatPct(row.mCebo_rentabilidad)}</td>
                          <td className="p-3 text-center">
                            {row.recomendado && (
                              <Badge
                                className="text-xs text-white"
                                style={{ backgroundColor: ESCENARIO_COLORS[row.recomendado as keyof typeof ESCENARIO_COLORS] || "#6b7280" }}
                              >
                                {ESCENARIO_LABELS[row.recomendado] || row.recomendado}
                              </Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                      {tablaData.length === 0 && (
                        <tr>
                          <td colSpan={10} className="p-8 text-center text-muted-foreground">
                            No hay cálculos en el historial
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Resumen de medias por escenario */}
      {hasData && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-l-4" style={{ borderLeftColor: ESCENARIO_COLORS["5-7kg"] }}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Lechón 5-7 kg</h3>
                <Badge variant="outline" className="text-xs" style={{ color: ESCENARIO_COLORS["5-7kg"], borderColor: ESCENARIO_COLORS["5-7kg"] }}>
                  Promedio
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Margen total medio</span>
                  <span className="font-mono font-medium">{formatCurrency(stats?.mediaMargen57)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cálculos realizados</span>
                  <span className="font-mono font-medium">{stats?.totalCalculos || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4" style={{ borderLeftColor: ESCENARIO_COLORS["20-21kg"] }}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Transición 20-21 kg</h3>
                <Badge variant="outline" className="text-xs" style={{ color: ESCENARIO_COLORS["20-21kg"], borderColor: ESCENARIO_COLORS["20-21kg"] }}>
                  Promedio
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Margen total medio</span>
                  <span className="font-mono font-medium">{formatCurrency(stats?.mediaMargen2021)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cálculos realizados</span>
                  <span className="font-mono font-medium">{stats?.totalCalculos || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4" style={{ borderLeftColor: ESCENARIO_COLORS["cebo"] }}>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Cebo Final</h3>
                <Badge variant="outline" className="text-xs" style={{ color: ESCENARIO_COLORS["cebo"], borderColor: ESCENARIO_COLORS["cebo"] }}>
                  Promedio
                </Badge>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Margen total medio</span>
                  <span className="font-mono font-medium">{formatCurrency(stats?.mediaMargenCebo)}</span>
                </div>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cálculos realizados</span>
                  <span className="font-mono font-medium">{stats?.totalCalculos || 0}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
