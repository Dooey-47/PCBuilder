import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "./api.js";
import useRemote from "./useRemote.js";
import { money } from "./format.js";
import { Notice } from "./shop-ui.jsx";

export function AdminUsers() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const result = useRemote(`/admin/users?${new URLSearchParams({ q: query, page: String(page) })}`);
  async function toggle(user) {
    setError("");
    try { await api(`/admin/users/${user.id}/active`, { method: "PATCH", body: { active: !user.active } }); result.refresh(); }
    catch (e) { setError(e.message); }
  }
  return <div className="shell page-section"><Link to="/admin">← Tổng quan</Link><h1 className="page-title">Quản lý tài khoản khách hàng</h1>
    <form className="admin-toolbar" onSubmit={e => { e.preventDefault(); setQuery(String(new FormData(e.currentTarget).get("q") ?? "")); setPage(1); }}><input name="q" aria-label="Tìm theo tên hoặc email" placeholder="Tên hoặc email"/><button className="button button-small">Tìm</button></form>
    {error && <Notice error>{error}</Notice>}{result.loading ? <Notice>Đang tải tài khoản…</Notice> : result.error ? <Notice error>{result.error.message}</Notice> : <><div className="table-scroll"><table className="management-table"><thead><tr><th>Khách hàng</th><th>Email</th><th>Điện thoại</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{result.data.users.map(u => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.phone || "—"}</td><td>{u.active ? "Đang hoạt động" : "Đã khóa"}</td><td><button className="text-button" onClick={() => toggle(u)}>{u.active ? "Khóa tài khoản" : "Mở khóa"}</button></td></tr>)}</tbody></table></div><div className="order-actions"><button className="button button-secondary" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Trước</button><span>Trang {page} / {Math.max(1, Math.ceil(result.data.total / result.data.pageSize))}</span><button className="button button-secondary" disabled={page * result.data.pageSize >= result.data.total} onClick={() => setPage(p => p + 1)}>Sau</button></div></>}</div>;
}

export function AdminReports() {
  const [range, setRange] = useState({ after: "", before: "" });
  const [params, setParams] = useState("");
  const report = useRemote(`/admin/reports${params ? `?${params}` : ""}`);
  return <div className="shell page-section"><Link to="/admin">← Tổng quan</Link><h1 className="page-title">Báo cáo cửa hàng</h1>
    <form className="admin-toolbar" onSubmit={e => { e.preventDefault(); setParams(new URLSearchParams(Object.entries(range).filter(([,v]) => v)).toString()); }}><label>Từ ngày <input type="date" value={range.after} onChange={e => setRange(r => ({...r, after:e.target.value}))}/></label><label>Đến ngày <input type="date" value={range.before} onChange={e => setRange(r => ({...r, before:e.target.value}))}/></label><button className="button button-small">Áp dụng</button></form>
    {report.loading ? <Notice>Đang tổng hợp báo cáo…</Notice> : report.error ? <Notice error>{report.error.message}</Notice> : <><div className="overview-grid"><div><span>Đơn trong kỳ</span><strong>{report.data.orders}</strong></div><div><span>Đơn chờ xác nhận</span><strong>{report.data.pendingOrders}</strong></div><div><span>Đơn đã thanh toán</span><strong>{report.data.paidOrders}</strong></div><div><span>Doanh thu đã thanh toán</span><strong>{money(report.data.revenue)}</strong></div></div><div className="metadata-grid"><section className="metadata-panel"><h2>Sản phẩm bán chạy</h2>{report.data.bestSellers.length ? report.data.bestSellers.map(p => <p key={p.productId}>{p.name} ({p.sku}) — {p.quantity} sản phẩm</p>) : <p>Chưa có dữ liệu.</p>}</section><section className="metadata-panel"><h2>Sắp hết hàng (≤ 5)</h2>{report.data.lowStock.length ? report.data.lowStock.map(p => <p key={p.id}>{p.name} — còn {p.stock}</p>) : <p>Không có sản phẩm sắp hết hàng.</p>}</section></div><p className="form-hint">Doanh thu chỉ tính đơn đã thanh toán, loại trừ đơn đã hủy. COD chờ thu tiền không được tính.</p></>}
  </div>;
}
