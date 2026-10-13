// preloadが公開する最小限のAPIの型を定義する。
declare const pet: { onSaved(callback: () => void): () => void };

// 保存されたら卵を短く揺らす。動きを減らす設定では明滅だけにする。
const egg = document.querySelector<HTMLImageElement>(".egg");
let reaction: Animation | undefined;
const unsubscribe = pet.onSaved(() => {
  if (!egg) return;
  reaction?.cancel();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  reaction = egg.animate(
    reducedMotion
      ? [{ opacity: 1 }, { opacity: 0.65 }, { opacity: 1 }]
      : [
          { transform: "translateY(0) rotate(0deg)" },
          { transform: "translateY(-5px) rotate(-10deg)", offset: 0.25 },
          { transform: "translateY(-7px) rotate(10deg)", offset: 0.5 },
          { transform: "translateY(-3px) rotate(-6deg)", offset: 0.75 },
          { transform: "translateY(0) rotate(0deg)" },
        ],
    { duration: 650, easing: "ease-in-out" },
  );
});

// ウィンドウを破棄するときに購読と演出を解除する。
window.addEventListener("beforeunload", () => {
  unsubscribe();
  reaction?.cancel();
}, { once: true });
