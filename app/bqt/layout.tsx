import { redirect } from 'next/navigation'
import { createClient } from '@/lib/db/server'
import { khuBQT } from '@/lib/du-an'
import { BqtShell } from '@/components/shell/bqt-shell'

/**
 * Cổng vào khu vực Ban quản trị.
 *
 * Chốt ở LAYOUT chứ không ở từng trang: thêm một màn con sau này mà quên chốt
 * là mở cửa lặng lẽ, và không có gì nhắc. RLS vẫn là chốt chặn thật cho dữ
 * liệu — chốt ở đây là để người không phải BQT không lạc vào một khu vực nói
 * bằng giọng của một vai họ không giữ.
 *
 * Khu lấy qua khuBQT() — CÙNG hàm mà trang bên trong dùng để đọc số. Quyền
 * thì hỏi lại is_bqt của đúng khu đó: một người là BQT ở khu A và cư dân ở
 * khu B không được mang tư cách giám sát sang khu B chỉ vì đổi hộp chọn khu.
 */
export default async function BqtLayout({ children }: { children: React.ReactNode }) {
  const khu = await khuBQT()
  if (!khu) redirect('/')

  const db = await createClient()
  const { data: laBqt } = await db.rpc('is_bqt', { p_project: khu.id })
  if (!laBqt) redirect('/')

  return <BqtShell khu={khu.name}>{children}</BqtShell>
}
