// URL pública cadastrada no Mercado Pago. A lógica continua centralizada no
// callback de API para que não existam dois fluxos OAuth diferentes.
export { GET } from "@/app/api/integrations/mercadopago/callback/route";
