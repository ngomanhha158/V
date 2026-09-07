'use client'
import { useEffect, useState } from 'react'
import { dangKyPush, goPush } from './actions'
import { Button, Hop } from '@/components/ui'

/**
 * Bật thông báo đẩy trên MÁY NÀY.
 *
 * "Máy này" chứ không phải "tài khoản này" — và giao diện phải nói đúng như
 * vậy. Đăng ký push gắn với một trình duyệt trên một máy: bật trên điện thoại
 * xong mở máy tính ra vẫn phải bật lại. Gọi nó là "bật thông báo" chung chung
 * thì người ta bật một lần rồi tưởng đã xong ở mọi nơi.
 */
type TT = 'dang-do' | 'khong-ho-tro' | 'bi-chan' | 'chua-bat' | 'da-bat' | 'dang-lam'

export function BatPush({ khoaCong }: { khoaCong: string | null }) {
  const [tt, datTT] = useState<TT>('dang-do')
  const [loi, datLoi] = useState<string | null>(null)

  useEffect(() => {
    (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        datTT('khong-ho-tro'); return
      }
      if (Notification.permission === 'denied') { datTT('bi-chan'); return }
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      datTT(sub ? 'da-bat' : 'chua-bat')
    })().catch(() => datTT('khong-ho-tro'))
  }, [])

  if (!khoaCong) {
    return (
      <Hop tone="canh" title="Thông báo đẩy chưa được bật cho hệ thống">
        Ban quản lý cần đặt khoá VAPID cho service <code className="num">v</code>.
        Trong lúc chưa có, thông báo vẫn nằm đủ ở màn này — chỉ là điện thoại
        không rung khi có tin mới.
      </Hop>
    )
  }

  async function bat() {
    datLoi(null); datTT('dang-lam')
    try {
      const quyen = await Notification.requestPermission()
      if (quyen !== 'granted') { datTT(quyen === 'denied' ? 'bi-chan' : 'chua-bat'); return }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: doiKhoa(khoaCong!),
      })
      const j = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      if (!j.endpoint || !j.keys?.p256dh || !j.keys?.auth) {
        throw new Error('Trình duyệt trả về đăng ký thiếu khoá.')
      }
      const r = await dangKyPush(j.endpoint, j.keys.p256dh, j.keys.auth, tenMay())
      if (!r.ok) {
        // Ghi phía máy chủ hỏng mà vẫn để đăng ký ở trình duyệt là trạng thái
        // dối: nút hiện "đã bật", còn máy chủ thì không biết máy này tồn tại.
        await sub.unsubscribe().catch(() => {})
        throw new Error(r.loi ?? 'Không lưu được đăng ký.')
      }
      datTT('da-bat')
    } catch (e) {
      datLoi((e as Error).message); datTT('chua-bat')
    }
  }

  async function tat() {
    datLoi(null); datTT('dang-lam')
    try {
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (sub) { await goPush(sub.endpoint); await sub.unsubscribe() }
      datTT('chua-bat')
    } catch (e) {
      datLoi((e as Error).message); datTT('da-bat')
    }
  }

  if (tt === 'dang-do') return null

  if (tt === 'khong-ho-tro') {
    return (
      <Hop tone="trung" title="Máy này chưa nhận được thông báo đẩy">
        Trên iPhone và iPad, Safari chỉ cho phép sau khi bạn bấm{' '}
        <strong>Chia sẻ → Thêm vào màn hình chính</strong> rồi mở app từ biểu
        tượng đó. Trên Android và máy tính thì dùng Chrome hoặc Edge.
      </Hop>
    )
  }

  if (tt === 'bi-chan') {
    return (
      <Hop tone="canh" title="Bạn đã chặn thông báo cho trang này">
        Trình duyệt không hỏi lại nữa sau khi bị chặn. Mở biểu tượng ổ khoá cạnh
        thanh địa chỉ → Thông báo → Cho phép, rồi tải lại trang.
      </Hop>
    )
  }

  return (
    <Hop tone={tt === 'da-bat' ? 'tot' : 'trung'}
         title={tt === 'da-bat' ? 'Máy này đang nhận thông báo' : 'Bật thông báo trên máy này'}>
      {tt === 'da-bat'
        ? 'Nhắc hạn hóa đơn và kiện hàng ở quầy sẽ hiện ra ngay cả khi bạn không mở app.'
        : 'Không bật thì chỉ thấy thông báo lúc tự mở app — nhắc nợ trước hạn 3 ngày sẽ trôi qua mà bạn không biết.'}
      {' '}
      <span className="mt-2 block text-[0.75rem]">
        Đăng ký gắn với <strong>máy và trình duyệt này</strong>. Dùng thêm máy
        khác thì bật lại ở máy đó.
      </span>
      {loi && <span className="mt-2 block text-bad">{loi}</span>}
      <span className="mt-3 block">
        <Button
          type="button" co="sm" disabled={tt === 'dang-lam'}
          dang={tt === 'da-bat' ? undefined : 'chinh'}
          onClick={tt === 'da-bat' ? tat : bat}
        >
          {tt === 'dang-lam' ? 'Đang xử lý…' : tt === 'da-bat' ? 'Tắt trên máy này' : 'Bật thông báo'}
        </Button>
      </span>
    </Hop>
  )
}

/** base64url -> byte. Trình duyệt đòi khoá ở dạng byte, còn khoá VAPID lưu ở
 *  dạng base64url — dán thẳng chuỗi vào là subscribe() ném lỗi khó hiểu.
 *
 *  Uint8Array<ArrayBuffer> chứ không Uint8Array trần: kiểu trần gồm cả
 *  SharedArrayBuffer, mà API của trình duyệt chỉ nhận vùng nhớ không chia sẻ. */
function doiKhoa(b64: string): Uint8Array<ArrayBuffer> {
  const dem = '='.repeat((4 - (b64.length % 4)) % 4)
  const s = (b64 + dem).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(s)
  const ra = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) ra[i] = raw.charCodeAt(i)
  return ra
}

/** Đủ để người ta nhận ra máy nào, không phải dấu vân tay đầy đủ. */
function tenMay(): string {
  const ua = navigator.userAgent
  const may = /Android/i.test(ua) ? 'Android'
    : /iPhone|iPad|iPod/i.test(ua) ? 'iPhone/iPad'
    : /Mac/i.test(ua) ? 'máy Mac'
    : /Windows/i.test(ua) ? 'máy Windows' : 'máy khác'
  const tr = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) ? 'Safari' : 'trình duyệt khác'
  return `${tr} trên ${may}`
}
