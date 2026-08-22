import { getGoogleLoginUrl } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">RubriX'e Hoş Geldiniz</h1>
      <p className="text-muted-foreground">Yapay Zeka Destekli Ölçme ve Değerlendirme Sistemi</p>
      <a href={getGoogleLoginUrl()}>
        <Button size="lg">Google ile Giriş Yap</Button>
      </a>
    </div>
  );
}
