const state = {
  listings: [],
  filtered: []
};

const elements = {
  status: document.querySelector("#status"),
  resultCount: document.querySelector("#resultCount"),
  results: document.querySelector("#results"),
  empty: document.querySelector("#empty"),
  search: document.querySelector("#search"),
  maxPrice: document.querySelector("#maxPrice"),
  agency: document.querySelector("#agency")
};

init();

async function init() {
  try {
    const response = await fetch("./publicaciones.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    state.listings = Array.isArray(data.listings) ? data.listings : [];
    populateAgencies(state.listings);
    bindFilters();
    render();

    const generated = data.generatedAt ? formatDate(data.generatedAt) : "sin actualización todavía";
    elements.status.textContent = `Actualizado: ${generated}`;
  } catch (error) {
    elements.status.textContent = "No se pudo cargar publicaciones.json";
    elements.empty.hidden = false;
  }
}

function bindFilters() {
  for (const element of [elements.search, elements.maxPrice, elements.agency]) {
    element.addEventListener("input", render);
  }
}

function populateAgencies(listings) {
  const agencies = [...new Set(listings.map((item) => item.inmobiliaria).filter(Boolean))].sort();
  for (const agency of agencies) {
    const option = document.createElement("option");
    option.value = agency;
    option.textContent = agency;
    elements.agency.appendChild(option);
  }
}

function render() {
  const query = normalize(elements.search.value);
  const maxPrice = Number(elements.maxPrice.value || 0);
  const agency = elements.agency.value;

  state.filtered = state.listings.filter((item) => {
    const text = normalize([item.inmobiliaria, item.direccion, item.titulo, item.resumen].join(" "));
    if (query && !text.includes(query)) return false;
    if (agency && item.inmobiliaria !== agency) return false;
    if (maxPrice && Number(item.precio || 0) > maxPrice) return false;
    return true;
  });

  elements.resultCount.textContent = state.filtered.length;
  elements.empty.hidden = state.filtered.length !== 0;
  elements.results.replaceChildren(...state.filtered.map(createListingElement));
}

function createListingElement(item) {
  const article = document.createElement("article");
  article.className = "listing";

  const details = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = item.direccion || item.titulo || "Sin dirección";

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.append(
    pill(item.inmobiliaria),
    pill(item.metros ? `${formatNumber(item.metros)} m²` : "m² s/d"),
    pill(item.tipo || "Casa")
  );

  details.append(title, meta);

  const side = document.createElement("div");
  const price = document.createElement("div");
  price.className = "price";
  price.textContent = formatPrice(item);

  const link = document.createElement("a");
  link.className = "open";
  link.href = item.link;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = "Ver publicación";

  side.append(price, link);
  article.append(details, side);
  return article;
}

function pill(text) {
  const span = document.createElement("span");
  span.textContent = text || "s/d";
  return span;
}

function formatPrice(item) {
  if (!item.precio) return "Precio s/d";
  return `${item.moneda || ""} ${formatNumber(item.precio)}`.trim();
}

function formatNumber(value) {
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);
}

function formatDate(value) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}
