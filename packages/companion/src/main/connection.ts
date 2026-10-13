// 名前付きパイプで所有元の拡張と通信する。
import { app } from "electron";
import { connect, Socket } from "node:net";
import { createDecoder, encode, HEARTBEAT_MS, TIMEOUT_MS } from "@code-grown-pet/protocol";
let socket: Socket | undefined;
let monitor: NodeJS.Timeout | undefined;
let lastSeen = Date.now();

// 単体起動なら接続せず、拡張起動なら認証と生存監視を開始する。
export async function connectOwner(onToggle: () => void, onSaved: () => void): Promise<void> {
  const pipe = process.env.CODE_GROWN_PET_PIPE;
  const token = process.env.CODE_GROWN_PET_TOKEN;
  if (!pipe && !token) return;
  if (!pipe || !token) throw new Error("拡張との接続情報が不足しています。");
  await new Promise<void>((resolve, reject) => {
    socket = connect(pipe);
    socket.setEncoding("utf8");
    socket.once("error", reject);
    socket.on("error", () => app.quit());
    socket.on("close", () => app.quit());
    socket.on("data", createDecoder((message) => {
      if (message.type === "ping") {
        lastSeen = Date.now();
        socket?.write(encode({ version: 1, type: "ping" }));
      } else if (message.type === "stop") app.quit();
      else if (message.type === "toggle") onToggle();
      else if (message.type === "saved") onSaved();
      else socket?.destroy();
    }, () => socket?.destroy()));
    socket.once("connect", () => {
      socket!.write(encode({ version: 1, type: "hello", token }));
      resolve();
    });
  });
  monitor = setInterval(() => { if (Date.now() - lastSeen > TIMEOUT_MS) app.quit(); }, HEARTBEAT_MS);
}

// 描画の準備が完了してから拡張へ通知する。
export function notifyReady(): void { socket?.write(encode({ version: 1, type: "ready" })); }

// アプリ終了時に通信資源を解放する。
export function closeOwner(): void {
  if (monitor) clearInterval(monitor);
  socket?.destroy();
}
