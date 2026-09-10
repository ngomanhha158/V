import { Card, CardHead, Pill, cx } from '@/components/ui'
import { TEN_JOB, XAU, cachDay, type TinhTrangJob } from '@/lib/job-nen'

/**
 * Bảng "Job nền" của màn go-live.
 *
 * DÙNG CHUNG giữa màn thật và bản demo, không chép hai bản. Cả PR sinh ra bảng
 * này là vì một danh sách job bị chép ra ba nơi rồi lệch nhau; đẻ thêm một bản
 * chép nữa ngay trong lúc đi dọn thì thật khó coi. Phần còn lại của hai màn đó
 * vẫn trùng nhau theo lối cũ — đó là việc khác, không gộp vào đây.
 */

/**
 * Một job và tình trạng của nó.
 *
 * Câu "không chạy thì mất gì" chỉ hiện khi ĐANG hỏng. Để nó hiện thường trực
 * thì bảng thành một trang cảnh báo dài, mà người đọc lướt qua chín dòng giống
 * nhau sẽ không nhận ra dòng nào vừa đổi màu.
 */
function HangJob({ j }: { j: TinhTrangJob }) {
  const xau = XAU(j.trangThai)
  const cho = j.trangThai === 'chua_toi_luot'
  const noiDung: Record<TinhTrangJob['trangThai'], string> = {
    ok: `chạy ${cachDay(j.lanCuoi)}${j.so !== null ? ` · ${j.so} dòng` : ''}`,
    chua_toi_luot: 'chưa tới lượt chạy lần đầu',
    chua_chay: 'CHƯA TỪNG CHẠY — nhiều khả năng chưa đặt Cron Service trên Railway',
    tre: `lần cuối ${cachDay(j.lanCuoi)}, đã quá hạn — lịch trên Railway bị xoá hoặc hỏng`,
    loi: `lỗi ${cachDay(j.lanCuoi)}: ${j.loi ?? 'không rõ'}`,
  }
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span
        className={cx(
          'mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-[0.6875rem] font-bold',
          xau ? 'bg-bad-soft text-bad' : cho ? 'bg-sunken text-faint' : 'bg-ok-soft text-ok',
        )}
        // Dấu là CHỮ chứ không chỉ là màu, cùng lý do với danh sách kiểm ở trên.
        aria-hidden
      >
        {xau ? '✕' : cho ? '·' : '✓'}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">
          {j.ten}{' '}
          <span className="text-[0.75rem] font-normal text-faint">{j.job.gio}</span>
        </div>
        <p className={cx('mt-0.5 text-[0.8125rem] leading-relaxed break-words',
          xau ? 'text-bad' : 'text-muted')}>
          {noiDung[j.trangThai]}
        </p>
        {xau && (
          <p className="mt-0.5 text-[0.8125rem] leading-relaxed text-muted">{j.job.hong}</p>
        )}
      </div>
    </li>
  )
}

/**
 * `loi` = không đọc được bảng job_chay (thường là database chưa áp schema có
 * bảng này). Phải tách hẳn khỏi "bảng rỗng".
 *
 * Gộp hai thứ đó thì màn hình hét "cả chín job đều chưa chạy" trong khi chúng
 * vẫn đang chạy đều — một lời báo động SAI, và báo động sai còn tệ hơn im lặng
 * vì nó dạy người đọc bỏ qua màu đỏ. Đúng thứ mà cả bảng này sinh ra để dẹp,
 * nên không được phép tự mắc lại ngay ở đây.
 */
export function BangJobNen({ job, loi }: { job: TinhTrangJob[]; loi?: string | null }) {
  const xau = job.filter((j) => XAU(j.trangThai))
  if (loi) {
    return (
      <Card>
        <CardHead title="Job nền" sub="Chưa đọc được — màn này chưa kết luận gì" />
        <p className="px-4 py-3 text-[0.8125rem] leading-relaxed text-muted">
          Không đọc được bảng <code className="rounded bg-sunken px-1">job_chay</code>:{' '}
          <span className="text-bad">{loi}</span>
          <br />
          Gần như chắc chắn là database chưa áp bản <code className="rounded bg-sunken px-1">schema.sql</code>{' '}
          có bảng này. Áp lại rồi chạy{' '}
          <code className="rounded bg-sunken px-1">notify pgrst, &lsquo;reload schema&rsquo;</code>.
          Job vẫn chạy bình thường trong lúc đó — chỉ là chưa có chỗ nào ghi lại
          để màn này đọc.
        </p>
      </Card>
    )
  }
  return (
    <Card>
      <CardHead
        title="Job nền"
        sub={
          xau.length === 0
            ? `${TEN_JOB.length} job · lần chạy gần nhất của từng cái`
            : `${xau.length}/${TEN_JOB.length} job không chạy — không có gì khác báo chuyện này`
        }
        right={
          xau.length === 0
            ? <Pill tone="tot">Đủ chạy</Pill>
            : <Pill tone="xau">Hỏng {xau.length}</Pill>
        }
      />
      <ul className="divide-y divide-line">
        {job.map((j) => <HangJob key={j.ten} j={j} />)}
      </ul>
      <p className="border-t border-line px-4 py-3 text-[0.8125rem] leading-relaxed text-muted">
        Bảng này đọc từ chính lần chạy của job, không đọc cấu hình. Một job hiện
        “chưa từng chạy” nghĩa là Railway chưa bao giờ gọi tới nó — thêm Cron
        Service với lịch ghi ngay cạnh tên job, bảng đầy đủ ở bước B6 của{' '}
        <code className="rounded bg-sunken px-1">railway/GD1-runbook.sh</code>.
        Railway chạy theo giờ UTC, đã trừ sẵn 7 tiếng trong file đó.
      </p>
    </Card>
  )
}
