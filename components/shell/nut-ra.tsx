import { IcRa } from '@/components/icons'

/**
 * Đăng xuất.
 *
 * Form POST chứ không phải link: một đường /dang-xuat mở bằng GET là bất kỳ
 * trang nào cũng nhúng được <img src="..."> để đá người ta ra khỏi phiên.
 *
 * Không phải chuyện phụ. Phiên bây giờ là cookie sống 30 ngày và tự gia hạn —
 * không có nút này thì một chiếc điện thoại dùng chung trong nhà, hay một máy
 * ở quầy lễ tân, không có cách nào trả lại. Trước đây Supabase cũng không có
 * nút, nhưng phiên bên đó ngắn hơn nên chuyện tự trôi đi.
 */
export function NutRa({ className }: { className?: string }) {
  return (
    <form action="/api/auth/ra" method="post" className={className}>
      <button
        type="submit" title="Đăng xuất" aria-label="Đăng xuất"
        className="inline-flex size-9 items-center justify-center rounded-ctl text-muted transition-colors hover:bg-sunken hover:text-ink"
      >
        <IcRa />
      </button>
    </form>
  )
}
