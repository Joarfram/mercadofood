import { createClient } from "@/lib/supabase/server";

export async function listOrders(companyId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, public_code, customer_name, status, total, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}
