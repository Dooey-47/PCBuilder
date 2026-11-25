import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "./api.js";
import useRemote from "./useRemote.js";
import { Notice } from "./shop-ui.jsx";
import { money } from "./format.js";

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
      <summary>Manage {kind}</summary>
      {error && <Notice error>{error}</Notice>}
      <form onSubmit={(event) => save(event)} className="metadata-row">
        <label className="visually-hidden" htmlFor={`new-${kind}`}>
          New {kind === "brands" ? "brand" : "category"} name
        </label>
        <input
          id={`new-${kind}`}
          name="name"
          placeholder={`New ${kind === "brands" ? "brand" : "category"}`}
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
        Records referenced by products cannot be deleted.
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
    warrantyText: product?.warrantyText ?? "24-month limited warranty.",
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
            throw new Error("Use one specification per line: Name: Value.");
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
      <h2>{product ? "Edit product" : "Add product"}</h2>
      <p className="muted">
        Prices are whole VND. Stock changes are checked against the version you
        opened.
      </p>
      {error && (
        <Notice error>
          {error.message}
          {error.status === 409 && product && (
            <button className="text-button reload-editor" onClick={reload}>
              Reload latest product and discard this form
            </button>
          )}
        </Notice>
      )}
      <form onSubmit={submit}>
        <fieldset disabled={pending || uploading}>
          <div className="editor-grid">
            {field("name", "Product name", { maxLength: 150 })}
            {field("sku", "Unique SKU", { maxLength: 60 })}
            {field("price", "Price (VND)", {
              type: "number",
              min: 0,
              max: 99999999999999,
              step: 1,
            })}
            {field("stock", "Stock", {
              type: "number",
              min: 0,
              max: 2147483647,
              step: 1,
            })}
            <div className="field">
              <label htmlFor="product-category">Category</label>
              <select
                id="product-category"
                name="categoryId"
                value={form.categoryId}
                onChange={change}
                required
              >
                <option value="">Choose category</option>
                {categories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="product-brand">Brand</label>
              <select
                id="product-brand"
                name="brandId"
                value={form.brandId}
                onChange={change}
                required
              >
                <option value="">Choose brand</option>
                {brands.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="product-description">Description</label>
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
          {field("warrantyText", "Warranty terms", { maxLength: 1000 })}
          <label className="check-label">
            <input
              type="checkbox"
              name="active"
              checked={form.active}
              onChange={change}
            />{" "}
            Published in storefront
          </label>
          <fieldset className="use-cases">
            <legend>Use cases</legend>
            {["study", "office", "gaming", "creative"].map((value) => (
              <label key={value} className="check-label">
                <input
                  type="checkbox"
                  checked={form.useCases.includes(value)}
                  onChange={() => tag(value)}
                />{" "}
                {value}
              </label>
            ))}
          </fieldset>
          <div className="field">
            <label htmlFor="product-specs">
              Specifications — one Name: Value per line
            </label>
            <textarea
              id="product-specs"
              name="specs"
              value={form.specs}
              onChange={change}
              rows={6}
              placeholder={"Memory: 16 GB\nStorage: 512 GB SSD"}
            />
            {error?.fields?.specs && (
              <small className="field-error">{error.fields.specs[0]}</small>
            )}
            <small className="form-hint">
              Common aliases are normalized: RAM → Memory, CPU → Processor, SSD
              → Storage.
            </small>
          </div>
          <div className="field">
            <label htmlFor="product-images">
              Image URLs — one per line, first image is primary
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
              Use HTTPS URLs, existing /images/ paths, or upload PNG/JPEG/WebP
              files below. Maximum 8 images.
            </small>
          </div>
          <div className="field">
            <label htmlFor="product-upload">Upload an image (max 2 MB)</label>
            <input
              id="product-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={upload}
            />
            {uploading && <small role="status">Uploading image…</small>}
          </div>
          <div className="editor-actions">
            <button className="button">
              {pending ? "Saving…" : "Save product"}
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
  if (data.loading) return <Notice>Loading editor…</Notice>;
  if (data.error)
    return (
      <Notice error>
        {data.error.message}{" "}
        <button className="text-button" onClick={onClose}>
          Back to catalog
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
      setMessage(product.active ? "Product hidden." : "Product published.");
      catalog.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }
  function saved() {
    setSelected(null);
    setMessage("Product saved.");
    catalog.refresh();
  }
  return (
    <div className="shell page-section">
      <nav className="breadcrumbs">
        <Link to="/admin">Admin</Link>
        <span>/</span>
        <span>Catalog</span>
      </nav>
      <div className="section-heading">
        <div>
          <p className="eyebrow">KEEP THE STORE CURRENT</p>
          <h1 className="page-title">Catalog management.</h1>
        </div>
        {selected === null && (
          <button
            className="button"
            onClick={() => {
              setSelected("new");
              setMessage("");
            }}
          >
            Add product +
          </button>
        )}
      </div>
      {message && <Notice>{message}</Notice>}
      {error && <Notice error>{error}</Notice>}
      {categories.loading || brands.loading ? (
        <Notice>Loading categories and brands…</Notice>
      ) : categories.error || brands.error ? (
        <Notice error>Could not load catalog options.</Notice>
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
                Search catalog
              </label>
              <input
                id="admin-search"
                name="q"
                defaultValue={query}
                placeholder="Search name or SKU"
                maxLength={120}
              />
              <button className="button button-small">Search</button>
            </form>
            <label>
              Visibility{" "}
              <select
                value={active}
                onChange={(event) => {
                  setActive(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All products</option>
                <option value="true">Published</option>
                <option value="false">Hidden</option>
              </select>
            </label>
          </div>
          {catalog.loading ? (
            <Notice>Loading products…</Notice>
          ) : catalog.error ? (
            <Notice error>{catalog.error.message}</Notice>
          ) : !catalog.data.products.length ? (
            <Notice>
              No products match. Try another search or add a product.
            </Notice>
          ) : (
            <>
              <div className="table-scroll">
                <table className="management-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category / brand</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Visibility</th>
                      <th>Actions</th>
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
                          {product.category.name}
                          <small>{product.brand.name}</small>
                        </td>
                        <td>{money(product.price)}</td>
                        <td>{product.stock}</td>
                        <td>{product.active ? "Published" : "Hidden"}</td>
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
                            {product.active ? "Hide" : "Publish"}
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
                    Previous
                  </button>
                  <span>Page {page}</span>
                  <button
                    className="button button-secondary"
                    disabled={
                      page * catalog.data.pageSize >= catalog.data.total
                    }
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next
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
