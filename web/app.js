import { listingHeading, listingType } from "./listing-format.js";
import { neighborhoodFor, operationFor } from "./property-fields.js";
import { roomOptions, matchesRooms } from "./room-filter.js";

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
  neighborhood: document.querySelector("#neighborhood"),
  operation: document.querySelector("#operation"),
  propertyType: document.querySelector("#propertyType"),
  agency: document.querySelector("#agency"),
  roomsDropdown: document.querySelector("#roomsDropdown"),
  roomsSummary: document.querySelector("#roomsSummary"),
  roomsOptions: document.querySelector("#roomsOptions"),
  clearRooms: document.querySelector("#clearRooms")
};

init();

async function init() {
  try {
    const response = await fetch("./publicaciones.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();

    state.listings = Array.isArray(data.listings) ? data.listings : [];
    hydrateDerivedFields(state.listings);
    populateNeighborhoods(state.listings);
    populateAgencies(state.listings);
    populateRooms(state.listings);
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
  elements.roomsOptions.addEventListener("change", () => {
    updateRoomsSummary();
    render();
  });
  elements.clearRooms.addEventListener("click", () => {
    for (const checkbox of elements.roomsOptions.querySelectorAll("input")) checkbox.checked = false;
    updateRoomsSummary();
    render();
  });
  document.addEventListener("pointerdown", (event) => {
    if (!elements.roomsDropdown.contains(event.target)) elements.roomsDropdown.open = false;
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && elements.roomsDropdown.open) {
      elements.roomsDropdown.open = false;
      elements.roomsDropdown.querySelector("summary").focus();
    }
  });
  for (const element of [
    elements.search,
    elements.maxPrice,
    elements.neighborhood,
    elements.operation,
    elements.propertyType,
    elements.agency
  ]) {
    element.addEventListener("input", render);
  }
}

function selectedRooms() {
  return [...elements.roomsOptions.querySelectorAll("input:checked")].map(input => input.value);
}

function populateRooms(listings) {
  for (const value of roomOptions(listings)) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = value;
    input.name = "ambientes";
    label.append(input, value === "unknown" ? "Sin dato" : `${value} ${value === "1" ? "ambiente" : "ambientes"}`);
    elements.roomsOptions.append(label);
  }
}

function updateRoomsSummary() {
  const selected = selectedRooms();
  const label = selected.length ? selected.map(value => value === "unknown" ? "Sin dato" : `${value} amb.`).join(", ") : "Todos";
  elements.roomsSummary.textContent = label;
  elements.roomsSummary.title = label;
}

function hydrateDerivedFields(listings) {
  for (const item of listings) {
    item.barrio = neighborhoodFor(item);
    item.operacion = operationFor(item);
  }
}

function populateNeighborhoods(listings) {
  const detected = listings.map((item) => item.barrio).filter(Boolean);
  const neighborhoods = [...new Set(detected)].sort((a, b) => a.localeCompare(b, "es"));
  for (const neighborhood of neighborhoods) {
    const option = document.createElement("option");
    option.value = neighborhood;
    option.textContent = neighborhood;
    elements.neighborhood.appendChild(option);
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
  const neighborhood = elements.neighborhood.value;
  const operation = elements.operation.value;
  const propertyType = elements.propertyType.value;
  const agency = elements.agency.value;
  const rooms = selectedRooms();

  state.filtered = state.listings.filter((item) => {
    const text = normalize([item.inmobiliaria, item.direccion, item.barrio, item.titulo, item.resumen].join(" "));
    if (query && !text.includes(query)) return false;
    if (agency && item.inmobiliaria !== agency) return false;
    if (neighborhood && item.barrio !== neighborhood) return false;
    if (operation && item.operacion !== operation && !(item.operacion === "Venta / Alquiler" && ["Venta", "Alquiler"].includes(operation))) return false;
    if (propertyType && !matchesPropertyType(item, propertyType)) return false;
    if (!matchesRooms(item, rooms)) return false;
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
  title.textContent = listingHeading(item);

  const meta = document.createElement("div");
  meta.className = "meta";
  meta.append(
    pill(item.inmobiliaria),
    pill(item.barrio || "Barrio s/d"),
    pill(item.operacion || "Operación s/d"),
    pill(item.metros ? `${formatNumber(item.metros)} m² ${item.superficieTipo || ""}`.trim() : "m² s/d"),
    pill(listingType(item))
  );
  if (item.ambientes) meta.append(pill(`${item.ambientes} amb.`));
  if (item.cochera && item.cochera !== "No informado") meta.append(pill(`Cochera: ${item.cochera}`));
  if (item.revision?.length) {
    const review = pill("Datos incompletos");
    review.className = "needs-review";
    meta.append(review);
  }

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

function matchesPropertyType(item, propertyType) {
  const text = normalize(item.tipo || [item.titulo, item.link].join(" "));
  if (propertyType === "Casa") return text.includes("casa") || text.includes("chalet");
  if (propertyType === "Departamento") return text.includes("departamento");
  return true;
}
