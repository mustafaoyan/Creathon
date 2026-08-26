import { useEffect, useState } from "react";
import { toast, type ToastItem, type ToastVariant } from "@/lib/toast";

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-primary/50 text-white",
  error: "border-destructive/60 text-white",
  info: "border-white/25 text-white",
};

const VARIANT_ICON: Record<ToastVariant, string> = {
  success: "✓",
  error: "!",
  info: "ℹ",
};

/** App.tsx'in <body>'sine bir kere monte edilir — her sayfada, her zaman
 * ekranın en üst katmanında (z-[9999]) sağ üstte durur, sayfa kaydırılsa da
 * kaybolmaz. Server-side hiç toast yok (boş render), hydration mismatch riski
 * yok — toast'lar sadece client etkileşimiyle tetikleniyor. */
export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => toast.subscribe(setItems), []);

  if (items.length === 0) return null;

  return (
    <div className="fixed right-4 top-20 z-[9999] flex w-full max-w-sm flex-col gap-2 print:hidden">
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className={`rbx-toast-in rbx-glass flex items-start gap-3 rounded-lg p-3 text-sm shadow-lg ${VARIANT_STYLES[item.variant]}`}
        >
          <span aria-hidden="true" className="mt-0.5 font-bold">
            {VARIANT_ICON[item.variant]}
          </span>
          <span className="flex-1 text-left">{item.message}</span>
          <button
            type="button"
            onClick={() => toast.dismiss(item.id)}
            aria-label="Bildirimi kapat"
            className="cursor-pointer text-white/50 transition-colors hover:text-white"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
