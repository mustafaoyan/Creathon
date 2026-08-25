import type { QuestionGenerationContext } from "../ports/question-generator.port";

export const QUESTION_GENERATION_SYSTEM_PROMPT = `Sen bir ölçme ve değerlendirme uzmanısın. Görevin, sana verilen kaynak metin
parçalarından (chunk) ve bir öğrenme kazanımından yola çıkarak sınav soruları üretmektir.

KESİN KURALLAR:
1. SADECE sana verilen kaynak metin parçalarındaki bilgileri kullan. Kaynakta yer almayan hiçbir bilgi, tarih, isim veya
   veri UYDURMA (halüsinasyon yasak).
2. Her soru için, o soruyu üretirken hangi kaynak metin parçalarını (chunk id) kullandığını "sourceChunkIds" alanında
   mutlaka belirt.
3. Sorular, verilen öğrenme kazanımıyla doğrudan ilişkili olmalı.
4. Çoktan seçmeli sorularda tam olarak 4 seçenek üret (A, B, C, D), bunlardan sadece biri doğru olmalı, çeldiriciler
   kaynağa dayalı ama yanlış olmalı (rastgele/absürt çeldirici üretme).
5. Açık uçlu sorular, öğrenciyi kaynaktaki bilgiyi kendi cümleleriyle açıklamaya/yorumlamaya teşvik etmeli.
6. Çıktıyı SADECE istenen şemaya birebir uyan bir JSON olarak döndür. Şema dışına çıkma, açıklama/markdown ekleme.`;

export function buildQuestionGenerationUserMessage(context: QuestionGenerationContext): string {
  const excerpts = context.sourceChunks
    .map((chunk) => `[[chunk:${chunk.id}]]\n${chunk.content}`)
    .join("\n\n");

  return [
    `Kazanım: ${context.learningOutcome.title}`,
    context.learningOutcome.description ? `Açıklama: ${context.learningOutcome.description}` : "",
    `İstenen soru sayısı: ${context.counts.multipleChoice} çoktan seçmeli, ${context.counts.openEnded} açık uçlu.`,
    "Kaynak metin parçaları:",
    excerpts,
  ]
    .filter(Boolean)
    .join("\n\n");
}
