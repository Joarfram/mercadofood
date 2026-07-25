import type { ReactNode } from "react";

export function Card({
  title,
  value,
  detail,
  children
}: {
  title?: string;
  value?: string;
  detail?: string;
  children?: ReactNode;
}) {
  return (
    <section className="rounded-card border border-gray-200 bg-white p-5 shadow-sm">
      {title ? <p className="text-sm font-medium text-gray-500">{title}</p> : null}
      {value ? <p className="mt-2 text-3xl font-bold text-mercado-ink">{value}</p> : null}
      {detail ? <p className="mt-1 text-sm text-gray-500">{detail}</p> : null}
      {children}
    </section>
  );
}
