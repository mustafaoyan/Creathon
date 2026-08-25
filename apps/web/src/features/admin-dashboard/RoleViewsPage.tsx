const ROLE_VIEWS = [
  { href: "/content/upload", label: "İçerik Uzmanı gözüyle" },
  { href: "/exams/new", label: "Eğitmen gözüyle" },
  { href: "/exams/take", label: "Öğrenci gözüyle" },
];

export function RoleViewsPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Rol Görünümleri</h1>
      <p className="text-sm text-muted-foreground">
        Yönetici olarak diğer rollerin ekranlarını, ayrı bir hesaba giriş yapmadan gezebilirsin.
      </p>
      <div className="flex flex-wrap gap-2">
        {ROLE_VIEWS.map((view) => (
          <a
            key={view.href}
            href={view.href}
            className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            {view.label}
          </a>
        ))}
      </div>
    </div>
  );
}
