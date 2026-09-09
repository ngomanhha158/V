#!/usr/bin/env -S node --experimental-strip-types
/**
 * MCP server cho VBuilding — hỏi và ghi việc vận hành từ Claude.
 *
 * PHẠM VI: đọc mọi thứ tài khoản đó đọc được, ghi VIỆC VẬN HÀNH. Cố ý KHÔNG có
 * công cụ nào đụng tiền — không phát hành hóa đơn, không ghi phiếu thu, không
 * gán giao dịch ngân hàng. Ranh giới đó là quyết định, không phải thiếu sót:
 * một yêu cầu tạo nhầm thì xóa được, một hóa đơn phát nhầm cho 468 căn thì
 * không, và người phát hiện ra sẽ là cư dân chứ không phải BQL.
 *
 * Quyền: đi qua PostgREST bằng token của một người thật, nên RLS chặn y như
 * trên web. MCP không mở thêm cửa nào.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { chonKhu, docToken, LoiCauHinh, moKetNoi } from './ket-noi.ts'
import { dangKyCongCu } from './cong-cu.ts'

// KIỂM TOKEN NGAY, trước khi mở kết nối.
//
// Bản đầu không có dòng này: token chỉ đọc lúc gọi công cụ, nên thiếu token thì
// server vẫn khởi động ngon lành, hiện đủ 10 công cụ trong Claude, rồi hỏng ở
// MỌI lần gọi. Người dùng thấy "server đang chạy" và đi tìm lỗi ở chỗ khác.
// Hỏng sớm và nói rõ vẫn tốt hơn chạy được mà làm gì cũng không xong.
try {
  docToken()
} catch (e) {
  // stderr chứ không stdout: stdout là kênh giao thức MCP, in chữ vào đó là
  // làm hỏng chính cái kết nối mình đang báo là không dựng được.
  console.error(e instanceof LoiCauHinh ? e.message : e)
  process.exit(1)
}

const server = new McpServer({ name: 'vbuilding-mcp-server', version: '1.0.0' })
dangKyCongCu(server, { moKetNoi, chonKhu })

await server.connect(new StdioServerTransport())
