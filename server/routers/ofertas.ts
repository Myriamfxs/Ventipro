import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getOfertas, getOfertaById, createOferta, updateOferta, deleteOferta, getOfertasByCliente, getOfertasByLote, getClienteById, getLoteById, logActividad } from "../db";
import { invokeLLM } from "../_core/llm";
import { notifyOwner } from "../_core/notification";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";

function generarCodigoOferta(): string {
  const now = new Date();
  const year = now.getFullYear().toString().slice(-2);
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  return `VP-${year}${month}-${nanoid(6).toUpperCase()}`;
}

function generarHtmlOferta(oferta: any, cliente: any, lote: any): string {
  const escenarioLabel = oferta.escenario === "5-7kg" ? "Lechones 5-7 kg"
    : oferta.escenario === "20-21kg" ? "Transición 20-21 kg"
    : "Cebo Final 100-110 kg";

  return `
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"><style>
  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; background: #f8faf8; }
  .container { max-width: 680px; margin: 0 auto; background: #fff; }
  .header { background: linear-gradient(135deg, #166534, #15803d); padding: 40px 32px; text-align: center; }
  .header h1 { color: #fff; font-size: 28px; margin: 0 0 8px; font-weight: 700; }
  .header p { color: #bbf7d0; font-size: 14px; margin: 0; }
  .body { padding: 32px; }
  .greeting { font-size: 16px; color: #1f2937; margin-bottom: 20px; line-height: 1.6; }
  .offer-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 24px; margin: 24px 0; }
  .offer-box h3 { color: #166534; margin: 0 0 16px; font-size: 18px; }
  .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #dcfce7; }
  .detail-label { color: #6b7280; font-size: 14px; }
  .detail-value { color: #1f2937; font-weight: 600; font-size: 14px; }
  .total-row { display: flex; justify-content: space-between; padding: 16px 0 0; margin-top: 8px; }
  .total-label { color: #166534; font-size: 18px; font-weight: 700; }
  .total-value { color: #166534; font-size: 22px; font-weight: 800; }
  .conditions { background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin: 20px 0; font-size: 13px; color: #92400e; }
  .footer { background: #f9fafb; padding: 24px 32px; text-align: center; border-top: 1px solid #e5e7eb; }
  .footer p { color: #9ca3af; font-size: 12px; margin: 4px 0; }
  .cta { display: inline-block; background: #166534; color: #fff; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; margin: 16px 0; }
</style></head>
<body>
  <div class="container">
    <div class="header">
      <h1>VentiPro</h1>
      <p>Oferta Comercial · ${oferta.codigo}</p>
    </div>
    <div class="body">
      <p class="greeting">
        Estimado/a <strong>${cliente?.nombre || "Cliente"}</strong>,<br><br>
        Nos complace presentarle la siguiente oferta comercial para su consideración.
        Disponemos de animales de excelente calidad listos para su adquisición.
      </p>
      <div class="offer-box">
        <h3>📋 Detalle de la Oferta</h3>
        <div class="detail-row">
          <span class="detail-label">Tipo de producto</span>
          <span class="detail-value">${escenarioLabel}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Nº de animales</span>
          <span class="detail-value">${oferta.numAnimales}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Peso estimado</span>
          <span class="detail-value">${oferta.pesoEstimado} kg/animal</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">Precio ${oferta.escenario === "cebo" ? "por kg vivo" : "por unidad"}</span>
          <span class="detail-value">${oferta.precioKg} ${oferta.escenario === "cebo" ? "€/kg vivo" : "€/unidad"}</span>
        </div>
        ${oferta.fechaDisponibilidad ? `<div class="detail-row">
          <span class="detail-label">Disponibilidad</span>
          <span class="detail-value">${new Date(oferta.fechaDisponibilidad).toLocaleDateString("es-ES")}</span>
        </div>` : ""}
        ${lote ? `<div class="detail-row">
          <span class="detail-label">Lote de referencia</span>
          <span class="detail-value">${lote.codigo}</span>
        </div>` : ""}
        <div class="total-row">
          <span class="total-label">PRECIO TOTAL ESTIMADO</span>
          <span class="total-value">${parseFloat(oferta.precioTotal).toLocaleString("es-ES", { minimumFractionDigits: 2 })} €</span>
        </div>
      </div>
      ${oferta.condiciones ? `<div class="conditions">
        <strong>📌 Condiciones:</strong><br>${oferta.condiciones}
      </div>` : ""}
      <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">
        Esta oferta tiene una validez de 7 días naturales desde la fecha de emisión.
        Para confirmar o solicitar más información, no dude en contactarnos.
      </p>
    </div>
    <div class="footer">
      <p><strong>VentiPro</strong> · Gestión Porcina Integral</p>
      <p>Explotación porcina de ciclo completo · Aragón / Soria</p>
      <p>Oferta generada automáticamente el ${new Date().toLocaleDateString("es-ES")}</p>
    </div>
  </div>
</body>
</html>`;
}

export const ofertasRouter = router({
  list: protectedProcedure.query(async () => {
    return getOfertas();
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return getOfertaById(input.id);
    }),

  byCliente: protectedProcedure
    .input(z.object({ clienteId: z.number() }))
    .query(async ({ input }) => {
      return getOfertasByCliente(input.clienteId);
    }),

  byLote: protectedProcedure
    .input(z.object({ loteId: z.number() }))
    .query(async ({ input }) => {
      return getOfertasByLote(input.loteId);
    }),

  create: protectedProcedure
    .input(z.object({
      loteId: z.number().optional(),
      clienteId: z.number(),
      escenario: z.enum(["5-7kg", "20-21kg", "cebo"]),
      numAnimales: z.number().min(1),
      pesoEstimado: z.string(),
      precioKg: z.string(),
      fechaDisponibilidad: z.date().optional(),
      condiciones: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const codigo = generarCodigoOferta();
      // Lechones (5-7kg, 20-21kg): precio es POR UNIDAD, no se multiplica por peso
      // Cebo: precio es POR KG VIVO, se multiplica por peso
      const esPorUnidad = input.escenario === "5-7kg" || input.escenario === "20-21kg";
      const precioTotal = esPorUnidad
        ? (parseFloat(input.precioKg) * input.numAnimales).toFixed(2)
        : (parseFloat(input.pesoEstimado) * parseFloat(input.precioKg) * input.numAnimales).toFixed(2);
      const unidadPrecio = esPorUnidad ? "€/unidad" : "€/kg vivo";

      // Generate offer text with LLM
      let textoOferta = "";
      try {
        const cliente = await getClienteById(input.clienteId);
        const llmResult = await invokeLLM({
          messages: [
            { role: "system", content: "Eres un asistente comercial de una explotación porcina profesional. Genera textos de oferta comercial breves, profesionales y en español." },
            { role: "user", content: `Genera un texto breve de oferta comercial para el cliente "${cliente?.nombre || "Cliente"}" (empresa: ${cliente?.empresa || "N/A"}) para la venta de ${input.numAnimales} animales de tipo ${input.escenario} a ${input.precioKg} ${unidadPrecio} con peso estimado de ${input.pesoEstimado} kg. Precio total: ${precioTotal} €. ${input.condiciones ? "Condiciones: " + input.condiciones : ""}. Máximo 3 párrafos.` },
          ],
        });
        textoOferta = typeof llmResult.choices[0]?.message?.content === "string"
          ? llmResult.choices[0].message.content
          : "";
      } catch (e) {
        console.warn("LLM generation failed, using default text:", e);
        textoOferta = `Oferta comercial ${codigo} para ${input.numAnimales} animales (${input.escenario}) a ${input.precioKg} ${unidadPrecio}. Total estimado: ${precioTotal} €.`;
      }

      const result = await createOferta({
        codigo,
        loteId: input.loteId,
        clienteId: input.clienteId,
        escenario: input.escenario,
        numAnimales: input.numAnimales,
        pesoEstimado: input.pesoEstimado,
        precioKg: input.precioKg,
        precioTotal,
        fechaDisponibilidad: input.fechaDisponibilidad,
        condiciones: input.condiciones,
        textoOferta,
        estado: "borrador",
      });

      await logActividad({
        tipo: "oferta_creada",
        descripcion: `Oferta ${codigo} creada para cliente ID ${input.clienteId} (${input.escenario})`,
        modulo: "ofertas",
        userId: ctx.user.id,
      });

      // Notify owner
      try {
        await notifyOwner({
          title: "📝 Nueva Oferta Comercial en VentiPro",
          content: `Oferta ${codigo}: ${input.numAnimales} animales (${input.escenario}) por ${precioTotal} €`,
        });
      } catch (e) {
        console.warn("Failed to notify owner:", e);
      }

      return { ...result, codigo };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      estado: z.enum(["borrador", "enviada", "aceptada", "rechazada", "expirada"]).optional(),
      textoOferta: z.string().optional(),
      condiciones: z.string().optional(),
      precioKg: z.string().optional(),
      numAnimales: z.number().optional(),
      pesoEstimado: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      // Recalculate total if price or quantity changed
      if (data.precioKg || data.numAnimales || data.pesoEstimado) {
        const existing = await getOfertaById(id);
        if (existing) {
          const peso = data.pesoEstimado || existing.pesoEstimado;
          const precio = data.precioKg || existing.precioKg;
          const num = data.numAnimales || existing.numAnimales;
          (data as any).precioTotal = (parseFloat(peso) * parseFloat(precio) * num).toFixed(2);
        }
      }
      await updateOferta(id, data);
      await logActividad({
        tipo: "oferta_actualizada",
        descripcion: `Oferta ID ${id} actualizada${data.estado ? ` → estado: ${data.estado}` : ""}`,
        modulo: "ofertas",
        userId: ctx.user.id,
      });
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await deleteOferta(input.id);
      await logActividad({
        tipo: "oferta_eliminada",
        descripcion: `Oferta ID ${input.id} eliminada`,
        modulo: "ofertas",
        userId: ctx.user.id,
      });
      return { success: true };
    }),

  getEmailHtml: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const oferta = await getOfertaById(input.id);
      if (!oferta) throw new Error("Oferta no encontrada");
      const cliente = await getClienteById(oferta.clienteId);
      const lote = oferta.loteId ? await getLoteById(oferta.loteId) : null;
      return { html: generarHtmlOferta(oferta, cliente, lote) };
    }),

  // Generate and store PDF of offer in S3
  generatePdf: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const oferta = await getOfertaById(input.id);
      if (!oferta) throw new Error("Oferta no encontrada");
      const cliente = await getClienteById(oferta.clienteId);
      const lote = oferta.loteId ? await getLoteById(oferta.loteId) : null;
      const html = generarHtmlOferta(oferta, cliente, lote);

      // Store HTML as a file in S3 (PDF generation would require a headless browser)
      const fileKey = `ofertas/${oferta.codigo}-${nanoid(8)}.html`;
      const { url } = await storagePut(fileKey, html, "text/html");

      await updateOferta(input.id, { pdfUrl: url, pdfKey: fileKey });

      await logActividad({
        tipo: "oferta_pdf_generado",
        descripcion: `Documento de oferta ${oferta.codigo} generado y almacenado en S3`,
        modulo: "ofertas",
        userId: ctx.user.id,
      });

      return { url, key: fileKey };
    }),
});
