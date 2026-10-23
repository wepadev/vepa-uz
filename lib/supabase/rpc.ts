import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * RPC chaqiruvlari uchun yumshoq tiplangan mijoz.
 *
 * Muammo: loyihada Supabase tiplari generatsiya qilinmagan, shuning
 * uchun `supabase.rpc("mening_funksiyam")` TypeScript uchun noma'lum
 * nom bo'lib chiqadi. Shu sababli olti xil faylda `supabase as any`
 * yozilgan edi — har biri alohida "teshik".
 *
 * Endi teshik bitta va u shu yerda, izohi bilan. Qaytgan ma'lumot
 * `unknown` — chaqiruvchi tomon uni o'zi kerakli tipga o'giradi,
 * ya'ni `any` kabi jimgina hamma narsaga ruxsat bermaydi.
 */
type RpcResult = {
  data: unknown;
  error: { message: string } | null;
};

type RpcCapableClient = {
  rpc: (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<RpcResult>;
};

export function asRpcClient(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any, any, any>,
): RpcCapableClient {
  return supabase as unknown as RpcCapableClient;
}
