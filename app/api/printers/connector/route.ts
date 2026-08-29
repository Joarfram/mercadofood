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

function Measure-Line($i) {
  if ($i.selling_mode -eq "weight") { return "$($i.sale_quantity) $($i.sale_unit) $($i.product_name)" }
  if ($i.selling_mode -eq "fixed_weight") {
    if ([decimal]$i.quantity -gt 1) { return "$($i.quantity)x $($i.sale_quantity) $($i.sale_unit) $($i.product_name)" }
    return "$($i.sale_quantity) $($i.sale_unit) $($i.product_name)"
  }
  return "$($i.quantity)x $($i.product_name)"
}

while ($true) {
  try {
    $job = Invoke-RestMethod -Method Post -Uri "$Api/claim_delivery_simple_print_job" -Headers $Headers -Body (@{p_token=$Token}|ConvertTo-Json)
    if ($null -ne $job -and $null -ne $job.job_id) {
      $o=$job.payload
      $addr=$o.delivery_address
      $lines=@(
        $o.company_name,
        "PEDIDO #$($o.order_number)",
        "--------------------------------",
        "CLIENTE: $($o.customer_name)",
        "TELEFONE: $($o.customer_phone)",
        "ATENDIMENTO: $($o.service_type)"
      )
      if ($o.service_type -eq "delivery") {
        $lines += "ENDERECO: $($addr.street) $($addr.number)"
        if ($addr.complement) {$lines += "COMPLEMENTO: $($addr.complement)"}
        $lines += "BAIRRO: $($addr.neighborhood)"
        if ($addr.reference) {$lines += "REFERENCIA: $($addr.reference)"}
      }
      $lines += "--------------------------------"
      foreach($i in $o.items){
        $lines += "$(Measure-Line $i)  R$ $($i.total_price)"
        if($i.notes){$lines += "  OBS: $($i.notes)"}
      }
      $lines += "--------------------------------"
      if($o.notes){$lines += "OBS PEDIDO: $($o.notes)"}
      $lines += "SUBTOTAL: R$ $($o.subtotal)"
      if([decimal]$o.delivery_fee -gt 0){$lines += "ENTREGA: R$ $($o.delivery_fee)"}
      $lines += "TOTAL: R$ $($o.total)"
      $lines += "PAGAMENTO: $($o.payment_method) / $($o.payment_status)"

      try {
        $copies=[Math]::Max(1,[int]$job.copies)
        for($copy=1;$copy -le $copies;$copy++) {
          ($lines -join [Environment]::NewLine) | Out-Printer -Name $job.printer_name
        }
        Invoke-RestMethod -Method Post -Uri "$Api/finish_delivery_simple_print_job" -Headers $Headers -Body (@{p_token=$Token;p_job_id=$job.job_id;p_success=$true;p_error=$null}|ConvertTo-Json) | Out-Null
        Write-Host "Pedido #$($o.order_number) impresso"
      } catch {
        Invoke-RestMethod -Method Post -Uri "$Api/finish_delivery_simple_print_job" -Headers $Headers -Body (@{p_token=$Token;p_job_id=$job.job_id;p_success=$false;p_error=$_.Exception.Message}|ConvertTo-Json) | Out-Null
        Write-Warning $_.Exception.Message
      }
    }
  } catch { Write-Warning "Sem conexão com MercadoFood: $($_.Exception.Message)" }
  Start-Sleep -Seconds 5
}`;

  return new NextResponse(script, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="MercadoFood-Conector-${printer.id.slice(0, 8)}.ps1"`,
      "Cache-Control": "no-store"
    }
  });
}
