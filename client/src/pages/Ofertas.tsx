import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus,
  FileText,
  Eye,
  Send,
  Download,
  Pencil,
  Trash2,
  Mail,
} from "lucide-react";

const ESTADO_OFERTA_LABELS: Record<string, string> = {
  borrador: "Borrador",
  enviada: "Enviada",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  expirada: "Expirada",
};

const ESTADO_OFERTA_COLORS: Record<string, string> = {
  borrador: "bg-gray-100 text-gray-700",
  enviada: "bg-blue-100 text-blue-700",
  aceptada: "bg-green-100 text-green-700",
  rechazada: "bg-red-100 text-red-700",
  expirada: "bg-amber-100 text-amber-700",
};

const ESCENARIO_LABELS: Record<string, string> = {
  "5-7kg": "Lechones 5-7 kg",
  "20-21kg": "Transición 20-21 kg",
  cebo: "Cebo Final",
};

function NuevaOfertaForm({
  onSubmit,
  loading,
  clientes,
  lotes,
}: {
  onSubmit: (data: any) => void;
  loading: boolean;
  clientes: any[];
  lotes: any[];
}) {
  const [form, setForm] = useState({
    clienteId: "",
    loteId: "",
    escenario: "5-7kg",
    numAnimales: "",
    pesoEstimado: "6",
    precioKg: "10.20",
    condiciones: "",
  });

  // Determinar si el precio es por unidad o por kg
  const esPorUnidad = form.escenario === "5-7kg" || form.escenario === "20-21kg";

  // Auto-adjust peso and precio based on escenario
  // Lechones 5-7kg y 20kg: precio POR UNIDAD
  // Cebo: precio POR KG VIVO
  const handleEscenarioChange = (v: string) => {
    let peso = "6";
    let precio = "10.20"; // €/unidad para 5-7kg
    if (v === "20-21kg") { peso = "20.5"; precio = "17.00"; } // €/unidad
    else if (v === "cebo") { peso = "105"; precio = "1.00"; } // €/kg vivo
    setForm({ ...form, escenario: v, pesoEstimado: peso, precioKg: precio });
  };

  // Cálculo del precio total:
  // Lechones (5-7kg, 20-21kg): precio es POR UNIDAD, no se multiplica por peso
  // Cebo: precio es POR KG VIVO, se multiplica por peso
  const precioTotal = esPorUnidad
    ? (parseFloat(form.precioKg || "0") * parseInt(form.numAnimales || "0")).toFixed(2)
    : (parseFloat(form.pesoEstimado || "0") * parseFloat(form.precioKg || "0") * parseInt(form.numAnimales || "0")).toFixed(2);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Cliente *</Label>
          <Select
            value={form.clienteId}
            onValueChange={(v) => setForm({ ...form, clienteId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar cliente" />
            </SelectTrigger>
            <SelectContent>
              {clientes.map((c) => (
                <SelectItem key={c.id} value={c.id.toString()}>
                  {c.nombre} {c.empresa ? `(${c.empresa})` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Lote (opcional)</Label>
          <Select
            value={form.loteId}
            onValueChange={(v) => setForm({ ...form, loteId: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin lote asociado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin lote</SelectItem>
              {lotes.map((l) => (
                <SelectItem key={l.id} value={l.id.toString()}>
                  {l.codigo} ({l.numAnimales} animales)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <Label>Escenario</Label>
          <Select value={form.escenario} onValueChange={handleEscenarioChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5-7kg">5-7 kg</SelectItem>
              <SelectItem value="20-21kg">20-21 kg</SelectItem>
              <SelectItem value="cebo">Cebo Final</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Nº Animales</Label>
          <Input
            type="number"
            value={form.numAnimales}
            onChange={(e) => setForm({ ...form, numAnimales: e.target.value })}
            placeholder="0"
          />
        </div>
        <div className="space-y-2">
          <Label>Peso est. (kg)</Label>
          <Input
            type="number"
            step="0.1"
            value={form.pesoEstimado}
            onChange={(e) => setForm({ ...form, pesoEstimado: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>{esPorUnidad ? "Precio (€/unidad)" : "Precio (€/kg vivo)"}</Label>
          <Input
            type="number"
            step="0.01"
            value={form.precioKg}
            onChange={(e) => setForm({ ...form, precioKg: e.target.value })}
          />
        </div>
      </div>
      <div className="bg-primary/5 rounded-lg p-3 text-center">
        <p className="text-sm text-muted-foreground">Precio total estimado</p>
        <p className="text-2xl font-bold text-primary">
          {parseFloat(precioTotal).toLocaleString("es-ES", {
            minimumFractionDigits: 2,
          })}{" "}
          €
        </p>
      </div>
      <div className="space-y-2">
        <Label>Condiciones (opcional)</Label>
        <Textarea
          value={form.condiciones}
          onChange={(e) => setForm({ ...form, condiciones: e.target.value })}
          placeholder="Ej: Transporte incluido, pago a 30 días..."
          rows={2}
        />
      </div>
      <Button
        onClick={() =>
          onSubmit({
            clienteId: parseInt(form.clienteId),
            loteId:
              form.loteId && form.loteId !== "none"
                ? parseInt(form.loteId)
                : undefined,
            escenario: form.escenario,
            numAnimales: parseInt(form.numAnimales) || 0,
            pesoEstimado: form.pesoEstimado,
            precioKg: form.precioKg,
            condiciones: form.condiciones || undefined,
          })
        }
        disabled={loading || !form.clienteId || !form.numAnimales}
        className="w-full"
      >
        Generar Oferta
      </Button>
    </div>
  );
}

function PreviewDialog({
  ofertaId,
  open,
  onClose,
}: {
  ofertaId: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const emailHtmlQuery = trpc.ofertas.getEmailHtml.useQuery(
    { id: ofertaId! },
    { enabled: !!ofertaId && open }
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Vista Previa de la Oferta</DialogTitle>
        </DialogHeader>
        {emailHtmlQuery.isLoading ? (
          <Skeleton className="h-96" />
        ) : emailHtmlQuery.data?.html ? (
          <div className="overflow-auto max-h-[60vh] border rounded-lg">
            <iframe
              srcDoc={emailHtmlQuery.data.html}
              className="w-full h-[500px] border-0"
              title="Preview"
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">
            No se pudo cargar la vista previa
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function OfertasPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewId, setPreviewId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const ofertasQuery = trpc.ofertas.list.useQuery();
  const clientesQuery = trpc.crm.list.useQuery();
  const lotesQuery = trpc.lotes.list.useQuery();

  const clientes = clientesQuery.data || [];
  const lotes = lotesQuery.data || [];
  const clientesMap: Record<number, string> = {};
  clientes.forEach((c) => (clientesMap[c.id] = c.nombre));

  const createMutation = trpc.ofertas.create.useMutation({
    onSuccess: () => {
      utils.ofertas.list.invalidate();
      setDialogOpen(false);
      toast.success("Oferta generada correctamente");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.ofertas.update.useMutation({
    onSuccess: () => {
      utils.ofertas.list.invalidate();
      toast.success("Oferta actualizada");
    },
    onError: (e) => toast.error(e.message),
  });

  const generatePdfMutation = trpc.ofertas.generatePdf.useMutation({
    onSuccess: (data) => {
      utils.ofertas.list.invalidate();
      toast.success("Documento generado y almacenado");
      window.open(data.url, "_blank");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.ofertas.delete.useMutation({
    onSuccess: () => {
      utils.ofertas.list.invalidate();
      toast.success("Oferta eliminada");
    },
    onError: (e) => toast.error(e.message),
  });

  if (ofertasQuery.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const ofertasData = ofertasQuery.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ofertas Comerciales</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Generación automática y seguimiento de ofertas
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva oferta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Generar Nueva Oferta</DialogTitle>
            </DialogHeader>
            <NuevaOfertaForm
              onSubmit={(data) => createMutation.mutate(data)}
              loading={createMutation.isPending}
              clientes={clientes}
              lotes={lotes}
            />
          </DialogContent>
        </Dialog>
      </div>

      {ofertasData.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="font-medium text-lg">No hay ofertas generadas</p>
            <p className="text-sm mt-2">
              Cree su primera oferta comercial para un cliente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Escenario</TableHead>
                  <TableHead className="text-center">Animales</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ofertasData.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-sm font-medium">
                      {o.codigo}
                    </TableCell>
                    <TableCell>
                      {clientesMap[o.clienteId] || `ID ${o.clienteId}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {ESCENARIO_LABELS[o.escenario] || o.escenario}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {o.numAnimales}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {parseFloat(o.precioTotal).toLocaleString("es-ES", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      €
                    </TableCell>
                    <TableCell className="text-center">
                      <Select
                        value={o.estado}
                        onValueChange={(v) =>
                          updateMutation.mutate({
                            id: o.id,
                            estado: v as any,
                          })
                        }
                      >
                        <SelectTrigger className="h-7 w-[130px] text-xs">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${ESTADO_OFERTA_COLORS[o.estado] || ""}`}
                          >
                            {ESTADO_OFERTA_LABELS[o.estado] || o.estado}
                          </span>
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ESTADO_OFERTA_LABELS).map(
                            ([k, v]) => (
                              <SelectItem key={k} value={k}>
                                {v}
                              </SelectItem>
                            )
                          )}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {o.createdAt
                        ? new Date(o.createdAt).toLocaleDateString("es-ES")
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setPreviewId(o.id)}
                          title="Vista previa"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => generatePdfMutation.mutate({ id: o.id })}
                          title="Generar documento"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => {
                            if (confirm("¿Eliminar esta oferta?"))
                              deleteMutation.mutate({ id: o.id });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <PreviewDialog
        ofertaId={previewId}
        open={!!previewId}
        onClose={() => setPreviewId(null)}
      />
    </div>
  );
}
