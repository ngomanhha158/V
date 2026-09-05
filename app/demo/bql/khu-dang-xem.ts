import { cookies } from 'next/headers'
import { KHU_DEMO, type KhuDemo } from '@/lib/demo/data'

// Không để trong chon-khu.ts: một file 'use server' chỉ được export hàm async,
// một hằng số ở đó làm cả module không export được gì cả.
export const TEN_COOKIE_KHU_DEMO = 'vb_khu_demo'

/** Khu đang xem của bản demo. Cùng luật rơi về khu đầu như bản thật. */
export async function khuDemoDangXem(): Promise<KhuDemo> {
  const luu = (await cookies()).get(TEN_COOKIE_KHU_DEMO)?.value
  return KHU_DEMO.find((k) => k.id === luu) ?? KHU_DEMO[0]
}
