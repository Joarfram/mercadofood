// Domínio de API público previsto para produção. Mantém a mesma implementação
// assinada usada em /api/webhooks/mercadopago, sem duplicar a lógica de cobrança.
export { POST } from "@/app/api/webhooks/mercadopago/route";
