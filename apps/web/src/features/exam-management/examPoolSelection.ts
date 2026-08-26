// Soru Havuzu artık ayrı bir sayfa (/exams/pool) — sayfalar arası gezinme tam
// sayfa yenilemesi olduğu için (bu uygulamada client-side router yok), seçilen
// soru id'leri React state'inde değil sessionStorage'da tutuluyor ki eğitmen
// /exams/new <-> /exams/pool arasında gidip geldikçe seçim kaybolmasın.
// sessionStorage (localStorage değil) kasıtlı: sekme kapanınca yarım kalmış bir
// sınav taslağı otomatik temizlensin, ileride kafa karıştırmasın.
const STORAGE_KEY = "rubrix:examPool:selectedQuestionIds";

export function getSelectedQuestionIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

export function setSelectedQuestionIds(ids: Set<string>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // sessionStorage kullanılamıyorsa (gizli sekme vb.) sessizce yok say —
    // seçim o oturumda kalıcı olmaz ama uygulama çökmez.
  }
}

export function clearSelectedQuestionIds() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // yukarıdaki gibi
  }
}
