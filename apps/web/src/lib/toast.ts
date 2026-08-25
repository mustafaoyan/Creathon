export type ToastVariant = "success" | "error" | "info";
export type ToastItem = { id: string; variant: ToastVariant; message: string };

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

function push(variant: ToastVariant, message: string) {
  const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  toasts = [...toasts, { id, variant, message }];
  emit();
  setTimeout(() => dismiss(id), 5000);
}

function dismiss(id: string) {
  toasts = toasts.filter((item) => item.id !== id);
  emit();
}

/** Basit pub-sub — herhangi bir sayfadan `toast.success("...")` çağırınca
 * App.tsx'e bir kere monte edilen <ToastContainer> bunu gösteriyor. Sayfaya
 * özel inline mesajların aksine, kaydırma pozisyonundan bağımsız her zaman
 * ekranın sağ üstünde sabit kalıyor — daha önce yaşanan "uyarı görünmüyordu"
 * sınıfı bug'lar için genel çözüm. */
export const toast = {
  success: (message: string) => push("success", message),
  error: (message: string) => push("error", message),
  info: (message: string) => push("info", message),
  dismiss,
  subscribe(listener: Listener) {
    listeners.add(listener);
    listener(toasts);
    return () => {
      listeners.delete(listener);
    };
  },
};
