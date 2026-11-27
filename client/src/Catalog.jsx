import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import useRemote from "./useRemote.js";
import { AddToCart, Notice } from "./shop-ui.jsx";
import { money } from "./format.js";
import { viText, viUseCase } from "./vi.js";

function Card({ product }) {
  return (
    <article className="product-card">
      <Link
        to={`/products/${product.id}`}
        className="product-image-link"
        aria-label={`Xem ${product.name}`}
      >
        <span className="product-category">{viText(product.category.name)}</span>
        {product.images[0] && (
          <img
            src={product.images[0].url}
            alt={viText(product.images[0].alt)}
            width="480"
            height="360"
            loading="lazy"
          />
        )}
        <span className="image-arrow" aria-hidden="true">
          ↗
        </span>
      </Link>
      <div className="product-info">
        <p className="eyebrow muted">{product.brand.name}</p>
        <h3>
          <Link to={`/products/${product.id}`}>{product.name}</Link>
        </h3>
        <p className="product-spec-preview">
          {product.specs
            .slice(0, 2)
            .map((item) => viText(item.value))
            .join(" · ")}
        </p>
        <div className="product-bottom">
          <strong>{money(product.price)}</strong>
          <span className={`stock ${product.stock ? "" : "stock-empty"}`}>
            {product.stock ? `${product.stock} còn hàng` : "Hết hàng"}
          </span>
        </div>
        <AddToCart product={product} />
      </div>
    </article>
  );
}
export default function Catalog() {
  const [filtersOpen, setFiltersOpen] = useState(
    () =>
      typeof window === "undefined" ||
      window.matchMedia("(min-width: 761px)").matches,
  );
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "";
  const categories = useRemote("/categories"),
    brands = useRemote("/brands");
  const queryParams = new URLSearchParams(params);
  queryParams.delete("spec");
  const query = queryParams.toString();
  const catalog = useRemote(`/products${query ? `?${query}` : ""}`);
  const page = Number(params.get("page") ?? 1);
  function change(name, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== "page") next.delete("page");
    setParams(next);
  }
  function submitFilters(event) {
    event.preventDefault();
    const values = new FormData(event.currentTarget),
      next = new URLSearchParams(params);
    for (const name of ["q", "brand", "min_price", "max_price"]) {
      const value = String(values.get(name) ?? "").trim();
      if (value) next.set(name, value);
      else next.delete(name);
    }
    if (values.get("in_stock")) next.set("in_stock", "true");
    else next.delete("in_stock");
    next.delete("page");
    setParams(next);
  }
  const chosen = categories.data?.categories.find(
    (item) => String(item.id) === category,
  );
  return (
    <div className="shell">
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="blue-dot" /> PCBUILDER
          </p>
          <h1>
            Chọn đúng thiết bị.
            <br />
            <span>Sẵn sàng bứt phá.</span>
          </h1>
          <p className="hero-description">
            Tìm máy tính và linh kiện phù hợp với nhu cầu của bạn.
          </p>
          <a className="button" href="#catalog">
            Khám phá sản phẩm ↗
          </a>
        </div>
        <div className="hero-visual">
          <div className="hero-orbit" />
          <span className="hero-tag">SẴN SÀNG CHO BƯỚC TIẾP THEO</span>
          <img
            src="/images/laptop.svg"
            alt="Máy tính xách tay"
            width="480"
            height="360"
          />
          <div className="hero-product-label">
            <span>Góc nhìn mới.</span>
            <strong>Mở rộng khả năng. ↗</strong>
          </div>
        </div>
      </section>
      <section id="catalog" className="catalog-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">TÌM THIẾT BỊ PHÙ HỢP</p>
            <h2>{chosen ? viText(chosen.name) : "Khám phá sản phẩm"}</h2>
          </div>
          <span className="muted">
            {catalog.data ? `${catalog.data.total} sản phẩm` : "Danh mục sản phẩm"}
          </span>
        </div>
        <div className="category-tabs" aria-label="Danh mục sản phẩm">
          <button
            className={!category ? "selected" : ""}
            aria-pressed={!category}
            onClick={() => change("category", "")}
          >
            Tất cả sản phẩm
          </button>
          {categories.data?.categories.map((item) => (
            <button
              key={item.id}
              className={category === String(item.id) ? "selected" : ""}
              aria-pressed={category === String(item.id)}
              onClick={() => change("category", String(item.id))}
            >
              {viText(item.name)}
            </button>
          ))}
        </div>
        <div className="use-case-tabs" aria-label="Mua theo nhu cầu">
          <span>Nhu cầu:</span>
          {["study", "office", "gaming", "creative"].map((value) => (
            <button
              key={value}
              aria-pressed={params.get("use_case") === value}
              className={params.get("use_case") === value ? "selected" : ""}
              onClick={() =>
                change(
                  "use_case",
                  params.get("use_case") === value ? "" : value,
                )
              }
            >
              {viUseCase(value)}
            </button>
          ))}
        </div>
        <div className="results-toolbar results-toolbar-wide">
          <span className="muted">Chọn sản phẩm phù hợp với bạn.</span>
          <label htmlFor="sort">
            Sắp xếp{" "}
            <select
              id="sort"
              value={params.get("sort") ?? "featured"}
              onChange={(event) => change("sort", event.target.value)}
            >
              <option value="featured">Nổi bật</option>
              <option value="price_asc">Giá: thấp đến cao</option>
              <option value="price_desc">Giá: cao đến thấp</option>
              <option value="name">Tên</option>
              <option value="newest">Mới nhất</option>
            </select>
          </label>
        </div>
        <div className="catalog-with-filters">
          <details
            className="filter-panel"
            open={filtersOpen}
            onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
          >
            <summary>Tìm kiếm và bộ lọc</summary>
            <form
              onSubmit={submitFilters}
              key={`${params.toString()}-${brands.data?.brands.length ?? 0}`}
            >
              <label htmlFor="search">Tìm sản phẩm</label>
              <input
                id="search"
                name="q"
                defaultValue={params.get("q") ?? ""}
                maxLength={120}
                placeholder="Tên, mẫu mã hoặc thương hiệu"
              />
              <label htmlFor="brand">Thương hiệu</label>
              <select
                id="brand"
                name="brand"
                defaultValue={params.get("brand") ?? ""}
              >
                <option value="">Tất cả thương hiệu</option>
                {brands.data?.brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
              <details className="advanced-filters">
                <summary>Khoảng giá và tồn kho</summary>
              <div className="price-fields">
                <div>
                  <label htmlFor="min_price">Giá thấp nhất (VND)</label>
                  <input
                    id="min_price"
                    name="min_price"
                    type="number"
                    min="0"
                    max="99999999999999"
                    step="1"
                    defaultValue={params.get("min_price") ?? ""}
                  />
                </div>
                <div>
                  <label htmlFor="max_price">Giá cao nhất (VND)</label>
                  <input
                    id="max_price"
                    name="max_price"
                    type="number"
                    min="0"
                    max="99999999999999"
                    step="1"
                    defaultValue={params.get("max_price") ?? ""}
                  />
                </div>
              </div>
              <label className="check-label">
                <input
                  type="checkbox"
                  name="in_stock"
                  defaultChecked={params.get("in_stock") === "true"}
                />{" "}
                Chỉ sản phẩm còn hàng
              </label>
              </details>
              <button className="button button-full">Áp dụng bộ lọc</button>
            </form>
            <button
              className="text-button clear-filters"
              onClick={() => setParams({})}
            >
              Xóa tất cả bộ lọc
            </button>
            {(brands.error || categories.error) && (
              <Notice error>
                Không tải được một số tùy chọn lọc. Hãy tải lại trang.
              </Notice>
            )}
          </details>
          <div className="catalog-results">
            {catalog.loading ? (
              <Notice>Đang tải sản phẩm…</Notice>
            ) : catalog.error ? (
              <Notice error>
                {catalog.error.message}{" "}
                <button className="text-button" onClick={() => setParams({})}>
                  Xóa bộ lọc
                </button>
              </Notice>
            ) : catalog.data.products.length ? (
              <div className="product-grid">
                {catalog.data.products.map((product) => (
                  <Card key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <Notice>
                Không có sản phẩm phù hợp.{" "}
                <button className="text-button" onClick={() => setParams({})}>
                  Xóa bộ lọc và thử lại
                </button>
              </Notice>
            )}
            {catalog.data && catalog.data.total > catalog.data.pageSize && (
              <nav className="pagination-row" aria-label="Trang sản phẩm">
                <button
                  className="button button-secondary"
                  disabled={page <= 1}
                  onClick={() => change("page", String(page - 1))}
                >
                  Trước
                </button>
                <span>
                  Trang {page} /{" "}
                  {Math.ceil(catalog.data.total / catalog.data.pageSize)}
                </span>
                <button
                  className="button button-secondary"
                  disabled={page * catalog.data.pageSize >= catalog.data.total}
                  onClick={() => change("page", String(page + 1))}
                >
                  Tiếp
                </button>
              </nav>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
