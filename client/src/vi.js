// Chỉ dịch dữ liệu mẫu khi nội dung còn đúng như bản gốc; dữ liệu do quản trị viên
// nhập được giữ nguyên. Các giá trị gửi lên API vẫn dùng mã gốc.
const seedText = {
  "Laptops": "Máy tính xách tay",
  "Desktop PCs": "Máy tính để bàn",
  "PC Components": "Linh kiện máy tính",
  "Peripherals": "Thiết bị ngoại vi",
  "Accessories": "Phụ kiện",
  "Processor": "Bộ xử lý",
  "Memory": "Bộ nhớ",
  "Storage": "Lưu trữ",
  "Display": "Màn hình",
  "Weight": "Trọng lượng",
  "Graphics": "Đồ họa",
  "Power supply": "Nguồn điện",
  "Recommended PSU": "Nguồn đề xuất",
  "Interface": "Giao tiếp",
  "Cooling": "Tản nhiệt",
  "Resolution": "Độ phân giải",
  "Refresh rate": "Tần số quét",
  "Connections": "Cổng kết nối",
  "Layout": "Bố cục",
  "Switches": "Loại phím",
  "Connection": "Kết nối",
  "Backlight": "Đèn nền",
  "14-inch Full HD": "14 inch Full HD",
  "16-inch 2.5K": "16 inch 2.5K",
  "27-inch IPS": "27 inch IPS",
  "Dedicated 6 GB": "Đồ họa rời 6 GB",
  "Dedicated 8 GB": "Đồ họa rời 8 GB",
  "Dual fan": "Hai quạt",
  "75% / 84 keys": "Bố cục 75% / 84 phím",
  "Mechanical linear": "Phím cơ tuyến tính",
  "White LED": "Đèn LED trắng",
  "24-month limited warranty. Demo terms for this exercise.": "Bảo hành giới hạn 24 tháng.",
  "A lightweight everyday laptop for classes, office work, and your next project. A clean 14-inch display and generous memory make multitasking feel effortless.": "Máy tính xách tay gọn nhẹ cho học tập, công việc văn phòng và các dự án của bạn. Màn hình 14 inch rõ nét cùng bộ nhớ lớn giúp xử lý nhiều tác vụ dễ dàng.",
  "More room for your ideas. A larger display and dedicated graphics suit creative coursework, editing, and demanding everyday tasks.": "Không gian rộng hơn cho ý tưởng của bạn. Màn hình lớn và đồ họa rời phù hợp với học tập sáng tạo, chỉnh sửa và công việc hằng ngày đòi hỏi hiệu năng cao.",
  "A balanced desktop built for focused work and comfortable multitasking. Includes the tower only; choose your own monitor and peripherals.": "Máy tính để bàn cân bằng cho công việc tập trung và đa nhiệm. Sản phẩm chỉ gồm thùng máy; bạn có thể chọn màn hình và thiết bị ngoại vi riêng.",
  "An illustrative graphics card for your next desktop build. This demo item is out of stock so you can check the storefront's availability states.": "Card đồ họa cho máy tính để bàn, phù hợp với nhu cầu chơi game và xử lý hình ảnh. Thiết kế hai quạt hỗ trợ tản nhiệt khi sử dụng.",
  "A spacious, crisp display for code, coursework, and everything in between. A simple stand keeps your workspace uncluttered.": "Màn hình rộng và sắc nét cho lập trình, học tập và công việc hằng ngày. Chân đế đơn giản giúp bàn làm việc gọn gàng.",
  "A compact mechanical keyboard that leaves more space on your desk. A comfortable layout for long study sessions and everyday work.": "Bàn phím cơ nhỏ gọn giúp tiết kiệm diện tích bàn. Bố cục thoải mái cho những buổi học dài và công việc hằng ngày.",
};

const useCases = { study: "Học tập", office: "Văn phòng", gaming: "Chơi game", creative: "Sáng tạo" };

export function viText(value) {
  if (typeof value !== "string") return value;
  if (value.endsWith(" — illustrative product image")) {
    return `Ảnh sản phẩm ${value.slice(0, -" — illustrative product image".length)}`;
  }
  return seedText[value] ?? value;
}

export function viUseCase(value) {
  return useCases[value] ?? value;
}

export function viDate(value, withTime = false) {
  const date = new Date(value);
  return withTime ? date.toLocaleString("vi-VN") : date.toLocaleDateString("vi-VN");
}

const errors = {
  "Unexpected response from the server.": "Máy chủ trả về dữ liệu không hợp lệ.",
  "The request failed.": "Yêu cầu không thành công.",
  "Please check the highlighted fields.": "Vui lòng kiểm tra các trường được đánh dấu.",
  "Please sign in to continue.": "Vui lòng đăng nhập để tiếp tục.",
  "Your session changed or expired. Refresh the page and try again.": "Phiên đăng nhập đã thay đổi hoặc hết hạn. Hãy tải lại trang và thử lại.",
  "Too many attempts. Please try again in 15 minutes.": "Bạn đã thử quá nhiều lần. Vui lòng thử lại sau 15 phút.",
  "This email is already registered.": "Email này đã được đăng ký.",
  "Use another email or sign in.": "Hãy dùng email khác hoặc đăng nhập.",
  "Email or password is incorrect.": "Email hoặc mật khẩu không đúng.",
  "Administrator access is required.": "Cần quyền quản trị viên.",
  "Endpoint not found.": "Không tìm thấy địa chỉ API.",
  "Record not found.": "Không tìm thấy dữ liệu.",
  "Product not found.": "Không tìm thấy sản phẩm.",
  "Order not found.": "Không tìm thấy đơn hàng.",
  "Image not found.": "Không tìm thấy ảnh.",
  "Image must be at most 2 MB.": "Ảnh không được lớn hơn 2 MB.",
  "Upload one image using the image field.": "Chỉ tải lên một ảnh mỗi lần.",
  "Invalid JSON request.": "Dữ liệu yêu cầu không hợp lệ.",
  "Request is too large.": "Yêu cầu quá lớn.",
  "The service is temporarily unavailable. Please try again.": "Dịch vụ tạm thời không khả dụng. Vui lòng thử lại.",
  "A record with this SKU or name already exists.": "Mã SKU hoặc tên này đã tồn tại.",
  "Choose an existing category.": "Hãy chọn danh mục hiện có.",
  "Category not found.": "Không tìm thấy danh mục.",
  "Choose an existing brand.": "Hãy chọn thương hiệu hiện có.",
  "Brand not found.": "Không tìm thấy thương hiệu.",
  "Choose a PNG, JPEG, or WebP image of at most 2 MB.": "Hãy chọn ảnh PNG, JPEG hoặc WebP không quá 2 MB.",
  "This product or its stock changed since you opened it. Reload the editor before saving.": "Sản phẩm hoặc tồn kho đã thay đổi. Hãy tải lại trình chỉnh sửa trước khi lưu.",
  "The product changed or no longer exists. Reload the list.": "Sản phẩm đã thay đổi hoặc không còn tồn tại. Hãy tải lại danh sách.",
  "This product is no longer available.": "Sản phẩm này không còn bán.",
  "Reduce the quantity.": "Hãy giảm số lượng.",
  "A cart can contain at most 100 different products.": "Giỏ hàng chỉ có thể chứa tối đa 100 sản phẩm khác nhau.",
  "This checkout key was already used for different checkout details.": "Lần đặt hàng này đã được dùng với thông tin khác.",
  "Your cart is empty.": "Giỏ hàng của bạn đang trống.",
  "One or more products are unavailable or have insufficient stock. Review your cart.": "Một số sản phẩm không còn bán hoặc không đủ hàng. Hãy kiểm tra giỏ hàng.",
  "Your cart, prices, stock, or shipping fee changed. Review the latest totals before confirming.": "Giỏ hàng, giá, tồn kho hoặc phí giao hàng đã thay đổi. Hãy kiểm tra tổng tiền mới trước khi xác nhận.",
  "Stock changed. Review your cart.": "Tồn kho đã thay đổi. Hãy kiểm tra giỏ hàng.",
  "This order changed. Refresh its details before trying again.": "Đơn hàng đã thay đổi. Hãy tải lại chi tiết trước khi thử lại.",
  "Stock cannot be restored. Ask an administrator to review inventory.": "Không thể hoàn tồn kho. Hãy nhờ quản trị viên kiểm tra.",
  "Only Pending orders can be cancelled.": "Chỉ có thể hủy đơn hàng đang chờ.",
  "This order uses cash on delivery.": "Đơn hàng này thanh toán khi nhận hàng.",
  "Simulated payment is only available for Pending orders.": "Chỉ có thể thanh toán mô phỏng cho đơn hàng đang chờ.",
  "This simulated payment has already succeeded.": "Thanh toán mô phỏng đã thành công.",
  "Follow Pending → Confirmed → Shipping → Delivered. Only Pending orders can be cancelled.": "Hãy xử lý lần lượt: Chờ xác nhận → Đã xác nhận → Đang giao → Đã giao. Chỉ có thể hủy đơn đang chờ.",
  "The customer must complete the simulated payment before confirmation.": "Khách hàng cần hoàn tất thanh toán mô phỏng trước khi xác nhận đơn.",
  "Confirm COD collection only after delivery.": "Chỉ xác nhận đã thu tiền COD sau khi giao hàng.",
  "Maximum price must not be below minimum price.": "Giá cao nhất không được thấp hơn giá thấp nhất.",
  "Enter a complete delivery address.": "Hãy nhập địa chỉ giao hàng đầy đủ.",
  "Use at least 8 characters.": "Hãy nhập ít nhất 8 ký tự.",
  "Enter at least 2 characters.": "Hãy nhập ít nhất 2 ký tự.",
  "Enter a valid phone number.": "Hãy nhập số điện thoại hợp lệ.",
};

export function viError(message) {
  if (!message) return "Yêu cầu không thành công.";
  if (errors[message]) return errors[message];
  const stock = /^Only (\d+) unit\(s\) are available\.$/.exec(message);
  if (stock) return `Chỉ còn ${stock[1]} sản phẩm.`;
  if (/[À-ỹ]/u.test(message)) return message;
  return "Không thể hoàn tất yêu cầu. Vui lòng kiểm tra dữ liệu và thử lại.";
}
