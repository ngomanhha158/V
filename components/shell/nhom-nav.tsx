'use client'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '@/components/ui'
import { IcPhai } from '@/components/icons'

/**
 * Một nhóm mục trong thanh bên BQL, gập lại được.
 *
 * VÌ SAO CẦN: thanh bên có 34 mục. Trên màn hình cao 900px thì hơn một phần ba
 * nằm dưới mép, và người trực ban phải cuộn qua "Nhập từ Excel" — thứ họ đụng
 * ba lần trong đời — để tới "Công nợ". Nhóm theo TẦN SUẤT ĐỤNG TỚI, rồi gập
 * sẵn mấy nhóm dựng hệ thống, là cách rẻ nhất để việc hằng ngày nằm hết trên
 * một màn.
 *
 * BA CHỐT:
 *
 * 1. GẬP CHỈ CÓ Ở MÀN HÌNH RỘNG. Trên điện thoại thanh này là dải cuộn ngang,
 *    nhãn nhóm đã ẩn sẵn, và giấu bớt mục chỉ làm mất đường đi. Nên mọi thứ ở
 *    đây đều gắn `lg:`.
 *
 * 2. NHÓM CHỨA TRANG ĐANG MỞ THÌ LUÔN BUNG RA. Gập mất đúng cái trang người
 *    ta đang đứng là để họ không biết mình đang ở đâu. Nhận biết bằng cách hỏi
 *    DOM có `aria-current="page"` không, thay vì bắt mỗi nhóm khai lại danh
 *    sách đường dẫn của mình — khai tay thì thêm một màn là quên một chỗ, và
 *    cái quên đó im lặng.
 *
 *    Hệ quả: không gập được cái nhóm mình đang đứng trong đó. Đúng như vậy —
 *    một thanh điều hướng giấu vị trí hiện tại thì đang nói dối.
 *
 * 3. NHỚ LỰA CHỌN, nhưng lần dựng đầu tiên phải khớp với server (localStorage
 *    chưa đọc được lúc render lần đầu). Nên `luu` khởi tạo null và chỉ được
 *    lấp sau khi gắn — không có cái đó thì React kêu lệch hydrate.
 */
const KHOA = 'vb-nhom:'

export function NhomNav({
  nhan, moSan = true, children,
}: { nhan: string; moSan?: boolean; children: ReactNode }) {
  const boc = useRef<HTMLDivElement>(null)
  const [dangTrong, setDangTrong] = useState(false)
  // Không có mảng phụ thuộc: chạy lại sau MỌI lần dựng, mà NavDoc dựng lại mỗi
  // khi đổi đường dẫn — nên nhóm bung/gập theo đúng nhịp điều hướng.
  useEffect(() => {
    setDangTrong(!!boc.current?.querySelector('[aria-current="page"]'))
  })

  const [luu, setLuu] = useState<boolean | null>(null)
  useEffect(() => {
    try {
      const v = localStorage.getItem(KHOA + nhan)
      if (v === '0' || v === '1') setLuu(v === '1')
    } catch { /* trình duyệt chặn lưu trữ: cứ dùng mặc định */ }
  }, [nhan])

  const mo = dangTrong || (luu ?? moSan)
  function doi() {
    const moi = !mo
    setLuu(moi)
    try { localStorage.setItem(KHOA + nhan, moi ? '1' : '0') } catch { /* như trên */ }
  }

  return (
    <>
      <button
        type="button"
        onClick={doi}
        aria-expanded={mo}
        className="hidden w-full items-center gap-1 rounded-ctl px-2.5 pt-2.5 pb-1 text-[0.6875rem] font-semibold tracking-wider text-faint uppercase transition-colors hover:text-muted lg:flex"
      >
        <IcPhai
          width={12} height={12}
          className={cx('shrink-0 transition-transform', mo && 'rotate-90')}
        />
        {nhan}
      </button>

      {/* `contents` để các mục vẫn là con trực tiếp của <nav> — bọc thêm một
          hộp có kích thước là phá cả bố cục dọc lẫn dải cuộn ngang. */}
      <div ref={boc} className={cx('contents', !mo && 'lg:[&>a]:hidden')}>
        {children}
      </div>
    </>
  )
}
