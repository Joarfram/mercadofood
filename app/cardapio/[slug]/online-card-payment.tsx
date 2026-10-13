"use client";

import { useEffect, useState, useTransition } from "react";
import Script from "next/script";
import { createPublicMercadoPagoCard } from "./actions";

type BrickController = { unmount: () => void };
type MercadoPagoConstructor = new (publicKey: string, options?: Record<string, unknown>) => {
  bricks: () => { create: (type: string, container: string, settings: Record<string, unknown>) => Promise<BrickController> };
};

type MercadoPagoWindow = Window & { MercadoPago?: MercadoPagoConstructor };

type Props = {
  open: boolean;
  slug: string;
  orderId: string;
  amount: number;
  payerEmail: string;
  publicKey: string;
  onClose: () => void;
  onFinished: () => void;
};

/** O Brick hospeda os campos sensíveis no Mercado Pago; este componente só envia o token descartável. */
export function OnlineCardPayment({ open, slug, orderId, amount, payerEmail, publicKey, onClose, onFinished }: Props) {
  const [sdkLoaded, setSdkLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, startTransition] = useTransition();

  useEffect(() => {
    const MercadoPago = (window as MercadoPagoWindow).MercadoPago;
    if (!open || !sdkLoaded || !publicKey || !MercadoPago) return;
    let active = true;
    let controller: BrickController | null = null;
    const mount = async () => {
      try {
        const mercadoPago = new MercadoPago(publicKey, { locale: "pt-BR", marketplace: true });
        controller = await mercadoPago.bricks().create("cardPayment", "mf-card-payment-brick", {
          initialization: { amount: Number(amount.toFixed(2)), payer: { email: payerEmail }, marketplace: true },
          customization: { visual: { style: { theme: "default" } }, paymentMethods: { maxInstallments: 12 } },
          callbacks: {
            onReady: () => undefined,
            onError: () => active && setMessage("Não foi possível carregar o formulário do cartão."),
            onSubmit: (formData: Record<string, unknown>) => new Promise<void>((resolve, reject) => {
              const token = String(formData.token || "");
              const paymentMethodId = String(formData.payment_method_id || "");
              const paymentType = String(formData.payment_type_id || "");
              const installments = Number(formData.installments || 1);
              const issuerId = formData.issuer_id ? String(formData.issuer_id) : undefined;
              startTransition(async () => {
                const result = await createPublicMercadoPagoCard({ slug, orderId, token, paymentMethodId, paymentType, installments, issuerId });
                if (!result.ok) { setMessage(result.error); reject(new Error(result.error)); return; }
                onFinished();
                resolve();
              });
            }),
          },
        });
      } catch {
        if (active) setMessage("Não foi possível iniciar o pagamento com cartão.");
      }
    };
    void mount();
    return () => { active = false; controller?.unmount(); };
  }, [amount, onFinished, open, orderId, payerEmail, publicKey, sdkLoaded, slug]);

  if (!open) return null;
  return <div className="fixed inset-0 z-[90] grid place-items-center overflow-y-auto bg-slate-950/75 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Pagamento com cartão">
    <Script src="https://sdk.mercadopago.com/js/v2" strategy="afterInteractive" onLoad={() => setSdkLoaded(true)} />
    <section className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
      <button type="button" onClick={onClose} disabled={sending} className="float-right text-2xl" aria-label="Fechar pagamento">×</button>
      <h2 className="text-2xl font-black">Pague com cartão</h2>
      <p className="mt-2 text-sm text-slate-600">Os dados do cartão são protegidos pelo Mercado Pago.</p>
      {message && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{message}</p>}
      {!sdkLoaded && <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Carregando formulário seguro…</p>}
      <div id="mf-card-payment-brick" className="mt-5 min-h-20" />
      {sending && <p className="mt-4 text-center text-sm font-semibold text-emerald-700">Processando pagamento…</p>}
    </section>
  </div>;
}

