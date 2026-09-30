"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window { MercadoPago?: new (publicKey: string, options?: Record<string, unknown>) => any; }
}

type Props = {
  amount: number; publicKey: string; onSubmit: (data: {
    token: string; paymentMethodId: string; paymentType: "credit_card" | "debit_card"; installments: number;
  }) => Promise<{ ok: boolean; error?: string }>;
};

/** O SDK do Mercado Pago tokeniza o cartão no navegador antes deste callback. */
export function MercadoPagoCardBrick({ amount, publicKey, onSubmit }: Props) {
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const controller = useRef<any>(null);
  const submitRef = useRef(onSubmit);
  useEffect(() => { submitRef.current = onSubmit; }, [onSubmit]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        if (!window.MercadoPago) {
          await new Promise<void>((resolve, reject) => {
            const existing = document.querySelector('script[data-mercado-pago-sdk="true"]') as HTMLScriptElement | null;
            if (existing) { existing.addEventListener("load", () => resolve(), { once: true }); existing.addEventListener("error", () => reject(new Error("SDK indisponível")), { once: true }); return; }
            const script = document.createElement("script"); script.src = "https://sdk.mercadopago.com/js/v2"; script.async = true; script.dataset.mercadoPagoSdk = "true";
            script.onload = () => resolve(); script.onerror = () => reject(new Error("Não foi possível carregar o pagamento seguro.")); document.head.appendChild(script);
          });
        }
        if (cancelled || !window.MercadoPago) return;
        const mp = new window.MercadoPago(publicKey, { locale: "pt-BR", marketplace: true });
        controller.current = await mp.bricks().create("cardPayment", "mf-card-payment-brick", {
          initialization: { amount: Number(amount) },
          callbacks: {
            onReady: () => !cancelled && setReady(true),
            onError: () => !cancelled && setError("Não foi possível carregar o pagamento por cartão."),
            onSubmit: (formData: any, additionalData: any) => new Promise<void>((resolve, reject) => {
              submitRef.current({ token: String(formData.token || ""), paymentMethodId: String(formData.payment_method_id || ""), paymentType: additionalData?.paymentTypeId === "debit_card" ? "debit_card" : "credit_card", installments: Number(formData.installments || 1) })
                .then(result => result.ok ? resolve() : reject(new Error(result.error || "Pagamento recusado.")))
                .catch(reject);
            }),
          },
        });
      } catch (cause) { if (!cancelled) setError(cause instanceof Error ? cause.message : "Não foi possível iniciar o pagamento seguro."); }
    };
    load();
    return () => { cancelled = true; controller.current?.unmount?.(); controller.current = null; };
  }, [amount, publicKey]);

  return <div className="rounded-2xl border bg-white p-4"><p className="mb-3 text-sm font-semibold text-slate-700">Dados do cartão são protegidos pelo Mercado Pago.</p>{!ready && !error && <p className="text-sm text-slate-500">Carregando pagamento seguro...</p>}<div id="mf-card-payment-brick" />{error && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}</div>;
}
