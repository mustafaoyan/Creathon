// Sınav oluşturma tam bir formdur (başlık, süre, katılımcı listesi, soru seçimi)
// ama soru seçimi ayrı bir sayfada (/exams/pool) yapılıyor — bu uygulamada
// client-side router yok, /exams/new <-> /exams/pool arası her gidiş-geliş
// TAM SAYFA YENİLEMESİ. Sadece soru seçimini sessionStorage'da tutmak yetmiyordu:
// eğitmen başlık/süre/katılımcı gibi alanları doldurup "Soru Havuzu"na girip
// geri dönünce hepsi sıfırlanıyordu (kullanıcı testinde bulundu). Artık TÜM
// taslak burada — sessionStorage (localStorage değil, sekme kapanınca yarım
// kalmış bir sınav taslağı otomatik temizlensin).
export type ExamDraft = {
  title: string;
  durationMinutes: string;
  allowlistRaw: string;
  selectedQuestionIds: string[];
};

const STORAGE_KEY = "rubrix:examDraft";

const EMPTY_DRAFT: ExamDraft = { title: "", durationMinutes: "", allowlistRaw: "", selectedQuestionIds: [] };

function readDraft(): ExamDraft {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<ExamDraft>) } : { ...EMPTY_DRAFT };
  } catch {
    return { ...EMPTY_DRAFT };
  }
}

function writeDraft(patch: Partial<ExamDraft>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readDraft(), ...patch }));
  } catch {
    // sessionStorage kullanılamıyorsa (gizli sekme vb.) sessizce yok say —
    // taslak o oturumda kalıcı olmaz ama uygulama çökmez.
  }
}

export function getExamDraft(): ExamDraft {
  return readDraft();
}

export function updateExamDraft(patch: Partial<Omit<ExamDraft, "selectedQuestionIds">>) {
  writeDraft(patch);
}

export function getSelectedQuestionIds(): Set<string> {
  return new Set(readDraft().selectedQuestionIds);
}

export function setSelectedQuestionIds(ids: Set<string>) {
  writeDraft({ selectedQuestionIds: Array.from(ids) });
}

export function clearExamDraft() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // yukarıdaki gibi
  }
}
