"use client";

import { Printer } from "lucide-react";

export function PrinterTestButton({ printerName, width }: { printerName: string; width: number }) {
  function test() {
    const popup = window.open("", "_blank", "width=420,height=640");
    if (!popup) return alert("Permita pop-ups para imprimir o teste.");
    popup.document.write(`<!doctype html><html><head><title>Teste ${printerName}</title><style>@page{size:${width}mm auto;margin:3mm}body{font:14px monospace;width:${width - 8}mm;margin:0}h1{text-align:center;font-size:19px}.line{border-top:1px dashed #000;margin:12px 0}b{font-size:16px}</style></head><body><h1>MercadoFood</h1><div class="line"></div><b>IMPRESSÃO DE TESTE</b><p>Impressora: ${printerName}</p><p>Papel: ${width} mm</p><p>Data: ${new Date().toLocaleString("pt-BR")}</p><div class="line"></div><p>Se este texto saiu corretamente, a configuração do Windows está funcionando.</p><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }
  return <button type="button" onClick={test} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white"><Printer size={16}/>Imprimir teste</button>;
}
