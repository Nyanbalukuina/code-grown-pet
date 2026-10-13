// VS Code、プロセス起動、ローカル通信と共有仕様を読み込む。
import * as vscode from "vscode";
import { spawn, ChildProcess } from "node:child_process";
import { createServer, Server, Socket } from "node:net";
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { existsSync } from "node:fs";
import { createDecoder, encode, HEARTBEAT_MS, TIMEOUT_MS, Message } from "@code-grown-pet/protocol";

// 一つの拡張ウィンドウが所有する補助アプリと接続を保持する。
let child: ChildProcess | undefined;
let server: Server | undefined;
let socket: Socket | undefined;
let heartbeat: NodeJS.Timeout | undefined;
let startup: NodeJS.Timeout | undefined;
let lastSeen = 0;
let output: vscode.OutputChannel;
let starting = false;
let ready = false;

// ソケットとタイマーを解除する。補助アプリは接続断で自発的に終了する。
function disconnect(): void {
  if (heartbeat) clearInterval(heartbeat);
  if (startup) clearTimeout(startup);
  heartbeat = undefined;
  startup = undefined;
  socket?.destroy();
  socket = undefined;
  server?.close();
  server = undefined;
  starting = false;
  ready = false;
}

// 終了要求を送り、猶予後にまだ生存する所有プロセスだけ終了する。
function stop(): void {
  if (socket && ready) socket.write(encode({ version: 1, type: "stop" }));
  const owned = child;
  disconnect();
  if (owned) {
    const timeout = setTimeout(() => {
      if (owned.exitCode === null) owned.kill();
    }, 3000);
    timeout.unref();
  }
}

// Windowsの開発環境で補助アプリを起動し、認証済みの接続を待つ。
async function start(context: vscode.ExtensionContext): Promise<void> {
  if (starting || child) { void vscode.window.showInformationMessage("ペットは起動中です。"); return; }
  if (process.platform !== "win32" || vscode.env.remoteName) {
    void vscode.window.showWarningMessage("現在はWindowsのローカルワークスペースのみ対応しています。"); return;
  }
  starting = true;
  try {
    const companion = join(context.extensionPath, "../companion");
    if (!existsSync(join(companion, "dist/main/index.js"))) throw new Error("先にルートで npm run build を実行してください。");
    const requireCompanion = createRequire(join(companion, "package.json"));
    // VS Code内ではelectronが組み込みAPIになるため、パッケージの場所からexeを解決する。
    const electronPackage = requireCompanion.resolve("electron/package.json");
    const executable = join(dirname(electronPackage), "dist", "electron.exe");
    if (!existsSync(executable)) throw new Error("Electron本体がありません。Electronのインストールを完了してください。");
    const token = randomBytes(32).toString("hex");
    const pipe = `\\\\.\\pipe\\code-grown-pet-${randomBytes(16).toString("hex")}`;
    server = createServer((candidate) => {
      if (socket) { candidate.destroy(); return; }
      candidate.setEncoding("utf8");
      candidate.setTimeout(TIMEOUT_MS, () => candidate.destroy());
      let authenticated = false;
      candidate.on("error", (error) => output.appendLine(error.message));
      candidate.on("data", createDecoder((message: Message) => {
        if (!authenticated) {
          if (message.type !== "hello" || message.token !== token) { candidate.destroy(); return; }
          authenticated = true;
          socket = candidate;
          return;
        }
        lastSeen = Date.now();
        if (message.type === "ready" && !ready) {
          ready = true;
          starting = false;
          if (startup) clearTimeout(startup);
          heartbeat = setInterval(() => {
            if (Date.now() - lastSeen > TIMEOUT_MS) { stop(); return; }
            socket?.write(encode({ version: 1, type: "ping" }));
          }, HEARTBEAT_MS);
          output.appendLine("ペットの準備ができました。");
        }
      }, () => candidate.destroy()));
      candidate.on("close", () => { if (socket === candidate) disconnect(); });
    });
    await new Promise<void>((resolve, reject) => {
      server!.once("error", reject);
      server!.listen(pipe, resolve);
    });
    server.on("error", (error) => { output.appendLine(error.message); stop(); });
    // Electronを通常アプリとして起動し、接続情報だけ環境変数で渡す。
    const env: NodeJS.ProcessEnv = { ...process.env, CODE_GROWN_PET_PIPE: pipe, CODE_GROWN_PET_TOKEN: token };
    delete env.ELECTRON_RUN_AS_NODE;
    child = spawn(executable, [companion], { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout?.on("data", (chunk: Buffer) => output.append(chunk.toString()));
    child.stderr?.on("data", (chunk: Buffer) => output.append(chunk.toString()));
    child.once("error", (error) => { output.appendLine(error.message); void vscode.window.showErrorMessage("ペットを起動できませんでした。出力を確認してください。"); disconnect(); child = undefined; });
    child.once("exit", () => {
      const failed = starting;
      child = undefined;
      disconnect();
      if (failed) void vscode.window.showWarningMessage("ペットを開始できませんでした。別の卵が起動中か、出力を確認してください。");
    });
    startup = setTimeout(() => { output.appendLine("起動がタイムアウトしました。"); stop(); }, 15000);
  } catch (error) {
    stop();
    void vscode.window.showErrorMessage(`ペットの起動に失敗しました: ${String(error)}`);
  }
}

// コマンドを登録する。インストールしただけでは起動しない。
export function activate(context: vscode.ExtensionContext): void {
  output = vscode.window.createOutputChannel("コードで育つペット");
  context.subscriptions.push(output,
    vscode.commands.registerCommand("codeGrownPet.start", () => start(context)),
    vscode.commands.registerCommand("codeGrownPet.stop", stop),
    vscode.commands.registerCommand("codeGrownPet.toggle", () => {
      if (socket && ready) socket.write(encode({ version: 1, type: "toggle" }));
      else void vscode.window.showInformationMessage("先にペットを開始してください。");
    }),
    // 保存済みの通知だけを送り、ファイル名やコード本文は送らない。
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (socket && ready && document.uri.scheme === "file") {
        socket.write(encode({ version: 1, type: "saved" }));
      }
    }),
    { dispose: stop },
  );
}

// 通常の拡張終了では停止を要求する。異常終了は接続監視で補う。
export function deactivate(): void { stop(); }
