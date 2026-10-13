// 通信量と接続監視の共通値を定義する。
export const VERSION = 1;
export const MAX_LINE = 4096;
export const HEARTBEAT_MS = 2000;
export const TIMEOUT_MS = 10000;
export type Message =
  | { version: 1; type: "hello"; token: string }
  | { version: 1; type: "ready" | "ping" | "stop" | "toggle" | "saved" };

// JSONを信頼せず、種類とフィールドを実行時に検証する。
export function parseMessage(line: string): Message | null {
  if (Buffer.byteLength(line, "utf8") > MAX_LINE) return null;
  try {
    const value: unknown = JSON.parse(line);
    if (!value || typeof value !== "object") return null;
    const record = value as Record<string, unknown>;
    if (record.version !== VERSION) return null;
    if (record.type === "hello" && typeof record.token === "string" && /^[a-f0-9]{64}$/.test(record.token)) {
      return { version: VERSION, type: "hello", token: record.token };
    }
    if (typeof record.type === "string" && ["ready", "ping", "stop", "toggle", "saved"].includes(record.type)) {
      return { version: VERSION, type: record.type as "ready" | "ping" | "stop" | "toggle" | "saved" };
    }
    return null;
  } catch {
    return null;
  }
}

// 改行で区切ったメッセージを、分割・結合された受信にも対応して読み取る。
export function createDecoder(onMessage: (message: Message) => void, onInvalid: () => void): (chunk: string) => void {
  let pending = "";
  let invalid = false;
  return (chunk) => {
    if (invalid) return;
    pending += chunk;
    let newline: number;
    while ((newline = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, newline);
      pending = pending.slice(newline + 1);
      const message = parseMessage(line);
      if (!message) { invalid = true; onInvalid(); return; }
      onMessage(message);
    }
    if (Buffer.byteLength(pending, "utf8") > MAX_LINE) { invalid = true; onInvalid(); }
  };
}

// 送信形式を一か所にまとめる。
export function encode(message: Message): string {
  return JSON.stringify(message) + "\n";
}
