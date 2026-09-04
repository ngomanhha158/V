import {
  Bang, Card, CardHead, Field, Hop, Input, PageHead, Pill, Td, Textarea, Th, Tr, cx, ngayGioVN,
} from '@/components/ui'
import { KetQuaBQ, ketQuaDaChot } from '@/components/ket-qua-bq'
import {
  NHAN_TRANG_THAI, NHAN_Y_KIEN, TONE_TRANG_THAI, TONE_Y_KIEN, m2, phanTram, trangThaiBQ,
} from '@/lib/bieu-quyet'
import { CUOC, DANG_TINH, TUNG_CAN } from '@/app/demo/bq-mock'

// Dùng chung KetQuaBQ và giaiThichKetQua với màn thật: câu diễn giải kết quả là
// thứ đắt nhất ở đây, và một bản demo nói khác bản thật thì nó dạy sai đúng chỗ
// người ta cần học.
export default function Page() {
  const dangMo = CUOC[0]
  const daDong = CUOC.slice(1)

  return (
    <div className="space-y-5">
      <PageHead
        title="Biểu quyết hội nghị"
        sub="Phiếu tính theo DIỆN TÍCH — khác hẳn thăm dò ở bảng tin, nơi mỗi căn một lá"
      />

      <KetQuaBQ
        bq={dangMo}
        k={DANG_TINH}
        dangTinh
        hanhDong={
          <div className="flex flex-wrap items-start gap-3 border-t border-line pt-4">
            <span className="inline-flex h-8 items-center rounded-ctl border border-transparent bg-brand px-2.5 text-[0.8125rem] font-medium text-on-brand">
              Kiểm phiếu và đóng
            </span>
            <span className="inline-flex h-8 items-center rounded-ctl border border-line-firm bg-surface px-2.5 text-[0.8125rem] font-medium text-ink">
              Hủy cuộc
            </span>
          </div>
        }
      />

      <Card>
        <CardHead title="Từng căn" sub="254/468 căn đã bỏ phiếu" />
        <div className="scroll-x overflow-auto">
          <Bang>
            <thead>
              <Tr>
                <Th>Căn</Th>
                <Th className="text-right">Diện tích</Th>
                <Th>Ý kiến</Th>
                <Th className="hidden sm:table-cell">Lúc</Th>
              </Tr>
            </thead>
            <tbody>
              {TUNG_CAN.map((c) => (
                <Tr key={c.ma_can} className={cx(!c.y_kien && 'opacity-60')}>
                  <Td className="num font-medium whitespace-nowrap">{c.ma_can}</Td>
                  <Td className="num text-right whitespace-nowrap">{m2(c.dien_tich)}</Td>
                  <Td>
                    {c.y_kien ? (
                      <Pill tone={TONE_Y_KIEN[c.y_kien]}>{NHAN_Y_KIEN[c.y_kien]}</Pill>
                    ) : (
                      <span className="text-[0.8125rem] text-faint">Chưa bỏ phiếu</span>
                    )}
                  </Td>
                  <Td className="num hidden whitespace-nowrap text-muted sm:table-cell">
                    {c.bo_luc ? ngayGioVN(c.bo_luc) : '—'}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Bang>
        </div>
        <p className="border-t border-line px-4 py-2.5 text-[0.75rem] leading-relaxed text-faint">
          Diện tích ở cột này là diện tích ĐÓNG BĂNG lúc mở cuộc. Sửa diện tích
          trong hồ sơ căn hộ từ giờ không làm đổi trọng số của lá phiếu đã bỏ,
          cũng không đổi mẫu số.
        </p>
      </Card>

      <Card>
        <CardHead title="Các cuộc đã kiểm phiếu" sub={`${daDong.length} cuộc`} />
        <div className="divide-y divide-line">
          {daDong.map((b) => {
            const t = trangThaiBQ(b)
            return (
              <div key={b.id} className="flex items-start justify-between gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium break-words text-ink">{b.tieu_de}</div>
                  <div className="num mt-0.5 text-[0.75rem] text-faint">
                    Kiểm phiếu {ngayGioVN(b.dong_luc!)} · {b.so_can} căn · {m2(b.tong_dien_tich)}
                  </div>
                  <div className="mt-0.5 text-[0.75rem] text-muted">
                    Cần {phanTram(b.nguong_du_hop)} dự họp, {phanTram(b.nguong_thong_qua)} tán thành
                    {' · '}kết quả: {b.kq_thong_qua ? 'thông qua' : b.kq_du_hop ? 'không thông qua' : 'chưa đủ dự họp'}
                  </div>
                </div>
                <span className="shrink-0">
                  <Pill tone={TONE_TRANG_THAI[t]}>{NHAN_TRANG_THAI[t]}</Pill>
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Cuộc 87,5% tán thành mà KHÔNG thông qua — ca đắt nhất trong bản demo. */}
      <Hop tone="canh" title="Mở thử cuộc thứ hai: 87,5% tán thành mà vẫn không thông qua">
        Đây là ca mà kiểm phiếu tay hay kết luận ngược. Nội dung này cần 75% diện
        tích tham gia, mà chỉ 44,16% đi bỏ phiếu — nên hội nghị chưa đủ điều kiện
        tiến hành, và con số 87,5% chưa nói lên điều gì. Gọi nó là &ldquo;không
        thông qua&rdquo; cũng sai: cư dân chưa bác nội dung này, họ chưa họp được.
      </Hop>
      <KetQuaBQ bq={CUOC[2]} k={ketQuaDaChot(CUOC[2], 208)} />

      <Card>
        <CardHead title="Mở cuộc mới" sub="Chỉ trưởng BQL hoặc thành viên BQT" />
        <div className="space-y-3 p-4">
          <Field
            label="Nội dung đưa ra biểu quyết"
            hint="Câu này in nguyên văn lên lá phiếu và vào biên bản. Viết như một nghị quyết, không như một tiêu đề."
          >
            <Input defaultValue="Thông qua mức phí quản lý 8.000đ/m² từ 01/2027" readOnly />
          </Field>
          <Field label="Giải trình" hint="Không bắt buộc — vì sao đưa ra, phương án so sánh, con số kèm theo">
            <Textarea rows={2} readOnly defaultValue="" />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Ngưỡng dự họp (%)"
              hint="Bao nhiêu % DIỆN TÍCH TOÀN KHU phải bỏ phiếu thì hội nghị mới đủ điều kiện tiến hành."
            >
              <Input defaultValue="50" readOnly className="num" />
            </Field>
            <Field
              label="Ngưỡng thông qua (%)"
              hint="Bao nhiêu % DIỆN TÍCH ĐÃ BỎ PHIẾU phải tán thành. Mẫu số khác hẳn ô bên trái."
            >
              <Input defaultValue="50" readOnly className="num" />
            </Field>
          </div>
          <span className="inline-flex h-8 items-center rounded-ctl border border-transparent bg-brand px-2.5 text-[0.8125rem] font-medium text-on-brand">
            Mở cuộc biểu quyết
          </span>
        </div>
      </Card>

      <Hop tone="trung" title="Hai ngưỡng, hai mẫu số — đừng gộp">
        <span className="block">
          <b>Dự họp</b> tính trên diện tích TOÀN KHU: bao nhiêu phần trăm diện tích
          đã bỏ phiếu. Chưa đạt thì hội nghị chưa đủ điều kiện tiến hành, và tỷ lệ
          tán thành lúc đó chưa nói lên điều gì.
        </span>
        <span className="mt-2 block">
          <b>Thông qua</b> tính trên diện tích ĐÃ BỎ PHIẾU: trong số đã bỏ, bao nhiêu
          phần trăm tán thành. Lấy nhầm mẫu số toàn khu ở đây là cách kinh điển để
          đánh trượt oan một nghị quyết đã đủ phiếu.
        </span>
      </Hop>
    </div>
  )
}
