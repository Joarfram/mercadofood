"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlanModule } from "@/lib/auth/current-company";

export async function saveCampaign(formData: FormData) {
  const { supabase, company, user, role } = await requirePlanModule("marketing");
  if (!['owner','manager'].includes(role)) redirect('/sem-permissao');
  const id = String(formData.get('id') || '');
  const title = String(formData.get('title') || '').trim();
  const dailyBudget = Math.max(10, Number(formData.get('dailyBudget') || 10));
  const durationDays = Math.min(30, Math.max(1, Number(formData.get('durationDays') || 1)));
  const creativeMode = String(formData.get('creativeMode') || 'own') === 'ai' ? 'ai' : 'own';
  if (!title) redirect('/impulsiona?erro=Informe%20o%20nome%20da%20campanha');
  const mediaBudget = dailyBudget * durationDays;
  const platformFee = 9.90;
  const aiFee = creativeMode === 'ai' ? 19.90 : 0;
  const values = { company_id: company.id, title, content_type: String(formData.get('contentType') || 'product'), content_id: String(formData.get('contentId') || '') || null, objective: String(formData.get('objective') || 'orders'), creative_mode: creativeMode, caption: String(formData.get('caption') || '').trim() || null, call_to_action: String(formData.get('cta') || 'Pedir agora').trim(), destination_url: String(formData.get('destinationUrl') || '').trim() || null, radius_km: Math.min(50, Math.max(1, Number(formData.get('radiusKm') || 5))), daily_budget: dailyBudget, duration_days: durationDays, media_budget: mediaBudget, platform_fee: platformFee, ai_fee: aiFee, total_due: mediaBudget + platformFee + aiFee, status: creativeMode === 'ai' ? 'awaiting_creative' : 'awaiting_payment', created_by: user.id, updated_at: new Date().toISOString() };
  const query = id ? supabase.from('marketing_campaigns').update(values).eq('id', id).eq('company_id', company.id) : supabase.from('marketing_campaigns').insert(values);
  const { data, error } = await query.select('id').single();
  if (error) redirect(`/impulsiona?erro=${encodeURIComponent(error.message)}`);
  revalidatePath('/impulsiona');
  redirect(`/impulsiona?campanha=${data.id}&sucesso=${encodeURIComponent(id ? 'Campanha atualizada' : 'Campanha criada. Agora adicione o criativo e revise o pagamento.')}`);
}

export async function deleteCampaign(formData: FormData) {
  const id = String(formData.get('id') || '');
  const { supabase, company, role } = await requirePlanModule('marketing');
  if (!['owner','manager'].includes(role)) redirect('/sem-permissao');
  await supabase.from('marketing_campaigns').delete().eq('id', id).eq('company_id', company.id);
  revalidatePath('/impulsiona');
}
