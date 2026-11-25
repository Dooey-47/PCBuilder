import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import useRemote from "./useRemote.js";
import { AddToCart, Notice } from "./shop-ui.jsx";
import { money } from "./format.js";

function parsedSpecs(value) {
  try {
    const parsed = JSON.parse(value ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}
function Card({ product }) {
  return (
    <article className="product-card">
      <Link
        to={`/products/${product.id}`}
        className="product-image-link"
        aria-label={`View ${product.name}`}
      >
        <span className="product-category">{product.category.name}</span>
        {product.images[0] && (
          <img
            src={product.images[0].url}
            alt={product.images[0].alt}
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
            .map((item) => item.value)
            .join(" · ")}
        </p>
        <div className="product-bottom">
          <strong>{money(product.price)}</strong>
          <span className={`stock ${product.stock ? "" : "stock-empty"}`}>
            {product.stock ? `${product.stock} in stock` : "Out of stock"}
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
  const facets = useRemote(
    `/catalog-filters${category ? `?category=${encodeURIComponent(category)}` : ""}`,
  );
  const query = params.toString();
  const catalog = useRemote(`/products${query ? `?${query}` : ""}`);
  const page = Number(params.get("page") ?? 1),
    specs = parsedSpecs(params.get("spec"));
  function change(name, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    if (name !== "page") next.delete("page");
    if (name === "category") next.delete("spec");
    setParams(next);
  }
  function selectSpec(name, value) {
    const next = { ...specs };
    if (value) next[name] = value;
    else delete next[name];
    change("spec", Object.keys(next).length ? JSON.stringify(next) : "");
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
            <span className="blue-dot" /> YOUR NEXT CHAPTER STARTS HERE
          </p>
          <h1>
            Good tech.
            <br />
            <span>Great possibilities.</span>
          </h1>
          <p className="hero-description">
            Find the right tools for your next idea.
            <br />
            Explore, compare specifications, and build your cart.
          </p>
          <a className="button" href="#catalog">
            Explore the collection ↗
          </a>
          <div className="hero-note">
            ✓ Clear specifications. Upfront prices.
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-orbit" />
          <span className="hero-tag">BUILT FOR WHAT’S NEXT</span>
          <img
            src="/images/laptop.svg"
            alt="Illustration of an open laptop"
            width="480"
            height="360"
          />
          <div className="hero-product-label">
            <span>A fresh perspective.</span>
            <strong>Make room for possibility. ↗</strong>
          </div>
        </div>
      </section>
      <section id="catalog" className="catalog-section">
        <div className="section-heading">
          <div>
            <p className="eyebrow">FIND YOUR NEXT ESSENTIAL</p>
            <h2>{chosen?.name ?? "Explore the collection"}</h2>
          </div>
          <span className="muted">
            {catalog.data ? `${catalog.data.total} products` : "Our collection"}
          </span>
        </div>
        <div className="category-tabs" aria-label="Product categories">
          <button
            className={!category ? "selected" : ""}
            aria-pressed={!category}
            onClick={() => change("category", "")}
          >
            All products
          </button>
          {categories.data?.categories.map((item) => (
            <button
              key={item.id}
              className={category === String(item.id) ? "selected" : ""}
              aria-pressed={category === String(item.id)}
              onClick={() => change("category", String(item.id))}
            >
              {item.name}
            </button>
          ))}
        </div>
        <div className="use-case-tabs" aria-label="Shop by need">
          <span>For your:</span>
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
              {value}
            </button>
          ))}
        </div>
        <div className="catalog-with-filters">
          <details
            className="filter-panel"
            open={filtersOpen}
            onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
          >
            <summary>Search & filters</summary>
            <form
              onSubmit={submitFilters}
              key={`${params.toString()}-${brands.data?.brands.length ?? 0}`}
            >
              <label htmlFor="search">Search products</label>
              <input
                id="search"
                name="q"
                defaultValue={params.get("q") ?? ""}
                maxLength={120}
                placeholder="Name, model or brand"
              />
              <label htmlFor="brand">Brand</label>
              <select
                id="brand"
                name="brand"
                defaultValue={params.get("brand") ?? ""}
              >
                <option value="">All brands</option>
                {brands.data?.brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
              <div className="price-fields">
                <div>
                  <label htmlFor="min_price">Min price (VND)</label>
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
                  <label htmlFor="max_price">Max price (VND)</label>
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
                In stock only
              </label>
              <button className="button button-full">Apply filters</button>
            </form>
            {Boolean(facets.data?.specifications.length) && (
              <details className="technical-filters" open={Boolean(category)}>
                <summary>Technical specifications</summary>
                {facets.data.specifications.map((spec) => (
                  <div className="spec-filter" key={spec.name}>
                    <label htmlFor={`spec-${spec.name}`}>{spec.name}</label>
                    <select
                      id={`spec-${spec.name}`}
                      value={specs[spec.name] ?? ""}
                      onChange={(event) =>
                        selectSpec(spec.name, event.target.value)
                      }
                    >
                      <option value="">Any</option>
                      {spec.values.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </details>
            )}
            <button
              className="text-button clear-filters"
              onClick={() => setParams({})}
            >
              Clear all filters
            </button>
            {(brands.error || categories.error || facets.error) && (
              <Notice error>
                Some filter options could not load. Refresh to retry.
              </Notice>
            )}
          </details>
          <div className="catalog-results">
            <div className="results-toolbar">
              <span className="muted">Choose what fits your next chapter.</span>
              <label htmlFor="sort">
                Sort{" "}
                <select
                  id="sort"
                  value={params.get("sort") ?? "featured"}
                  onChange={(event) => change("sort", event.target.value)}
                >
                  <option value="featured">Featured</option>
                  <option value="price_asc">Price: low to high</option>
                  <option value="price_desc">Price: high to low</option>
                  <option value="name">Name</option>
                  <option value="newest">Newest</option>
                </select>
              </label>
            </div>
            {catalog.loading ? (
              <Notice>Loading products…</Notice>
            ) : catalog.error ? (
              <Notice error>
                {catalog.error.message}{" "}
                <button className="text-button" onClick={() => setParams({})}>
                  Clear filters
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
                No matching products.{" "}
                <button className="text-button" onClick={() => setParams({})}>
                  Clear filters and try again
                </button>
              </Notice>
            )}
            {catalog.data && catalog.data.total > catalog.data.pageSize && (
              <nav className="pagination-row" aria-label="Product pages">
                <button
                  className="button button-secondary"
                  disabled={page <= 1}
                  onClick={() => change("page", String(page - 1))}
                >
                  Previous
                </button>
                <span>
                  Page {page} of{" "}
                  {Math.ceil(catalog.data.total / catalog.data.pageSize)}
                </span>
                <button
                  className="button button-secondary"
                  disabled={page * catalog.data.pageSize >= catalog.data.total}
                  onClick={() => change("page", String(page + 1))}
                >
                  Next
                </button>
              </nav>
            )}
          </div>
        </div>
        <p className="demo-note">
          Seeded products and prices are illustrative demo data. Your cart does
          not reserve stock.
        </p>
      </section>
    </div>
  );
}
