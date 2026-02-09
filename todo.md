# VentiPro - TODO

## Fase 1: Infraestructura y Diseño
- [x] Configurar tema visual profesional (colores, tipografía, sombras)
- [x] Diseñar esquema de base de datos completo (centros, lotes, clientes, ofertas, parámetros)
- [x] Migrar esquema a base de datos

## Fase 2: Backend - Módulos de Negocio
- [x] CRUD de centros (cría Aragón, engorde Soria) con capacidades
- [x] CRUD de lotes (nº animales, fecha destete, peso, calidad)
- [x] Calculadora de escenarios (5-7kg, 20-21kg, cebo final) con costes y márgenes
- [x] Motor de decisión y recomendación automática por lote
- [x] CRUD de clientes/leads con segmentación geográfica
- [x] Importación CSV de leads
- [x] Generador de ofertas comerciales por lote y cliente
- [x] Envío de ofertas por Gmail
- [x] Generación de PDFs de ofertas y almacenamiento en S3
- [x] Notificaciones al propietario (nuevos leads, ofertas, umbrales capacidad)

## Fase 3: Frontend - Páginas y Componentes
- [x] Layout principal con sidebar (DashboardLayout)
- [x] Dashboard de capacidad de centros (% ocupación cría y engorde)
- [x] Visualización de lotes por fase con fechas clave
- [x] Página de calculadora de rentabilidad con gráficos interactivos (Recharts)
- [x] Comparativa visual de 3 escenarios con margen por plaza-día
- [x] Motor de recomendación visual con justificación
- [x] Página CRM: listado de clientes con filtros (tipo, zona, volumen, prioridad)
- [x] Página CRM: ficha de cliente detallada
- [x] Página CRM: importación CSV
- [x] Página de ofertas: generación automática con selección de clientes
- [x] Página de ofertas: historial y estados (enviada, aceptada, rechazada)
- [x] Diseño responsive y elegante para móvil y tablet

## Fase 4: Docker y Despliegue
- [x] Dockerfile para backend (FastAPI/Node)
- [x] Dockerfile para frontend (build + NGINX)
- [x] docker-compose.yml con todos los servicios
- [x] Instrucciones de despliegue en VM de Google

## Fase 5: Documentación Kit Digital
- [x] Documento de justificación con funcionalidades, tecnologías y métricas
- [x] Push completo al repositorio GitHub Myriamfxs/Ventipro

## Fase 6: Calidad
- [x] Tests vitest para routers backend (29 tests, 100% pass)
- [x] Verificación exhaustiva de funcionalidad completa
- [x] Corrección bug página Actividad (stats.porModulo rendering)

## Bugs
- [x] Fix: calculadora.parametros.getActivos devuelve undefined (query data cannot be undefined)

## Fase 7: Mejoras según documento de requisitos v2
- [x] Scraping de precios de mercado de Pig333/Mercolleida (cerdo cebado, lechón 20kg)
- [x] Tabla de precios de mercado en tiempo real en el dashboard
- [x] Noticias del sector porcino (RSS Google News / scraping Pig333)
- [x] Refactorizar fórmulas de calculadora: costes por fases (cría, transición, cebo) separados
- [x] Opción de costes estándar estimados automáticos vs costes manuales del usuario
- [x] Estimación de precios futuros con media móvil ponderada y tendencias estacionales
- [x] Motor de recomendación mejorado con justificación detallada por lote
- [x] Consulta de precio de pienso actualizado
- [x] Visualización de tendencias de precios con gráficos históricos
- [x] Integración de precios de mercado en la calculadora de escenarios

## Fase 8: Análisis de Datos Históricos de Rentabilidad
- [x] Crear tabla de historial de cálculos de rentabilidad en la base de datos
- [x] Implementar queries de consulta histórica con filtros por fecha, escenario y lote
- [x] Crear router tRPC para análisis histórico (guardar cálculos, consultar historial, estadísticas)
- [x] Desarrollar página de Análisis Histórico con gráficos de evolución temporal (Recharts)
- [x] Tabla comparativa de lotes con métricas clave (margen, rentabilidad, eficiencia)
- [x] Gráfico de tendencia de márgenes por escenario a lo largo del tiempo
- [x] KPIs resumen: mejor lote, peor lote, media de rentabilidad, tendencia general
- [x] Filtros interactivos por rango de fechas, escenario y número de animales
- [x] Integrar la nueva sección en la navegación del sidebar
- [x] Tests vitest para las queries y lógica del análisis histórico (10 tests)

## Bugs - Corrección Precios
- [x] Fix: Lechones 5-7kg se venden por UNIDAD, no por kg vivo - corregido en todo el sistema
- [x] Fix: Lechones 20kg se venden por UNIDAD, no por kg - corregido en todo el sistema
- [x] Fix: Verificar precios reales de mercado actuales para lechones (€/unidad) y cerdo cebado (€/kg vivo)
- [x] Fix: Actualizar servicio de precios de mercado con unidades correctas
- [x] Fix: Actualizar calculadora de rentabilidad con lógica de precios por unidad
- [x] Fix: Actualizar dashboard y frontend con etiquetas de unidad correctas
- [x] Fix: Actualizar HTML de ofertas comerciales con unidad correcta (€/unidad vs €/kg vivo)
- [x] Fix: Actualizar cálculo de precio total en ofertas (lechones: precio*animales, cebo: precio*peso*animales)
- [x] Tests actualizados: 48 tests, 100% pass
