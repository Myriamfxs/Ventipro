import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Star,
  Settings,
  Info,
  BarChart3,
  Target,
  Lightbulb,
  ArrowRight,
  Minus,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

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
  precioVenta: number;
  unidadPrecio: string;
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

type ResultadosCalculo = {
  escenarios: EscenarioResult[];
  recomendacion: Recomendacion;
  plazasCeboDisponibles: number;
  estimaciones: Record<string, { precio: number; confianza: number; metodo: string }>;
  usaCostesEstimados: boolean;
  costesEstandar: any;
};

const PIE_COLORS = ["#16a34a", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function EscenarioCard({ esc, isRecomendado }: { esc: EscenarioResult; isRecomendado: boolean }) {
  const [showDesglose, setShowDesglose] = useState(false);

  const pieData = [
    { name: "Pienso", value: esc.desgloseCostes.costePiensoTotal },
    { name: "Sanidad", value: esc.desgloseCostes.costeSanidadTotal },
    { name: "Fijos", value: esc.desgloseCostes.costeFijosTotal },
    { name: "Mortalidad", value: esc.desgloseCostes.mortalidadCoste },
  ].filter(d => d.value > 0);

  return (
    <Card className={`relative transition-shadow hover:shadow-lg ${isRecomendado ? "ring-2 ring-primary shadow-md" : ""} ${!esc.viable ? "opacity-60" : ""}`}>
      {isRecomendado && (
        <div className="absolute -top-3 left-4">
          <Badge className="bg-primary text-primary-foreground shadow-sm">
            <Star className="h-3 w-3 mr-1" />
            Recomendado
          </Badge>
        </div>
      )}
      <CardHeader className="pb-3 pt-5">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{esc.nombre}</CardTitle>
          {esc.viable ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-destructive" />
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <Badge variant="outline" className="text-xs">{esc.precioFuente}</Badge>
          {esc.usaCostesEstimados && <Badge variant="secondary" className="text-xs">Costes estimados</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!esc.viable && (
          <div className="text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">{esc.razonNoViable}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Ingresos/animal</p>
            <p className="text-lg font-bold text-green-700">{esc.ingresosPorAnimal.toFixed(2)} €</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Coste/animal</p>
            <p className="text-lg font-bold text-red-700">{esc.costeTotalPorAnimal.toFixed(2)} €</p>
          </div>
        </div>

        <div className={`text-center p-3 rounded-lg ${esc.margenPorAnimal >= 0 ? "bg-emerald-50" : "bg-red-50"}`}>
          <p className="text-xs text-muted-foreground">Margen Total</p>
          <p className={`text-2xl font-bold ${esc.margenTotal >= 0 ? "text-emerald-700" : "text-red-700"}`}>
            {esc.margenTotal.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Rentabilidad: <span className="font-semibold">{esc.rentabilidadPct.toFixed(1)}%</span>
          </p>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Margen/animal</span>
            <span className={`font-semibold ${esc.margenPorAnimal >= 0 ? "text-green-700" : "text-red-700"}`}>
              {esc.margenPorAnimal.toFixed(2)} €
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Margen/plaza/día</span>
            <span className="font-semibold">{esc.margenPorPlazaDia.toFixed(2)} €</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Días de ocupación</span>
            <span>{esc.diasOcupacion} días</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mortalidad acumulada</span>
            <span>{esc.mortalidadPct.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Animales finales</span>
            <span>{esc.animalesFinales}</span>
          </div>
        </div>

        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => setShowDesglose(!showDesglose)}>
          {showDesglose ? "Ocultar desglose" : "Ver desglose de costes"}
        </Button>

        {showDesglose && (
          <div className="space-y-3 border-t pt-3">
            {/* Desglose por fases */}
            <p className="text-xs font-semibold text-muted-foreground">Coste por fase (€/animal)</p>
            {esc.desgloseCostes.costeFaseCria > 0 && (
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-blue-500" /> Cría (0-7kg)</span>
                <span>{esc.desgloseCostes.costeFaseCria.toFixed(2)} €</span>
              </div>
            )}
            {esc.desgloseCostes.costeFaseTransicion > 0 && (
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /> Transición (7-21kg)</span>
                <span>{esc.desgloseCostes.costeFaseTransicion.toFixed(2)} €</span>
              </div>
            )}
            {esc.desgloseCostes.costeFaseCebo > 0 && (
              <div className="flex justify-between text-xs">
                <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Cebo (21-110kg)</span>
                <span>{esc.desgloseCostes.costeFaseCebo.toFixed(2)} €</span>
              </div>
            )}

            {/* Mini pie chart */}
            <div className="flex justify-center">
              <ResponsiveContainer width={160} height={120}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={25} outerRadius={50} dataKey="value" label={false}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toFixed(2)} €`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-1 text-xs text-muted-foreground">
              {pieData.map((d, i) => (
                <div key={d.name} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {d.name}: {d.value.toFixed(2)} €
                </div>
              ))}
            </div>

            <div className="text-xs text-muted-foreground border-t pt-2">
              <div className="flex justify-between">
                <span>Peso venta: {esc.pesoVenta} kg</span>
                <span>Precio: {esc.precioVenta.toFixed(2)} {esc.unidadPrecio}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function CalculadoraPage() {
  const [numAnimales, setNumAnimales] = useState("500");
  const [precioVenta5_7, setPrecioVenta5_7] = useState("");
  const [precioVenta20_21, setPrecioVenta20_21] = useState("");
  const [precioVentaCebo, setPrecioVentaCebo] = useState("");
  const [usarCostesEstimados, setUsarCostesEstimados] = useState(true);
  const [resultados, setResultados] = useState<ResultadosCalculo | null>(null);

  const calcularMutation = trpc.calculadora.calcular.useMutation({
    onSuccess: (data) => {
      setResultados(data as ResultadosCalculo);
      toast.success("Cálculo completado");
    },
    onError: (e) => toast.error(e.message),
  });

  const preciosQuery = trpc.mercado.preciosActuales.useQuery(undefined, { staleTime: 300000 });

  const handleCalcular = () => {
    const input: any = {
      numAnimales: parseInt(numAnimales) || 500,
      usarCostesEstimados,
    };
    if (precioVenta5_7) input.precioVenta5_7 = precioVenta5_7;
    if (precioVenta20_21) input.precioVenta20_21 = precioVenta20_21;
    if (precioVentaCebo) input.precioVentaCebo = precioVentaCebo;
    calcularMutation.mutate(input);
  };

  const barData = useMemo(() => resultados
    ? resultados.escenarios.map((e) => ({
        name: e.escenario === "5-7kg" ? "5-7 kg" : e.escenario === "20-21kg" ? "20-21 kg" : "Cebo",
        margenTotal: e.margenTotal,
        ingresos: e.ingresosTotales,
        costes: e.costesTotales,
      }))
    : [], [resultados]);

  const radarData = useMemo(() => resultados
    ? [
        { metric: "Margen/animal", ...Object.fromEntries(resultados.escenarios.map((e) => [e.escenario, Math.max(0, e.margenPorAnimal)])) },
        { metric: "Margen/plaza/día", ...Object.fromEntries(resultados.escenarios.map((e) => [e.escenario, Math.max(0, e.margenPorPlazaDia * 100)])) },
        { metric: "Rentabilidad %", ...Object.fromEntries(resultados.escenarios.map((e) => [e.escenario, Math.max(0, e.rentabilidadPct)])) },
        { metric: "Rapidez (inv. días)", ...Object.fromEntries(resultados.escenarios.map((e) => [e.escenario, Math.round(10000 / e.diasOcupacion)])) },
      ]
    : [], [resultados]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Calculator className="h-6 w-6 text-primary" />
          Calculadora de Rentabilidad
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Compare los 3 escenarios de venta con precios de mercado actualizados y costes desglosados por fase
        </p>
      </div>

      {/* Precios de mercado actuales */}
      {preciosQuery.data && preciosQuery.data.length > 0 && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Precios de Mercado Actuales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {preciosQuery.data.map((p, i) => (
                <div key={i} className="bg-background rounded-lg p-3 border">
                  <p className="text-xs text-muted-foreground truncate">{p.producto}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-lg font-bold">{typeof p.precio === 'number' && p.precio > 10 ? p.precio.toFixed(0) : (p.precio as number).toFixed(3)}</p>
                    <span className="text-xs text-muted-foreground">{p.unidad}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    {p.tendencia === "alza" && <TrendingUp className="h-3 w-3 text-green-600" />}
                    {p.tendencia === "baja" && <TrendingDown className="h-3 w-3 text-red-600" />}
                    {p.tendencia === "estable" && <Minus className="h-3 w-3 text-gray-500" />}
                    <span className="text-xs text-muted-foreground">{p.fuente}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Input Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Parámetros de Cálculo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Nº Animales del lote</Label>
              <Input type="number" value={numAnimales} onChange={(e) => setNumAnimales(e.target.value)} placeholder="500" />
            </div>
            <div className="space-y-2">
              <Label>Precio 5-7kg (€/unidad) <span className="text-xs text-muted-foreground">opcional</span></Label>
              <Input type="number" step="0.01" value={precioVenta5_7} onChange={(e) => setPrecioVenta5_7(e.target.value)} placeholder="Auto (mercado)" />
            </div>
            <div className="space-y-2">
              <Label>Precio 20-21kg (€/unidad) <span className="text-xs text-muted-foreground">opcional</span></Label>
              <Input type="number" step="0.01" value={precioVenta20_21} onChange={(e) => setPrecioVenta20_21(e.target.value)} placeholder="Auto (mercado)" />
            </div>
            <div className="space-y-2">
              <Label>Precio Cebo (€/kg) <span className="text-xs text-muted-foreground">opcional</span></Label>
              <Input type="number" step="0.01" value={precioVentaCebo} onChange={(e) => setPrecioVentaCebo(e.target.value)} placeholder="Auto (mercado)" />
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
            <Switch checked={usarCostesEstimados} onCheckedChange={setUsarCostesEstimados} />
            <div>
              <p className="text-sm font-medium">Usar costes estándar estimados del sector</p>
              <p className="text-xs text-muted-foreground">
                {usarCostesEstimados
                  ? "Se usarán costes medios del sector porcino español desglosados por fase"
                  : "Se usarán los parámetros económicos configurados manualmente"}
              </p>
            </div>
          </div>

          <Button onClick={handleCalcular} disabled={calcularMutation.isPending} className="w-full sm:w-auto" size="lg">
            {calcularMutation.isPending ? "Calculando..." : (
              <><Calculator className="h-4 w-4 mr-2" />Calcular Escenarios</>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Results */}
      {resultados && (
        <>
          {/* Recommendation Banner */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                  <Lightbulb className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-3 flex-1">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-primary">Recomendación del Sistema</p>
                      <Badge variant="outline" className="text-xs">
                        Confianza: {(resultados.recomendacion.confianza * 100).toFixed(0)}%
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground mt-1">{resultados.recomendacion.razon}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-muted-foreground">Factores de decisión:</p>
                    {resultados.recomendacion.factores.map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <ArrowRight className="h-3 w-3 mt-0.5 text-primary shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>

                  {resultados.recomendacion.alternativa && (
                    <div className="flex items-center gap-2 text-xs bg-background/50 rounded-lg p-2">
                      <Target className="h-3 w-3 text-amber-500" />
                      <span className="text-muted-foreground">Alternativa: {resultados.recomendacion.razonAlternativa}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Info className="h-3 w-3" />
                    <span>Plazas de cebo disponibles: {resultados.plazasCeboDisponibles}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Estimaciones de precio futuro */}
          {resultados.estimaciones && Object.keys(resultados.estimaciones).length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Estimación de Precios Futuros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {resultados.estimaciones.cebado_4sem && (
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Cebado +4 sem.</p>
                      <p className="text-lg font-bold">{resultados.estimaciones.cebado_4sem.precio.toFixed(3)} €/kg</p>
                      <p className="text-xs text-muted-foreground">Conf: {(resultados.estimaciones.cebado_4sem.confianza * 100).toFixed(0)}%</p>
                    </div>
                  )}
                  {resultados.estimaciones.cebado_8sem && (
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Cebado +8 sem.</p>
                      <p className="text-lg font-bold">{resultados.estimaciones.cebado_8sem.precio.toFixed(3)} €/kg</p>
                      <p className="text-xs text-muted-foreground">Conf: {(resultados.estimaciones.cebado_8sem.confianza * 100).toFixed(0)}%</p>
                    </div>
                  )}
                  {resultados.estimaciones.cebado_16sem && (
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Cebado +16 sem.</p>
                      <p className="text-lg font-bold">{resultados.estimaciones.cebado_16sem.precio.toFixed(3)} €/kg</p>
                      <p className="text-xs text-muted-foreground">Conf: {(resultados.estimaciones.cebado_16sem.confianza * 100).toFixed(0)}%</p>
                    </div>
                  )}
                  {resultados.estimaciones.lechon_4sem && (
                    <div className="bg-muted/30 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Lechón 20kg +4 sem.</p>
                      <p className="text-lg font-bold">{resultados.estimaciones.lechon_4sem.precio.toFixed(2)} €</p>
                      <p className="text-xs text-muted-foreground">Conf: {(resultados.estimaciones.lechon_4sem.confianza * 100).toFixed(0)}%</p>
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Estimaciones basadas en media móvil ponderada + tendencia lineal + ajuste estacional. No constituyen asesoramiento financiero.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Scenario Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {resultados.escenarios.map((esc) => (
              <EscenarioCard key={esc.escenario} esc={esc} isRecomendado={esc.escenario === resultados.recomendacion.escenarioRecomendado} />
            ))}
          </div>

          {/* Charts */}
          <Tabs defaultValue="barras" className="w-full">
            <TabsList>
              <TabsTrigger value="barras">Comparativa</TabsTrigger>
              <TabsTrigger value="radar">Radar</TabsTrigger>
            </TabsList>
            <TabsContent value="barras">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Comparativa de Márgenes por Escenario</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={barData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="name" fontSize={13} />
                      <YAxis fontSize={12} tickFormatter={(v) => `${v} €`} />
                      <Tooltip formatter={(value: number) => `${value.toLocaleString("es-ES", { minimumFractionDigits: 2 })} €`} />
                      <Legend />
                      <Bar dataKey="ingresos" fill="#16a34a" name="Ingresos" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="costes" fill="#ef4444" name="Costes" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="margenTotal" fill="#3b82f6" name="Margen" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="radar">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Análisis Multidimensional</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="metric" fontSize={11} />
                      <PolarRadiusAxis fontSize={10} />
                      <Radar name="5-7 kg" dataKey="5-7kg" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.15} />
                      <Radar name="20-21 kg" dataKey="20-21kg" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} />
                      <Radar name="Cebo" dataKey="cebo" stroke="#16a34a" fill="#16a34a" fillOpacity={0.15} />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
