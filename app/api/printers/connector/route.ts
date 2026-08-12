import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireModule } from "@/lib/auth/current-company";

export async function POST(request: Request) {
  const { printerId } = await request.json().catch(() => ({}));
  if (!printerId || typeof printerId !== "string") return NextResponse.json({ error: "Impressora inválida" }, { status: 400 });
  const { supabase, company } = await requireModule("settings");
  const { data: printer } = await supabase.from("thermal_printers").select("id,windows_printer_name").eq("id", printerId).eq("company_id", company.id).single();
  if (!printer) return NextResponse.json({ error: "Impressora não encontrada" }, { status: 404 });
  const token = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(token).digest("hex");
  const { error } = await supabase.from("thermal_printers").update({ connector_token_hash: hash, updated_at: new Date().toISOString() }).eq("id", printer.id).eq("company_id", company.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase não configurado" }, { status: 500 });

  const script = `$ErrorActionPreference = "Stop"
$Api = "${url}/rest/v1/rpc"
$Key = "${key}"
$Token = "${token}"
$Headers = @{ apikey=$Key; Authorization="Bearer $Key"; "Content-Type"="application/json" }
Write-Host "Conector MercadoFood iniciado - ${printer.windows_printer_name}" -ForegroundColor Green
while ($true) {
  try {
    $job = Invoke-RestMethod -Method Post -Uri "$Api/claim_print_job" -Headers $Headers -Body (@{p_token=$Token}|ConvertTo-Json)
    if ($null -ne $job) {
      $o=$job.order
      $lines=@($job.company_name,"PEDIDO #$($o.order_number)",(Get-Date $o.created_at -Format "dd/MM/yyyy HH:mm"),$o.service_type,"--------------------------------","CLIENTE: $($o.customer_name)","TELEFONE: $($o.customer_phone)","ENDERECO: $($o.delivery_address.street) $($o.delivery_address.number)","BAIRRO: $($o.delivery_address.neighborhood)","--------------------------------")
      foreach($i in $job.items){$lines += "$($i.quantity)x $($i.product_name)  R$ $($i.total_price)"; foreach($op in $i.options){$lines += "  + $($op.option_name)"}; if($i.notes){$lines += "  OBS: $($i.notes)"}}
      $lines += "--------------------------------"
      if($o.notes){$lines += "OBS PEDIDO: $($o.notes)"}
      $lines += "TOTAL: R$ $($o.total)"
      $lines += "PAGAMENTO: $($o.payment_method) / $($o.payment_status)"
      if([decimal]$o.change_amount -gt 0){$lines += "TROCO PARA: R$ $($o.change_amount)"}
      try {
        ($lines -join [Environment]::NewLine) | Out-Printer -Name $job.printer_name
        Invoke-RestMethod -Method Post -Uri "$Api/finish_print_job" -Headers $Headers -Body (@{p_token=$Token;p_job_id=$job.job_id;p_success=$true;p_error=$null}|ConvertTo-Json) | Out-Null
        Write-Host "Pedido #$($o.order_number) impresso"
      } catch {
        Invoke-RestMethod -Method Post -Uri "$Api/finish_print_job" -Headers $Headers -Body (@{p_token=$Token;p_job_id=$job.job_id;p_success=$false;p_error=$_.Exception.Message}|ConvertTo-Json) | Out-Null
        Write-Warning $_.Exception.Message
      }
    }
  } catch { Write-Warning "Sem conexão com MercadoFood: $($_.Exception.Message)" }
  Start-Sleep -Seconds 5
}`;
  return new NextResponse(script, { headers: { "Content-Type": "text/plain; charset=utf-8", "Content-Disposition": `attachment; filename="MercadoFood-Conector-${printer.id.slice(0, 8)}.ps1"`, "Cache-Control": "no-store" } });
}
