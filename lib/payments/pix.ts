function field(id: string, value: string) {
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

function normalize(value: string, maxLength: number) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9 .-]/g, "")
    .trim()
    .toUpperCase()
    .slice(0, maxLength);
}

function crc16(payload: string) {
  let result = 0xffff;
  for (let offset = 0; offset < payload.length; offset += 1) {
    result ^= payload.charCodeAt(offset) << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      result = (result & 0x8000) !== 0 ? (result << 1) ^ 0x1021 : result << 1;
      result &= 0xffff;
    }
  }
  return result.toString(16).toUpperCase().padStart(4, "0");
}

export type PixPayloadInput = {
  key: string;
  merchantName: string;
  merchantCity: string;
  amount: number;
  txid: string;
  description?: string;
};

export function buildPixPayload(input: PixPayloadInput) {
  const key = input.key.trim();
  if (!key) throw new Error("Configure uma chave PIX antes de gerar a cobrança.");
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("O valor do PIX precisa ser maior que zero.");

  const accountInfo = [
    field("00", "BR.GOV.BCB.PIX"),
    field("01", key),
    input.description ? field("02", normalize(input.description, 72)) : "",
  ].join("");

  const additionalData = field("05", normalize(input.txid || "***", 25) || "***");
  const amount = input.amount.toFixed(2);
  const payloadWithoutCrc = [
    field("00", "01"),
    field("26", accountInfo),
    field("52", "0000"),
    field("53", "986"),
    field("54", amount),
    field("58", "BR"),
    field("59", normalize(input.merchantName, 25) || "MERCADOFOOD"),
    field("60", normalize(input.merchantCity, 15) || "ARACAJU"),
    field("62", additionalData),
    "6304",
  ].join("");

  return `${payloadWithoutCrc}${crc16(payloadWithoutCrc)}`;
}
