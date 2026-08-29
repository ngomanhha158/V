import { DemoBanner } from '@/components/demo-banner'
import { ResidentShell } from '@/components/shell/resident-shell'

// Dùng lại đúng vỏ của app thật, chỉ đổi tiền tố đường dẫn. Chép ra bản thứ
// hai thì vài hôm nữa demo và bản thật sẽ lệch nhau mà không ai biết.
export default function DemoCuDanLayout({ children }: { children: React.ReactNode }) {
  return (
    <ResidentShell base="/demo" ten="Sunrise Riverside" phu="Ngô Mạnh Hà · P1-10.01" soThongBao={3}>
      <DemoBanner />
      {children}
    </ResidentShell>
  )
}
