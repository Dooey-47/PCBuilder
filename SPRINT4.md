# Sprint 4 — Vận hành cửa hàng

Sprint Goal: hoàn thiện luồng quản trị và báo cáo để có thể demo mua hàng và vận hành cửa hàng trên cùng hệ thống. Phạm vi đối chiếu theo TechReqDoc và SRSDoc: FR-05–FR-07, quyền Admin, lỗi/biên dữ liệu và bố cục trên màn hình nhỏ.

## Nội dung hoàn thiện

- **Xử lý đơn (FR-05):** tích hợp sẵn luồng Admin xem/lọc đơn, mở chi tiết và cập nhật Pending → Confirmed → Shipping → Delivered; chỉ hủy Pending. COD được xác nhận thu tiền sau giao hàng; thanh toán mô phỏng và cập nhật trạng thái có kiểm tra quyền, phiên bản và giao dịch phía máy chủ. Phần này được xây từ Sprint 3 và giữ nguyên trong Increment Sprint 4.
- **Tài khoản khách hàng (FR-07):** bổ sung trang Admin tìm kiếm theo tên/email, phân trang, xem trạng thái và khóa/mở khóa tài khoản Customer. Tài khoản vô hiệu hóa không thể tiếp tục gọi API được bảo vệ vì middleware xác thực kiểm tra trạng thái active ở mỗi request. API không trả mật khẩu/hash.
- **Thống kê (FR-07):** bổ sung báo cáo theo khoảng ngày gồm số đơn, đơn Pending, số đơn đã thanh toán, doanh thu, top 5 sản phẩm bán theo số lượng và tối đa 10 mặt hàng còn không quá 5 sản phẩm. Chỉ đơn PAID chưa hủy được tính doanh thu; COD chưa xác nhận thu tiền và đơn hủy không được tính.
- **Quyền và đầu vào:** các endpoint mới kiểm tra Admin phía backend, giới hạn tìm kiếm/phân trang/ngày, từ chối khoảng ngày sai và nhận body chặt chẽ. Danh sách tài khoản chỉ trả trường hồ sơ cần thiết.
- **Giao diện:** trang quản lý khách hàng và báo cáo được liên kết từ tổng quan Admin; bảng đặt trong vùng cuộn ở màn hình nhỏ. Dùng trạng thái tải/lỗi/rỗng và thao tác khóa có thể thử lại sau khi báo lỗi.

## Tệp đã thay đổi

| Tệp | Thay đổi |
| --- | --- |
| `server/src/app.js` | API Admin tìm kiếm/phân trang khách hàng, khóa/mở khóa, báo cáo theo thời gian; tính doanh thu theo quy tắc thanh toán. |
| `client/src/AdminOperations.jsx` | Giao diện danh sách tài khoản và báo cáo, tìm kiếm, phân trang, lọc ngày, top seller và cảnh báo tồn thấp. |
| `client/src/App.jsx` | Thêm hai đường dẫn được bảo vệ `/admin/users`, `/admin/reports` và liên kết từ tổng quan. |

## Cách dùng

1. Đăng nhập tài khoản Admin hiện có, mở **Quản trị**.
2. Vào **Quản lý đơn hàng** để lọc và xử lý đơn; mở một đơn để xem chi tiết và thực hiện bước trạng thái hợp lệ.
3. Vào **Quản lý khách hàng** để tìm hồ sơ và khóa/mở khóa tài khoản. Khách bị khóa sẽ bị từ chối ở request tiếp theo.
4. Vào **Báo cáo** và chọn ngày bắt đầu/kết thúc (tùy chọn) để xem kết quả trong khoảng ngày UTC bao gồm cả ngày kết thúc.

## Kiểm tra nghiệm thu cần thực hiện

- Khách thường gọi trực tiếp API Admin nhận 403; người chưa đăng nhập nhận 401.
- Admin khóa tài khoản; phiên hiện hành của khách bị khóa không sử dụng được API được bảo vệ; mở khóa thì đăng nhập lại được.
- Đơn COD chỉ vào doanh thu sau khi Admin xác nhận thu tiền; đơn mô phỏng chỉ vào doanh thu khi PAID; đơn CANCELLED không vào doanh thu.
- Báo cáo lọc theo ngày, khoảng ngày đảo ngược bị từ chối; mặt hàng có tồn kho 0–5 xuất hiện ở danh sách sắp hết.
- Trên điện thoại, bảng cuộn trong khung thay vì gây tràn ngang toàn trang; các trang Admin vẫn yêu cầu role Admin ở backend.

## Giới hạn

- Ngưỡng sắp hết hàng là 5, bao gồm sản phẩm hết hàng; có thể điều chỉnh theo chính sách cửa hàng.
- Thống kê doanh thu dùng tổng đơn đã thanh toán và không trừ hoàn tiền thực tế; dự án hiện chỉ có hoàn tiền mô phỏng và quy tắc không tính đơn đã hủy.
- Chưa có tích hợp thanh toán thật, chương trình khuyến mãi/combo, hoàn trả hàng hoặc phân quyền nhiều cấp.
- Trong lượt này chưa chạy bộ test, lint hoặc build; các mục kiểm tra nghiệm thu trên là hướng dẫn kiểm tra thủ công.
