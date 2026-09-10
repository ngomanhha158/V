/**
 * Danh mục job nền — MỘT chỗ duy nhất.
 *
 * Trước file này, "có những job nào" nằm rải ở ba nơi: hằng số VIEC trong
 * route handler, bảng đối chiếu ở đầu cron.sql, và danh sách trong GO-LIVE.md.
 * Ba bản chép tay của cùng một sự thật thì sớm muộn cũng lệch, và cách nó lệch
 * đúng bằng cách tệ nhất: thêm job ở một nơi, quên đặt lịch ở nơi kia, rồi job
 * KHÔNG chạy mà không màn nào báo.
 *
 * Chuyện đó đã xảy ra thật. `bao-cao-quy` và `day-thong-bao` khai trong route
 * từ đầu nhưng chưa bao giờ có Cron Service trên Railway; màn go-live thì bảo
 * "phải có đủ 5 Cron Service" — con số của thời còn 5 job — nên nhìn thấy 7
 * lịch là tưởng dư, trong khi đang thiếu 2.
 *
 * Nên: route suy ra từ đây, màn go-live đọc từ đây, và có test đối chiếu file
 * này với bảng trong cron.sql. Thêm job mà quên lịch thì CI ĐỎ, không im lặng.
 */

export type Job = {
  /**
   * Hàm SQL chạy job. `null` = job chạy trong Node — Web Push đòi mã hoá ECDH
   * và ký VAPID, Postgres không làm được.
   */
  ham: string | null
  /** Lịch đặt trên Railway. GIỜ UTC, như mọi cron của Railway. */
  cron: string
  /** Cùng lịch đó nói bằng giờ VN, để đọc mà không phải tự trừ 7 tiếng. */
  gio: string
  /** Không chạy thì mất gì. Một câu, viết cho người đang phải quyết có sửa ngay không. */
  hong: string
  /**
   * Quá ngần này giây không thấy chạy thì coi là hỏng.
   *
   * Rộng hơn chu kỳ vài nhịp, cố ý: một lần chạy chậm hay một lần deploy
   * không được phép làm màn hình kêu. Màn hình kêu oan vài lần là lần kêu thật
   * cũng bị bỏ qua.
   */
  hanGiay: number
}

const GIO = 3600
const NGAY = 24 * GIO

export const JOB = {
  'thu-hoi-thanh-vien': {
    ham: 'expire_memberships',
    cron: '5 17 * * *',
    gio: '00:05 mỗi ngày',
    hong: 'Hợp đồng thuê hết hạn vẫn giữ nguyên quyền vào app.',
    hanGiay: 26 * GIO,
  },
  'leo-thang-ticket': {
    ham: 'escalate_overdue_tickets',
    cron: '*/5 * * * *',
    gio: '5 phút một lần',
    hong: 'Yêu cầu quá hạn SLA nằm im, không ai được báo.',
    hanGiay: 20 * 60,
  },
  'nhac-no': {
    ham: 'remind_unpaid_invoices',
    cron: '0 1 * * *',
    gio: '08:00 mỗi ngày',
    hong: 'Không nhắc nợ T-3 / T-0 / T+3 — cư dân quên đóng mà không ai nói.',
    hanGiay: 26 * GIO,
  },
  'mo-ky-bao-tri': {
    ham: 'mo_ky_bao_tri',
    cron: '0 0 * * *',
    gio: '07:00 mỗi ngày',
    hong: 'Kỳ bảo trì tới hạn không mở — thiết bị tới lịch mà không có việc nào sinh ra.',
    hanGiay: 26 * GIO,
  },
  'don-ma-dang-nhap': {
    ham: 'auth_don_ma',
    cron: '0 20 * * *',
    gio: '03:00 mỗi ngày',
    hong: 'Mã đăng nhập hết hạn nằm lại trong database mãi.',
    hanGiay: 26 * GIO,
  },
  'don-so-ra-vao': {
    ham: 'xoa_khach_cu',
    cron: '30 19 * * *',
    gio: '02:30 mỗi ngày',
    hong: 'Sổ ra vào giữ quá 90 ngày — trái đúng lời hứa màn Khách thăm nói với cư dân.',
    hanGiay: 26 * GIO,
  },
  'nhac-kien-hang': {
    ham: 'nhac_kien_hang',
    cron: '0 11 * * *',
    gio: '18:00 mỗi ngày',
    hong: 'Kiện hàng để quá 3 ngày ở quầy không ai được nhắc.',
    hanGiay: 26 * GIO,
  },
  'bao-cao-quy': {
    ham: 'sinh_bao_cao_quy',
    cron: '0 19 4 1,4,7,10 *',
    gio: '02:00 ngày 5 tháng đầu mỗi quý',
    hong: 'BQT không có báo cáo quý — thứ phải nộp cho hội nghị nhà chung cư.',
    // Khoảng cách xa nhất giữa hai lần chạy là một quý (~92 ngày).
    hanGiay: 95 * NGAY,
  },
  'day-thong-bao': {
    ham: null,
    cron: '*/15 * * * *',
    gio: '15 phút một lần',
    hong: 'Ba job nhắc ở trên chỉ ghi vào database chứ không tới được điện thoại ai.',
    hanGiay: GIO,
  },
} as const satisfies Record<string, Job>

export type TenJob = keyof typeof JOB
export const TEN_JOB = Object.keys(JOB) as TenJob[]

/** Một dòng của bảng `job_chay`. */
export type DongJobChay = {
  viec: string
  ok_luc: string | null
  ok_so: number | null
  ok_ms: number | null
  loi_luc: string | null
  loi: string | null
}

export type TrangThaiJob =
  /** Lần chạy gần nhất thành công và còn trong hạn. */
  | 'ok'
  /** Từng chạy được, nhưng lần cuối đã quá hạn — lịch trên Railway hỏng hoặc bị xoá. */
  | 'tre'
  /** Lần chạy gần nhất ném lỗi. */
  | 'loi'
  /** Chưa từng chạy, mà hệ thống đã sống đủ lâu để lẽ ra phải chạy rồi. */
  | 'chua_chay'
  /** Chưa từng chạy, nhưng cũng chưa tới lượt — job quý trên một hệ mới dựng. */
  | 'chua_toi_luot'

export type TinhTrangJob = {
  ten: TenJob
  job: Job
  trangThai: TrangThaiJob
  /** Lần chạy gần nhất, thành công hay thất bại. */
  lanCuoi: string | null
  /** Số dòng lần chạy thành công gần nhất đụng tới. */
  so: number | null
  loi: string | null
}

export const XAU = (t: TrangThaiJob) => t === 'tre' || t === 'loi' || t === 'chua_chay'

/**
 * Chấm tình trạng 9 job từ những dòng đọc được trong `job_chay`.
 *
 * "Chưa từng chạy" một mình không đủ để kết luận hỏng: một hệ vừa dựng xong
 * thì job quý chưa tới lượt là bình thường. Mốc để so là LẦN CHẠY ĐẦU TIÊN mà
 * bảng này biết tới — có một job chạy được nghĩa là CRON_SECRET đúng và Railway
 * gọi vào được, nên từ mốc đó trở đi, job nào im quá hạn của nó là im bất
 * thường. Mốc tự có, không phải khai thêm biến môi trường nào để rồi quên.
 *
 * Chưa dòng nào: mọi job đều 'chua_chay'. Đó là sự thật — chưa job nào từng
 * chạy — và là đúng thứ cần hét lên ngay sau khi dựng xong hệ thống.
 */
export function soatJobNen(
  dong: DongJobChay[], bayGio: Date = new Date(),
): TinhTrangJob[] {
  const theoTen = new Map(dong.map((d) => [d.viec, d]))
  const moc = dong
    .flatMap((d) => [d.ok_luc, d.loi_luc])
    .filter((x): x is string => !!x)
    .map((x) => Date.parse(x))
    .sort((a, b) => a - b)[0]

  return TEN_JOB.map((ten) => {
    const job: Job = JOB[ten]
    const d = theoTen.get(ten)
    const ok = d?.ok_luc ? Date.parse(d.ok_luc) : null
    const loi = d?.loi_luc ? Date.parse(d.loi_luc) : null
    const lanCuoi = Math.max(ok ?? -Infinity, loi ?? -Infinity)
    const han = job.hanGiay * 1000

    let trangThai: TrangThaiJob
    if (!Number.isFinite(lanCuoi)) {
      // Bảng trống hẳn: không có mốc nào để nói "chưa tới lượt" cho tử tế, và
      // cũng không cần — chưa job NÀO từng chạy thì tình trạng đúng là hỏng,
      // nói ngay chứ không chờ hết một quý mới dám kết luận.
      trangThai = moc === undefined || bayGio.getTime() - moc > han
        ? 'chua_chay' : 'chua_toi_luot'
    } else if (loi !== null && loi >= (ok ?? -Infinity)) {
      trangThai = 'loi'
    } else if (bayGio.getTime() - lanCuoi > han) {
      trangThai = 'tre'
    } else {
      trangThai = 'ok'
    }

    return {
      ten,
      job,
      trangThai,
      lanCuoi: Number.isFinite(lanCuoi) ? new Date(lanCuoi).toISOString() : null,
      so: d?.ok_so ?? null,
      loi: trangThai === 'loi' ? (d?.loi ?? null) : null,
    }
  })
}

/**
 * "3 phút trước". Không dùng Intl.RelativeTimeFormat: nó cần chọn đơn vị trước
 * rồi mới định dạng, nên phần khó vẫn phải tự viết, và nó khác nhau giữa các
 * phiên bản Node — mà chuỗi này có test.
 */
export function cachDay(iso: string | null, bayGio: Date = new Date()): string {
  if (!iso) return 'chưa bao giờ'
  const giay = Math.round((bayGio.getTime() - Date.parse(iso)) / 1000)
  if (giay < 0) return 'vừa xong'
  if (giay < 90) return `${giay} giây trước`
  const phut = Math.round(giay / 60)
  if (phut < 90) return `${phut} phút trước`
  const gio = Math.round(phut / 60)
  if (gio < 36) return `${gio} giờ trước`
  return `${Math.round(gio / 24)} ngày trước`
}
