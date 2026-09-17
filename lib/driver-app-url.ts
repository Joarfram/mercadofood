export const DRIVER_APP_ORIGIN = "https://www.meumercadofood.com";

export const DRIVER_LOGIN_URL = new URL("/entregador/login", DRIVER_APP_ORIGIN).toString();

export function buildDriverActivationUrl(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const url = new URL("/entregador/cadastro", DRIVER_APP_ORIGIN);

  if (normalizedEmail) url.searchParams.set("email", normalizedEmail);

  return url.toString();
}
