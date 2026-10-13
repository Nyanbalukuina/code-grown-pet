// Electronのウィンドウ・画面・トレイ操作とパス操作を読み込む。
import { app, BrowserWindow, Menu, screen, Tray } from "electron";
import { join } from "node:path";
import { connectOwner, notifyReady, closeOwner } from "./connection";

// ウィンドウとトレイの参照を保持する。
const WINDOW_SIZE = 128;
const MARGIN = 24;
let petWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let lastReaction = 0;

// タスクバーを避けたメイン画面の右下へ配置する。
function positionWindow(): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  const area = screen.getPrimaryDisplay().workArea;
  const x = Math.max(area.x, area.x + area.width - WINDOW_SIZE - MARGIN);
  const y = Math.max(area.y, area.y + area.height - WINDOW_SIZE - MARGIN);
  petWindow.setPosition(x, y);
}

// 透明・枠なしのウィンドウを作り、操作を背後へ通す。
async function createWindow(): Promise<void> {
  petWindow = new BrowserWindow({
    width: WINDOW_SIZE,
    height: WINDOW_SIZE,
    title: "コードで育つペット",
    transparent: true,
    backgroundColor: "#00000000",
    frame: false,
    hasShadow: false,
    resizable: false,
    alwaysOnTop: true,
    focusable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  petWindow.setIgnoreMouseEvents(true);
  positionWindow();
  await petWindow.loadFile(join(__dirname, "../../src/renderer/index.html"));
  petWindow.showInactive();
}

// 連続保存の反応は1.5秒に1回とし、非表示中は演出しない。
function reactToSave(): void {
  if (!petWindow || petWindow.isDestroyed() || !petWindow.isVisible()) return;
  const now = Date.now();
  if (now - lastReaction < 1500) return;
  lastReaction = now;
  petWindow.webContents.send("pet:saved");
}

// 表示切り替えはフォーカスを奪わず行う。
function toggleWindow(): void {
  if (!petWindow || petWindow.isDestroyed()) return;
  if (petWindow.isVisible()) petWindow.hide();
  else petWindow.showInactive();
}

// クリックできない卵の代わりに、トレイから終了できるようにする。
function createTray(): void {
  tray = new Tray(join(__dirname, "../../assets/tray.png"));
  tray.setToolTip("コードで育つペット");
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "表示切り替え", click: toggleWindow },
    { label: "終了", click: () => app.quit() },
  ]));
}

// 終了時にトレイを破棄して参照を解放する。
app.on("will-quit", () => {
  closeOwner();
  tray?.destroy();
  tray = null;
});

// ウィンドウが閉じられた場合も常駐を残さず終了する。
app.on("window-all-closed", () => app.quit());

// 二重起動を防ぎ、準備完了後にトレイと卵を表示する。
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(async () => {
    await connectOwner(toggleWindow, reactToSave);
    createTray();
    await createWindow();
    notifyReady();
    // 画面の接続・切断や拡大率変更に合わせて再配置する。
    screen.on("display-added", positionWindow);
    screen.on("display-removed", positionWindow);
    screen.on("display-metrics-changed", positionWindow);
  }).catch((error: unknown) => {
    console.error("ペットの起動に失敗しました:", error);
    app.quit();
  });
}
