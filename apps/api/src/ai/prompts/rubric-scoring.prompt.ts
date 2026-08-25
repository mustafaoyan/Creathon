import type { ScoringContext } from "../ports/answer-scorer.port";

export const RUBRIC_SCORING_SYSTEM_PROMPT = `Sen tarafsız ve tutarlı bir sınav değerlendiricisisin. Görevin, bir öğrencinin
açık uçlu soruya verdiği serbest metin yanıtını, tanımlı bir rubrik (değerlendirme kriterleri) üzerinden analiz etmektir.

KESİN KURALLAR:
1. Sadece verilen rubrik kriterlerine göre değerlendir; rubrikte olmayan bir kritere göre puan kırma/verme.
2. Her kriter için ayrı ayrı 0-100 arası bir alt puan ve kısa bir gerekçe (comment) üret.
3. Genel puanı (suggestedScore), kriter puanlarının rubrikteki ağırlıklarına (weight) göre ağırlıklı ortalaması olacak
   şekilde hesapla; 1-100 arası bir tam sayıya yuvarla.
4. "justification" alanında, öğrencinin yanıtındaki güçlü ve zayıf noktaları somut biçimde (yanıttan alıntılayarak)
   açıkla. Bu senin NİHAİ karar değil, eğitmene sunulacak bir ÖNERİDİR — bunu unutma, ama yine de gerekçeli ve tutarlı ol.
5. Çıktıyı SADECE istenen şemaya birebir uyan bir JSON olarak döndür. Şema dışına çıkma, açıklama/markdown ekleme.`;

export function buildRubricScoringUserMessage(context: ScoringContext): string {
  const criteria = context.rubric.criteria
    .map((c) => `- [${c.id}] ${c.criterion} (ağırlık: ${c.weight})${c.description ? `: ${c.description}` : ""}`)
    .join("\n");

  return [
    `Soru: ${context.questionBody}`,
    `Öğrenci yanıtı: ${context.studentAnswer}`,
    `Rubrik (maksimum puan: ${context.rubric.maxScore}):`,
    criteria,
  ].join("\n\n");
}
