import webpush from 'web-push'
import { createAdminClient } from '@/lib/db/admin'

/**
 * Thông báo đẩy (Web Push) — kênh thay cho Zalo ZNS đang hoãn (§3bis của
 * PLAN-30-NGAY.md).
 *
 * Trước khi có nó, ba cơ chế nhắc đã dựng xong đều không tới được ai:
 * nhắc nợ chạy 08:00 mỗi ngày, kiện hàng về quầy, kiện để quá 3 ngày — cả ba
 * ghi một dòng vào `notifications` rồi thôi, và cư dân chỉ thấy nếu tự mở app.
 *
 * CHƯA CẤU HÌNH THÌ NÓI RA, KHÔNG IM LẶNG BỎ QUA. Thiếu khoá VAPID mà vẫn trả
 * "đã đẩy 0 thông báo" là lịch cron xanh mỗi ngày trong khi không ai nhận được
 * gì — đúng kiểu hỏng mà cả hệ thống này đang đi dọn.
 */

export function kiemCauHinhPush(): string[] {
  const loi: string[] = []
  if (!process.env.VAPID_PUBLIC_KEY) {
    loi.push('Thiếu VAPID_PUBLIC_KEY. Sinh cặp khoá: npx web-push generate-vapid-keys')
  }
  if (!process.env.VAPID_PRIVATE_KEY) {
    loi.push('Thiếu VAPID_PRIVATE_KEY. Đây là KHOÁ BÍ MẬT — đặt ở Variables của service `v`, không commit.')
  }
  if (!process.env.VAPID_SUBJECT) {
    loi.push('Thiếu VAPID_SUBJECT. Dạng "mailto:bql@ten-mien-cua-ban" — nhà cung cấp push dùng nó để liên hệ khi có sự cố.')
  }
  return loi
}

export const daBatPush = () => kiemCauHinhPush().length === 0

/** Khoá CÔNG — an toàn để đưa xuống trình duyệt, và bắt buộc phải đưa: trình
 *  duyệt cần nó để mã hoá cho đúng máy chủ. */
export function khoaCongPush(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null
}

function nap() {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  )
}

type DongCanDay = {
  id: number; title: string; body: string | null
  kind: string; ref_id: string | null
  endpoint: string; p256dh: string; auth: string
}

/** Mỗi loại thông báo mở ra một màn khác nhau — bấm vào mà không đi đâu thì
 *  lần sau người ta không bấm nữa. Giữ khớp với bảng LOAI ở màn Thông báo. */
function duongDan(kind: string, ref: string | null): string {
  switch (kind) {
    case 'invoice':      return ref ? `/invoices/${ref}` : '/invoices'
    case 'ticket':       return ref ? `/tickets/${ref}` : '/tickets'
    case 'announcement': return '/bang-tin'
    case 'approval':     return '/approvals'
    case 'kien_hang':    return '/kien-hang'
    default:             return '/thong-bao'
  }
}

export type KetQuaDay = {
  gui: number          // số lượt đẩy thành công
  danhDau: number      // số thông báo được đánh dấu đã đẩy
  goMayChet: number    // endpoint bị nhà cung cấp từ chối, đã gỡ
  loiKhac: number      // lỗi tạm — KHÔNG đánh dấu, để lần sau thử lại
}

/**
 * Đẩy các thông báo chưa đẩy. Gọi từ job nền.
 *
 * Một thông báo có thể ứng với nhiều máy (điện thoại + máy tính). Chỉ đánh dấu
 * "đã đẩy" khi có ÍT NHẤT một máy nhận được — đánh dấu khi cả hai đều hỏng là
 * nuốt mất thông báo, và người ta không bao giờ biết mình đã bị nhắc.
 */
export async function dayThongBao(): Promise<KetQuaDay> {
  const thieu = kiemCauHinhPush()
  if (thieu.length > 0) throw new Error(`Chưa cấu hình push. ${thieu.join(' ')}`)
  nap()

  const db = await createAdminClient()
  const { data, error } = await db.rpc('thong_bao_can_day', { p_gioi_han: 200 })
  if (error) throw new Error(`Không đọc được hàng đợi thông báo: ${error.message}`)

  const ds = (data ?? []) as DongCanDay[]
  const kq: KetQuaDay = { gui: 0, danhDau: 0, goMayChet: 0, loiKhac: 0 }
  if (ds.length === 0) return kq

  const xong = new Set<number>()     // thông báo có ít nhất một máy nhận được
  const chet = new Set<string>()     // endpoint nhà cung cấp bảo bỏ đi
  const song = new Set<string>()     // endpoint vừa nhận được

  await Promise.all(ds.map(async (d) => {
    try {
      await webpush.sendNotification(
        { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
        JSON.stringify({
          title: d.title,
          body: d.body ?? '',
          url: duongDan(d.kind, d.ref_id),
          tag: `${d.kind}:${d.id}`,
        }),
        { TTL: 24 * 60 * 60 },
      )
      xong.add(d.id); song.add(d.endpoint); kq.gui += 1
    } catch (e) {
      // 404/410 = máy đã gỡ app hoặc trình duyệt xoá đăng ký. Giữ lại thì mỗi
      // ngày lại đẩy vào một endpoint đã chết, và tỷ lệ lỗi che mất lỗi thật.
      const ma = (e as { statusCode?: number }).statusCode
      if (ma === 404 || ma === 410) { chet.add(d.endpoint); kq.goMayChet += 1 }
      else { kq.loiKhac += 1; console.error('push loi:', ma, (e as Error).message) }
    }
  }))

  if (chet.size > 0) {
    await db.rpc('push_go_endpoint_chet', { p_endpoints: [...chet] })
  }
  if (song.size > 0) {
    await db.rpc('push_ghi_nhan_day', { p_endpoints: [...song] })
  }
  if (xong.size > 0) {
    const { data: n } = await db.rpc('thong_bao_da_day', { p_ids: [...xong] })
    kq.danhDau = Number(n ?? 0)
  }
  return kq
}
