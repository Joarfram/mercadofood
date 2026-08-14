"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

export function PasswordInput({ className = "", ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return <span className="relative mt-1 block">
    <input {...props} type={visible ? "text" : "password"} className={`${className} mt-0 pr-12`} />
    <button type="button" onClick={() => setVisible(value => !value)} aria-label={visible ? "Ocultar senha" : "Mostrar senha"} aria-pressed={visible} className="absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-xl text-gray-500 transition hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-600">
      {visible ? <EyeOff size={20}/> : <Eye size={20}/>}
    </button>
  </span>;
}
