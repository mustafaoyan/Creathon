import type { Bindings } from "../../../config/env";

// Llama 3.3 70B — Workers AI'nin structured-output (response_format: json_schema)
// destekleyen modellerinden, Türkçe kalitesi 8B varyantlarından belirgin şekilde iyi.
const WORKERS_AI_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

type WorkersAiRunResult = { response?: unknown };

/**
 * Anthropic'in tersine Workers AI'da zorunlu tool-call yok — bunun yerine
 * response_format: json_schema ile modelden şemaya uyan JSON isteniyor.
 * Cloudflare kendisi "şemaya %100 uyumu garanti edemeyiz" diyor; bu yüzden
 * parse hatasında (nadiren olur) anlamlı bir hata fırlatıyoruz — çağıran taraf
 * zaten her AI çıktısını insan onayına düşürüyor, sessiz bozuk veri riski yok.
 */
export async function callWorkersAiJson<T>(
  env: Bindings,
  params: { system: string; userMessage: string; jsonSchema: Record<string, unknown> },
): Promise<T> {
  const result = (await env.AI.run(WORKERS_AI_MODEL, {
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.userMessage },
    ],
    response_format: { type: "json_schema", json_schema: params.jsonSchema },
    // Varsayılan max_tokens çok düşük — JSON çıktısı (özellikle criteriaBreakdown
    // dizisi) ortasında kesilip geçersiz/parse edilemez hale geliyordu.
    max_tokens: 4096,
  })) as WorkersAiRunResult;

  const raw = result.response;
  if (raw == null) throw new Error("workers_ai_empty_response");
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as T;
    } catch {
      throw new Error(`workers_ai_invalid_json: ${raw.slice(0, 300)}`);
    }
  }
  return raw as T;
}
