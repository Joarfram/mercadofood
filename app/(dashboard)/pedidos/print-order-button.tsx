"use client";

import { Printer } from "lucide-react";

type OrderItem = { product_name:string; quantity:number; unit_price:number|string; total_price:number|string; notes?:string|null; order_item_options?:Array<{ option_name:string; quantity:number; total_price:number|string }> };
type PrintableOrder = { order_number:number|string; customer_name?:string|null; customer_phone?:string|null; service_type:string; payment_method?:string|null; payment_status?:string|null; subtotal:number|string; discount_amount?:number|string|null; delivery_fee?:number|string|null; total:number|string; change_amount?:number|string|null; notes?:string|null; delivery_address?:Record<string,string>|null; created_at:string; order_items:OrderItem[] };
type PrinterSettings = { name:string; paper_width:number; print_customer:boolean; print_address:boolean; print_payment:boolean };

const money = (value:number|string|null|undefined) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(value || 0));
const clean = (value:unknown) => String(value ?? "").replace(/[&<>'"]/g,(char)=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[char] || char));
const serviceLabels:Record<string,string> = { delivery:"DELIVERY", pickup:"RETIRADA", dine_in:"CONSUMO NO LOCAL", table:"MESA" };
const paymentLabels:Record<string,string> = { pix:"PIX", cash:"DINHEIRO", card_on_delivery:"CARTÃO NA ENTREGA", online_card:"CARTÃO ONLINE", card_online:"CARTÃO ONLINE", other:"OUTRO" };

export function PrintOrderButton({ order, companyName, printer }: { order:PrintableOrder; companyName:string; printer:PrinterSettings|null }) {
  function printOrder() {
    if (!printer) return alert("Cadastre e ative uma impressora em Configurações → Impressoras térmicas.");
    const address = order.delivery_address || {};
    const addressText = [address.street,address.number,address.complement,address.neighborhood,address.city,address.reference && `Ref.: ${address.reference}`].filter(Boolean).map(clean).join("<br>");
    const items = order.order_items.map((item)=>`<section class="item"><b>${item.quantity}x ${clean(item.product_name)}</b><span>${money(item.total_price)}</span>${item.order_item_options?.length ? `<small>${item.order_item_options.map(option=>`+ ${option.quantity || 1}x ${clean(option.option_name)}${Number(option.total_price)>0 ? ` (${money(option.total_price)})` : ""}`).join("<br>")}</small>`:""}${item.notes ? `<em>OBS.: ${clean(item.notes)}</em>`:""}</section>`).join("");
    const customer = printer.print_customer ? `<div class="line"></div><b>CLIENTE</b><p>${clean(order.customer_name || "Não informado")}<br>${clean(order.customer_phone || "Sem telefone")}</p>` : "";
    const delivery = printer.print_address && addressText ? `<div class="line"></div><b>ENDEREÇO</b><p>${addressText}</p>` : "";
    const payment = printer.print_payment ? `<div class="line"></div><p>Subtotal <span>${money(order.subtotal)}</span></p>${Number(order.discount_amount)>0?`<p>Desconto <span>- ${money(order.discount_amount)}</span></p>`:""}${Number(order.delivery_fee)>0?`<p>Entrega <span>${money(order.delivery_fee)}</span></p>`:""}<p class="total">TOTAL <span>${money(order.total)}</span></p><p>Pagamento: ${clean(paymentLabels[order.payment_method || ""] || order.payment_method || "Não informado")}<br>Status: ${order.payment_status === "paid" ? "PAGO" : "PENDENTE"}${Number(order.change_amount)>0?`<br>Troco para: ${money(order.change_amount)}`:""}</p>` : "";
    const popup = window.open("","_blank","width=440,height=720");
    if (!popup) return alert("Permita pop-ups para imprimir o pedido.");
    popup.document.write(`<!doctype html><html><head><title>Pedido ${clean(order.order_number)}</title><style>@page{size:${printer.paper_width}mm auto;margin:3mm}*{box-sizing:border-box}body{font:13px/1.35 monospace;width:${printer.paper_width-8}mm;margin:0;color:#000}h1,h2,p{margin:4px 0}h1{text-align:center;font-size:19px}h2{text-align:center;font-size:23px}.center{text-align:center}.line{border-top:1px dashed #000;margin:9px 0}.item{position:relative;padding:6px 0;border-bottom:1px dotted #777}.item>b{display:block;padding-right:65px}.item>span{position:absolute;right:0;top:6px}.item small,.item em{display:block;margin:3px 0 0 12px}.item em{font-weight:bold;font-style:normal}.total{font-size:17px;font-weight:bold;border-top:1px dashed;padding-top:6px}p span,.total span{float:right}</style></head><body><h1>${clean(companyName)}</h1><h2>PEDIDO #${clean(order.order_number)}</h2><p class="center">${new Date(order.created_at).toLocaleString("pt-BR")}<br><b>${clean(serviceLabels[order.service_type] || order.service_type)}</b></p>${customer}${delivery}<div class="line"></div><b>ITENS DO PEDIDO</b>${items}${order.notes?`<div class="line"></div><b>OBSERVAÇÃO DO PEDIDO</b><p>${clean(order.notes)}</p>`:""}${payment}<div class="line"></div><p class="center">Impresso pelo MercadoFood<br>${clean(printer.name)}</p><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }
  return <button type="button" onClick={printOrder} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 font-semibold text-emerald-800"><Printer size={17}/>{printer ? "Imprimir pedido" : "Configurar impressão"}</button>;
}
