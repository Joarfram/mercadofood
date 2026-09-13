"use server";

import { createHash, randomBytes } from "node:crypto";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";

const SESSION_DAYS = 90;
const customerSchema = z.object({
  slug: z.string().trim().min(1).max(120),
  name: z.string().trim().min(2).max(120),
  phone: z.string().transform(value => value.replace(/\D/g, "")).pipe(z.string().min(10).max(15)),
});

type CustomerSession = { customerId: string; companyId: string; name: string; phone: string };

function sessionCookieName(slug: string) {
  return `mf_customer_${createHash("sha256").update(slug.toLowerCase()).digest("hex").slice(0, 16)}`;
}
function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
function maskPhone(phone:string){return phone.length>=4?`•••••••${phone.slice(-4)}`:"••••";}

async function resolveCustomerSession(slug: string): Promise<CustomerSession | null> {
  const token = (await cookies()).get(sessionCookieName(slug))?.value;
  if (!token) return null;
  const admin = createAdminClient();
  const { data: company } = await admin.from("companies").select("id").eq("slug", slug).eq("status", "active").maybeSingle();
  if (!company) return null;
  const { data: session } = await admin.from("customer_menu_sessions")
    .select("id,customer_id,company_id,expires_at,customers(name,phone)")
    .eq("company_id", company.id).eq("token_hash", tokenHash(token)).gt("expires_at", new Date().toISOString()).maybeSingle();
  if (!session) return null;
  const customer = Array.isArray(session.customers) ? session.customers[0] : session.customers;
  if (!customer) return null;
  return { customerId: session.customer_id, companyId: session.company_id, name: customer.name, phone: customer.phone };
}

export async function lookupPublicCustomer(input:{slug:string;name:string}){
  const slug=String(input.slug||"").trim();
  const name=String(input.name||"").trim();
  if(name.length<2)return {ok:true as const,found:false as const};
  const admin=createAdminClient();
  const {data:company}=await admin.from("companies").select("id").eq("slug",slug).eq("status","active").eq("menu_is_active",true).maybeSingle();
  if(!company)return {ok:false as const,error:"Cardápio indisponível."};
  const {data:matches}=await admin.from("customers").select("id,name,phone").eq("company_id",company.id).eq("is_active",true).ilike("name",name).limit(2);
  if(!matches?.length)return {ok:true as const,found:false as const};
  if(matches.length!==1)return {ok:true as const,found:false as const};
  return {ok:true as const,found:true as const,name:matches[0].name,maskedPhone:maskPhone(matches[0].phone)};
}

export async function registerPublicCustomer(input: unknown) {
  const parsed = customerSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Informe nome e WhatsApp válidos." };
  const { slug, name, phone } = parsed.data;
  const admin = createAdminClient();
  const { data: company } = await admin.from("companies").select("id").eq("slug", slug).eq("status", "active").eq("menu_is_active", true).maybeSingle();
  if (!company) return { ok: false as const, error: "Cardápio indisponível." };
  let { data: customer } = await admin.from("customers").select("id,name,phone").eq("company_id",company.id).eq("phone",phone).eq("is_active",true).maybeSingle();
  if(customer){
    if(customer.name.trim().toLocaleLowerCase("pt-BR")!==name.trim().toLocaleLowerCase("pt-BR")) return {ok:false as const,error:"O WhatsApp informado pertence a outro cadastro. Confira os dados."};
  }else{
    const created=await admin.from("customers").insert({ company_id: company.id, name, phone }).select("id,name,phone").single();
    if(created.error||!created.data)return {ok:false as const,error:"Não foi possível concluir seu cadastro."};
    customer=created.data;
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  const { error: sessionError } = await admin.from("customer_menu_sessions").insert({company_id: company.id, customer_id: customer.id, token_hash: tokenHash(token), expires_at: expiresAt.toISOString()});
  if (sessionError) return { ok: false as const, error: "Não foi possível iniciar sua sessão." };
  (await cookies()).set(sessionCookieName(slug), token, {httpOnly:true,secure:process.env.NODE_ENV === "production",sameSite:"lax",path:`/cardapio/${slug}`,expires:expiresAt});
  return { ok: true as const, customer: { name: customer.name, phone: customer.phone } };
}

export async function getPublicCustomerState(slug: string) {
  const session = await resolveCustomerSession(slug);
  if (!session) return { registered: false as const, customer: null, order: null };
  const admin = createAdminClient();
  const [{ data: order },{data:address}] = await Promise.all([
    admin.from("orders").select("id,order_number,public_code,total,status,service_type,created_at,estimated_preparation_minutes,estimated_ready_at,ready_at,delivered_at,canceled_at").eq("company_id", session.companyId).eq("customer_id", session.customerId).is("customer_closed_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    admin.from("customer_addresses").select("cep,street,number,complement,neighborhood,city,reference").eq("company_id",session.companyId).eq("customer_id",session.customerId).eq("is_default",true).maybeSingle(),
  ]);
  return { registered: true as const, customer: { name: session.name, phone: session.phone, address: address||null }, order: order || null };
}

export async function closePublicCustomerOrder(input: { slug: string; orderId: string }) {
  const session = await resolveCustomerSession(input.slug);
  if (!session) return { ok: false as const, error: "Sua sessão expirou." };
  const admin = createAdminClient();
  const { data, error } = await admin.from("orders").update({ customer_closed_at: new Date().toISOString() }).eq("id", input.orderId).eq("company_id", session.companyId).eq("customer_id", session.customerId).is("customer_closed_at", null).select("id").maybeSingle();
  if (error || !data) return { ok: false as const, error: "Não foi possível fechar a visualização do pedido." };
  return { ok: true as const };
}

async function createPublicSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll(){return cookieStore.getAll();},setAll(){}}});
}

export async function previewPublicCoupon(input: { slug: string; code: string; subtotal: number }) {
  const supabase = await createPublicSupabaseClient();
  const code = input.code.trim().toUpperCase().replace(/\s+/g, "");
  if (!code) return { ok: false as const, error: "Informe o código do cupom." };
  if (!Number.isFinite(input.subtotal) || input.subtotal <= 0) return { ok: false as const, error: "Adicione produtos antes de aplicar o cupom." };
  const { data, error } = await supabase.rpc("preview_public_coupon", {p_slug: input.slug,p_code: code,p_subtotal: input.subtotal});
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, data };
}

export async function submitPublicOrder(payload: unknown) {
  const supabase = await createPublicSupabaseClient();
  const input = payload as { slug?: string; service_type?: string; delivery_zone_id?: string; delivery_address?:Record<string,unknown>; [key: string]: unknown };
  const slug = typeof input.slug === "string" ? input.slug : "";
  const session = await resolveCustomerSession(slug);
  if (!session) return { ok: false as const, error: "Faça seu cadastro antes de confirmar o pedido.", registrationRequired: true as const };
  const securedPayload = { ...input, customer_name: session.name, customer_phone: session.phone };
  const [{ data: serviceConfig }, { data: zones }] = await Promise.all([
    supabase.rpc('get_public_service_config',{p_slug:input.slug || ''}),
    supabase.rpc('get_public_delivery_zones',{p_slug:input.slug || ''}),
  ]);
  if (input.service_type === 'delivery' && !serviceConfig?.delivery_enabled) return { ok:false as const,error:'A loja não está recebendo pedidos para entrega.' };
  if (input.service_type === 'pickup' && !serviceConfig?.pickup_enabled) return { ok:false as const,error:'A loja não está recebendo pedidos para retirada.' };
  if (input.service_type === 'delivery' && Array.isArray(zones) && zones.length && !input.delivery_zone_id) return { ok:false as const,error:'Selecione um bairro atendido pela loja.' };
  const { data, error } = await supabase.rpc("create_public_order", { p_payload: securedPayload });
  if (error) return { ok: false as const, error: error.message };
  let orderData = data;
  if (input.service_type === 'delivery' && input.delivery_zone_id) {
    const { data: adjusted, error: zoneError } = await supabase.rpc('apply_public_order_delivery_zone',{p_order_id:data.order_id,p_zone_id:input.delivery_zone_id});
    if (zoneError) return { ok:false as const,error:zoneError.message };
    orderData = adjusted;
  }
  const zone = Array.isArray(zones) ? zones.find(item => item?.id === input.delivery_zone_id) : null;
  const estimatedMinutes = Math.max(5, Math.min(300, Number(zone?.estimated_minutes || serviceConfig?.average_delivery_minutes || 45)));
  const admin = createAdminClient();
  await admin.from("orders").update({estimated_preparation_minutes: estimatedMinutes,estimated_ready_at: new Date(Date.now() + estimatedMinutes * 60000).toISOString()}).eq("id", orderData.order_id).eq("company_id", session.companyId).eq("customer_id", session.customerId);
  if(input.service_type==='delivery'&&input.delivery_address){
    const {count}=await admin.from("customer_addresses").select("id",{count:"exact",head:true}).eq("company_id",session.companyId).eq("customer_id",session.customerId);
    if(!count){
      const a=input.delivery_address;
      await admin.from("customer_addresses").insert({company_id:session.companyId,customer_id:session.customerId,label:"Principal",cep:String(a.cep||"")||null,street:String(a.street||"")||null,number:String(a.number||"")||null,complement:String(a.complement||"")||null,neighborhood:String(a.neighborhood||"")||null,city:String(a.city||"")||null,reference:String(a.reference||"")||null,is_default:true});
    }
  }
  return { ok: true as const, data: orderData };
}
