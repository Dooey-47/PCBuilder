import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "./api.js";
import useRemote from "./useRemote.js";
import { Notice } from "./shop-ui.jsx";
import { money } from "./format.js";
import { viText, viUseCase } from "./vi.js";

function Metadata({ kind, records, refresh }) {
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  async function save(event, id) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = event.currentTarget;
    try {
      await api(`/admin/${kind}${id ? `/${id}` : ""}`, {
        method: id ? "PATCH" : "POST",
        body: { name: new FormData(form).get("name") },
      });
      if (!id) form.reset();
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }
  async function remove(id) {
    setPending(true);
    setError("");
    try {
      await api(`/admin/${kind}/${id}`, { method: "DELETE" });
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }
  return (
    <details className="metadata-panel">
      <summary>Quản lý {kind === "brands" ? "thương hiệu" : "danh mục"}</summary>
      {error && <Notice error>{error}</Notice>}
      <form onSubmit={(event) => save(event)} className="metadata-row">
        <label className="visually-hidden" htmlFor={`new-${kind}`}>
          Tên {kind === "brands" ? "thương hiệu" : "danh mục"} mới
        </label>
        <input
          id={`new-${kind}`}
          name="name"
          placeholder={`${kind === "brands" ? "Thương hiệu" : "Danh mục"} mới`}
          required
          maxLength={80}
        />
        <button className="button button-small" disabled={pending}>
          Add
        </button>
      </form>
      {records.map((record) => (
        <form
          className="metadata-row"
          key={`${record.id}-${record.name}`}
          onSubmit={(event) => save(event, record.id)}
        >
          <label className="visually-hidden" htmlFor={`${kind}-${record.id}`}>
            {record.name}
          </label>
          <input
            id={`${kind}-${record.id}`}
            name="name"
            defaultValue={record.name}
            required
            maxLength={80}
          />
          <button className="text-button" disabled={pending}>
            Rename
          </button>
          <button
            type="button"
            className="text-button"
            disabled={pending}
            onClick={() => remove(record.id)}
          >
            Delete
          </button>
        </form>
      ))}
      <p className="form-hint">
        Không thể xóa danh mục hoặc thương hiệu đang được sản phẩm sử dụng.
      </p>
    </details>
  );
}

function ProductForm({
  product,
  categories,
  brands,
  onSaved,
  onClose,
  reload,
}) {
  const [form, setForm] = useState(() => ({
    sku: product?.sku ?? "",
    name: product?.name ?? "",
    description: product?.description ?? "",
    price: product?.price ?? "",
    stock: String(product?.stock ?? 0),
    active: product?.active ?? true,
    categoryId: String(product?.categoryId ?? categories[0]?.id ?? ""),
    brandId: String(product?.brandId ?? brands[0]?.id ?? ""),
    warrantyText: product?.warrantyText ?? "Bảo hành giới hạn 24 tháng.",
    useCases: product?.useCases ?? [],
    specs:
      product?.specs.map((item) => `${item.name}: ${item.value}`).join("\n") ??
      "",
    images:
      product?.images.map((image) => image.url).join("\n") ??
      "/images/laptop.svg",
  }));
  const [pending, setPending] = useState(false),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState(null);
  function change(event) {
    const { name, value, type, checked } = event.target;
    setForm((old) => ({
      ...old,
      [name]: type === "checkbox" ? checked : value,
    }));
  }
  function tag(value) {
    setForm((old) => ({
      ...old,
      useCases: old.useCases.includes(value)
        ? old.useCases.filter((item) => item !== value)
        : [...old.useCases, value],
    }));
  }
  async function upload(event) {
    const target = event.currentTarget,
      file = target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("image", file);
      const { url } = await api("/admin/uploads", { method: "POST", body });
      setForm((old) => ({
        ...old,
        images: [old.images, url].filter(Boolean).join("\n"),
      }));
    } catch (err) {
      setError(err);
    } finally {
      setUploading(false);
      target.value = "";
    }
  }
  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const specs = form.specs
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          const separator = line.indexOf(":");
          if (separator < 1 || !line.slice(separator + 1).trim())
            throw new Error("Mỗi dòng nhập một thông số theo dạng: Tên: Giá trị.");
          return {
            name: line.slice(0, separator).trim(),
            value: line.slice(separator + 1).trim(),
          };
        });
      const images = form.images
        .split("\n")
        .map((url) => url.trim())
        .filter(Boolean)
        .map((url) => ({ url, alt: form.name.trim() }));
      const body = {
        ...form,
        stock: Number(form.stock),
        categoryId: Number(form.categoryId),
        brandId: Number(form.brandId),
        specs,
        images,
        ...(product ? { version: product.version } : {}),
      };
      await api(`/admin/products${product ? `/${product.id}` : ""}`, {
        method: product ? "PATCH" : "POST",
        body,
      });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
    }
  }
  const field = (name, label, props = {}) => (
    <div className="field">
      <label htmlFor={`product-${name}`}>{label}</label>
      <input
        id={`product-${name}`}
        name={name}
        value={form[name]}
        onChange={change}
        required
        {...props}
      />
      {error?.fields?.[name] && (
        <small className="field-error">{error.fields[name][0]}</small>
      )}
    </div>
  );
  return (
    <section className="form-card product-editor">
      <h2>{product ? "Sửa sản phẩm" : "Thêm sản phẩm"}</h2>
      <p className="muted">
        Giá tính bằng VND nguyên. Thay đổi tồn kho được kiểm tra với phiên bản sản phẩm bạn đã mở.
      </p>
      {error && (
        <Notice error>
          {error.message}
          {error.status === 409 && product && (
            <button className="text-button reload-editor" onClick={reload}>
              Tải lại sản phẩm mới nhất và bỏ nội dung đang sửa
            </button>
          )}
        </Notice>
      )}
      <form onSubmit={submit}>
        <fieldset disabled={pending || uploading}>
          <div className="editor-grid">
            {field("name", "Tên sản phẩm", { maxLength: 150 })}
            {field("sku", "Mã SKU duy nhất", { maxLength: 60 })}
            {field("price", "Giá (VND)", {
              type: "number",
              min: 0,
              max: 99999999999999,
              step: 1,
            })}
            {field("stock", "Tồn kho", {
              type: "number",
              min: 0,
              max: 2147483647,
              step: 1,
            })}
            <div className="field">
              <label htmlFor="product-category">Danh mục</label>
              <select
                id="product-category"
                name="categoryId"
                value={form.categoryId}
                onChange={change}
                required
              >
                <option value="">Chọn danh mục</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {viText(item.name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="product-brand">Thương hiệu</label>
              <select
                id="product-brand"
                name="brandId"
                value={form.brandId}
                onChange={change}
                required
              >
                <option value="">Chọn thương hiệu</option>
                {brands.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="product-description">Mô tả</label>
            <textarea
              id="product-description"
              name="description"
              value={form.description}
              onChange={change}
              required
              rows={4}
              maxLength={4000}
            />
          </div>
          {field("warrantyText", "Điều khoản bảo hành", { maxLength: 1000 })}
          <label className="check-label">
            <input
              type="checkbox"
              name="active"
              checked={form.active}
              onChange={change}
            />{" "}
            Hiển thị trên cửa hàng
          </label>
          <fieldset className="use-cases">
            <legend>Nhu cầu sử dụng</legend>
            {["study", "office", "gaming", "creative"].map((value) => (
              <label key={value} className="check-label">
                <input
                  type="checkbox"
                  checked={form.useCases.includes(value)}
                  onChange={() => tag(value)}
                />{" "}
                {viUseCase(value)}
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="product-specs">
              Thông số kỹ thuật — mỗi dòng một cặp Tên: Giá trị
            </label>
            <textarea
              id="product-specs"
              name="specs"
              value={form.specs}
              onChange={change}
              rows={6}
              placeholder={"Bộ nhớ: 16 GB\nLưu trữ: 512 GB SSD"}
            />
            {error?.fields?.specs && (
              <small className="field-error">{error.fields.specs[0]}</small>
            )}
            <small className="form-hint">
              Tên gọi phổ biến được chuẩn hóa: RAM → Memory, CPU → Processor, SSD → Storage.
            </small>
          </div>
          <div className="field">
            <label htmlFor="product-images">
              Đường dẫn ảnh — mỗi dòng một URL, ảnh đầu tiên là ảnh chính
            </label>
            <textarea
              id="product-images"
              name="images"
              value={form.images}
              onChange={change}
              rows={4}
            />
            {error?.fields?.images && (
              <small className="field-error">{error.fields.images[0]}</small>
            )}
            <small className="form-hint">
              Dùng URL HTTPS, đường dẫn /images/ có sẵn hoặc tải tệp PNG/JPEG/WebP bên dưới. Tối đa 8 ảnh.
            </small>
          </div>
          <div className="field">
            <label htmlFor="product-upload">Tải ảnh lên (tối đa 2 MB)</label>
            <input
              id="product-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={upload}
            />
            {uploading && <small role="status">Đang tải ảnh lên…</small>}
          </div>
          <div className="editor-actions">
            <button className="button">
              {pending ? "Đang lưu…" : "Lưu sản phẩm"}
            </button>
            <button
              type="button"
              className="button button-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}

function Editor({ id, categories, brands, onSaved, onClose }) {
  const data = useRemote(
    id === "new" ? "/categories" : `/admin/products/${id}`,
  );
  if (data.loading) return <Notice>Đang tải trình chỉnh sửa…</Notice>;
  if (data.error)
    return (
      <Notice error>
        {data.error.message}{" "}
        <button className="text-button" onClick={onClose}>
          Quay lại danh mục
        </button>
      </Notice>
    );
  return (
    <ProductForm
      key={`${id}-${data.data.product?.version ?? 0}`}
      product={data.data.product}
      categories={categories}
      brands={brands}
      onSaved={onSaved}
      onClose={onClose}
      reload={data.refresh}
    />
  );
}

export default function AdminCatalog() {
  const [selected, setSelected] = useState(null),
    [query, setQuery] = useState(""),
    [active, setActive] = useState("all"),
    [page, setPage] = useState(1),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  const categories = useRemote("/categories"),
    brands = useRemote("/brands");
  const catalog = useRemote(
    `/admin/products?${new URLSearchParams({ q: query, active, page: String(page) })}`,
  );
  async function visibility(product) {
    setPending(true);
    setError("");
    setMessage("");
    try {
      await api(
        `/admin/products/${product.id}`,
        product.active
          ? { method: "DELETE", body: { version: product.version } }
          : {
              method: "PATCH",
              body: { version: product.version, active: true },
            },
      );
      setMessage(product.active ? "Đã ẩn sản phẩm." : "Đã hiển thị sản phẩm.");
      catalog.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }
  function saved() {
    setSelected(null);
    setMessage("Đã lưu sản phẩm.");
    catalog.refresh();
  }
  return (
    <div className="shell page-section">
      <nav className="breadcrumbs">
        <Link to="/admin">Quản trị</Link>
        <span>/</span>
        <span>Danh mục sản phẩm</span>
      </nav>
      <div className="section-heading">
        <div>
          <p className="eyebrow">CẬP NHẬT CỬA HÀNG</p>
          <h1 className="page-title">Quản lý danh mục sản phẩm.</h1>
        </div>
        {selected === null && (
          <button
            className="button"
            onClick={() => {
              setSelected("new");
              setMessage("");
            }}
          >
            Thêm sản phẩm +
          </button>
        )}
      </div>
      {message && <Notice>{message}</Notice>}
      {error && <Notice error>{error}</Notice>}
      {categories.loading || brands.loading ? (
        <Notice>Đang tải danh mục và thương hiệu…</Notice>
      ) : categories.error || brands.error ? (
        <Notice error>Không tải được danh mục và thương hiệu.</Notice>
      ) : selected !== null ? (
        <Editor
          id={selected}
          categories={categories.data.categories}
          brands={brands.data.brands}
          onSaved={saved}
          onClose={() => setSelected(null)}
        />
      ) : (
        <>
          <div className="metadata-grid">
            <Metadata
              kind="categories"
              records={categories.data.categories}
              refresh={categories.refresh}
            />
            <Metadata
              kind="brands"
              records={brands.data.brands}
              refresh={brands.refresh}
            />
          </div>
          <div className="admin-toolbar">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                setQuery(
                  String(new FormData(event.currentTarget).get("q") ?? ""),
                );
                setPage(1);
              }}
            >
              <label className="visually-hidden" htmlFor="admin-search">
                Tìm trong danh mục
              </label>
              <input
                id="admin-search"
                name="q"
                defaultValue={query}
                placeholder="Tìm tên hoặc SKU"
                maxLength={120}
              />
              <button className="button button-small">Tìm kiếm</button>
            </form>
            <label>
              Trạng thái hiển thị{" "}
              <select
                value={active}
                onChange={(event) => {
                  setActive(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Tất cả sản phẩm</option>
                <option value="true">Đang hiển thị</option>
                <option value="false">Đã ẩn</option>
              </select>
            </label>
          </div>
          {catalog.loading ? (
            <Notice>Đang tải sản phẩm…</Notice>
          ) : catalog.error ? (
            <Notice error>{catalog.error.message}</Notice>
          ) : !catalog.data.products.length ? (
            <Notice>
              Không tìm thấy sản phẩm. Hãy thử tìm kiếm khác hoặc thêm sản phẩm.
            </Notice>
          ) : (
            <>
              <div className="table-scroll">
                <table className="management-table">
                  <thead>
                    <tr>
                      <th>Sản phẩm</th>
                      <th>Danh mục / thương hiệu</th>
                      <th>Giá</th>
                      <th>Tồn kho</th>
                      <th>Trạng thái hiển thị</th>
                      <th>Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {catalog.data.products.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <strong>{product.name}</strong>
                          <small>{product.sku}</small>
                        </td>
                        <td>
                          {viText(product.category.name)}
                          <small>{product.brand.name}</small>
                        </td>
                        <td>{money(product.price)}</td>
                        <td>{product.stock}</td>
                        <td>{product.active ? "Đang hiển thị" : "Đã ẩn"}</td>
                        <td className="row-actions">
                          <button
                            className="text-button"
                            disabled={pending}
                            onClick={() => {
                              setSelected(product.id);
                              setMessage("");
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="text-button"
                            disabled={pending}
                            onClick={() => visibility(product)}
                          >
                            {product.active ? "Ẩn" : "Hiển thị"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {catalog.data.total > catalog.data.pageSize && (
                <nav className="pagination-row">
                  <button
                    className="button button-secondary"
                    disabled={page <= 1}
                    onClick={() => setPage((value) => value - 1)}
                  >
                    Trước
                  </button>
                  <span>Trang {page}</span>
                  <button
                    className="button button-secondary"
                    disabled={
                      page * catalog.data.pageSize >= catalog.data.total
                    }
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Tiếp
                  </button>
                </nav>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
