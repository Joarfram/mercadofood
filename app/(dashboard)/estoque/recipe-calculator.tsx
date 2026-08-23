"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { saveRecipe } from "./actions";

type Ingredient = { id:string; name:string; unit:string; unit_cost:number|string };
type Product = { id:string; name:string; base_price:number|string };
type Line = { key:string; ingredientId:string; quantity:string; loss:string };

const money = (value:number) => new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value);
const labels:Record<string,string>={un:"un",g:"g",kg:"kg",ml:"ml",l:"L"};

export function RecipeCalculator({ingredients,products}:{ingredients:Ingredient[];products:Product[]}) {
  const [lines,setLines]=useState<Line[]>([{key:"initial",ingredientId:"",quantity:"",loss:"0"}]);
  const [yieldCount,setYieldCount]=useState("1");
  const [packaging,setPackaging]=useState("0");
  const [fees,setFees]=useState("0");
  const [taxes,setTaxes]=useState("0");
  const [operating,setOperating]=useState("15");
  const [margin,setMargin]=useState("30");
  const [productId,setProductId]=useState("");
  const num=(value:string)=>Math.max(0,Number(value.replace(",","."))||0);
  const update=(key:string,field:keyof Line,value:string)=>setLines(current=>current.map(line=>line.key===key?{...line,[field]:value}:line));
  const calculations=useMemo(()=>{
    const ingredientCost=lines.reduce((sum,line)=>{
      const ingredient=ingredients.find(item=>item.id===line.ingredientId);
      return sum+(ingredient?num(line.quantity)*(1+num(line.loss)/100)*Number(ingredient.unit_cost||0):0);
    },0);
    const portions=Math.max(1,num(yieldCount));
    const costPerPortion=ingredientCost/portions+num(packaging);
    const price=(targetMargin:number)=>{
      const divisor=1-(num(fees)+num(taxes)+num(operating)+targetMargin)/100;
      return divisor>0?costPerPortion/divisor:0;
    };
    const target=num(margin);
    return {ingredientCost,costPerPortion,low:price(Math.max(0,target-5)),target:price(target),high:price(Math.min(80,target+5))};
  },[lines,ingredients,yieldCount,packaging,fees,taxes,operating,margin]);
  const selectedProduct=products.find(item=>item.id===productId);
  const payload=JSON.stringify(lines.filter(line=>line.ingredientId&&num(line.quantity)>0).map(line=>({ingredientId:line.ingredientId,quantity:num(line.quantity)*(1+num(line.loss)/100)})));

  return <section className="rounded-2xl border bg-white p-5 shadow-sm">
    <div><p className="text-sm font-bold text-emerald-700">Custo e preço de venda</p><h2 className="text-xl font-bold">Montar ficha técnica</h2><p className="mt-1 text-sm text-gray-500">Adicione os insumos da receita. Quantidade e perda são convertidas em custo real por porção.</p></div>
    <div className="mt-5 grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
      <div className="space-y-3">
        <label className="block text-sm font-semibold">Produto<select value={productId} onChange={event=>setProductId(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-3"><option value="">Selecione</option>{products.map(product=><option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
        {lines.map((line,index)=>{const ingredient=ingredients.find(item=>item.id===line.ingredientId);return <div key={line.key} className="grid gap-2 rounded-xl border bg-gray-50 p-3 sm:grid-cols-[1fr_120px_100px_auto] sm:items-end">
          <label className="text-xs font-bold">Insumo<select value={line.ingredientId} onChange={event=>update(line.key,"ingredientId",event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="">Selecione</option>{ingredients.map(item=><option key={item.id} value={item.id}>{item.name} — {money(Number(item.unit_cost||0))}/{labels[item.unit]}</option>)}</select></label>
          <label className="text-xs font-bold">Quantidade ({labels[ingredient?.unit||""]||"un"})<input value={line.quantity} onChange={event=>update(line.key,"quantity",event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Ex.: 130"/></label>
          <label className="text-xs font-bold">Perda %<input value={line.loss} onChange={event=>update(line.key,"loss",event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border px-3 py-2"/></label>
          <button type="button" aria-label={`Remover insumo ${index+1}`} disabled={lines.length===1} onClick={()=>setLines(current=>current.filter(item=>item.key!==line.key))} className="rounded-lg border p-2 text-red-600 disabled:opacity-30"><Trash2 size={18}/></button>
        </div>})}
        <button type="button" onClick={()=>setLines(current=>[...current,{key:crypto.randomUUID(),ingredientId:"",quantity:"",loss:"0"}])} className="inline-flex items-center gap-2 rounded-xl border border-emerald-700 px-4 py-2 font-bold text-emerald-700"><Plus size={18}/>Adicionar insumo</button>
        <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Rendimento da receita (porções)<input value={yieldCount} onChange={event=>setYieldCount(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border px-3 py-3"/></label><label className="text-sm font-semibold">Embalagem por porção (R$)<input value={packaging} onChange={event=>setPackaging(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-xl border px-3 py-3"/></label></div>
      </div>
      <aside className="rounded-2xl border bg-gray-50 p-4">
        <h3 className="font-bold">Formação do preço</h3><div className="mt-3 grid grid-cols-2 gap-2"><Percent label="Taxas de venda" value={fees} set={setFees}/><Percent label="Impostos" value={taxes} set={setTaxes}/><Percent label="Custos operacionais" value={operating} set={setOperating}/><Percent label="Margem desejada" value={margin} set={setMargin}/></div>
        <dl className="mt-4 space-y-2 text-sm"><Row label="Custo dos insumos (receita)" value={money(calculations.ingredientCost)}/><Row label="Custo direto por porção" value={money(calculations.costPerPortion)}/>{selectedProduct&&<Row label="Preço atual no cardápio" value={money(Number(selectedProduct.base_price||0))}/>}</dl>
        <div className="mt-4 grid gap-2"><Price label="Faixa menor" value={calculations.low}/><Price label="Preço recomendado" value={calculations.target} featured/><Price label="Faixa maior" value={calculations.high}/></div>
        <p className="mt-3 text-xs text-gray-500">Fórmula: custo por porção ÷ (1 − taxas − impostos − operação − margem). A faixa varia a margem desejada em ±5 pontos.</p>
        <form action={saveRecipe} className="mt-4"><input type="hidden" name="productId" value={productId}/><input type="hidden" name="itemsJson" value={payload}/><button disabled={!productId||payload==="[]"} className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-40">Salvar ficha técnica</button></form>
      </aside>
    </div>
  </section>;
}
function Percent({label,value,set}:{label:string;value:string;set:(value:string)=>void}){return <label className="text-xs font-bold">{label} %<input value={value} onChange={event=>set(event.target.value)} inputMode="decimal" className="mt-1 w-full rounded-lg border px-2 py-2"/></label>}
function Row({label,value}:{label:string;value:string}){return <div className="flex justify-between gap-3"><dt className="text-gray-500">{label}</dt><dd className="font-bold">{value}</dd></div>}
function Price({label,value,featured=false}:{label:string;value:number;featured?:boolean}){return <div className={`flex items-center justify-between rounded-xl border p-3 ${featured?"bg-emerald-50":"bg-white"}`}><span className="text-sm font-semibold">{label}</span><strong className={featured?"text-xl text-emerald-700":""}>{value?money(value):"Revise os percentuais"}</strong></div>}

