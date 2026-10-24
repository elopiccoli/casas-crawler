import { listingHeading, listingType } from "./listing-format.js";
import { neighborhoodFor, operationFor } from "./property-fields.js";
import { roomOptions, matchesRooms } from "./room-filter.js";
import { neighborhoodOptions, matchesNeighborhoods, matchesParking, matchesPropertyType, totalAreaFor, matchesMinimumTotalArea } from "./listing-filters.js";

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
  minTotalArea: document.querySelector("#minTotalArea"),
  neighborhoodDropdown: document.querySelector("#neighborhoodDropdown"),
  neighborhoodSummary: document.querySelector("#neighborhoodSummary"),
  neighborhoodOptions: document.querySelector("#neighborhoodOptions"),
  clearNeighborhoods: document.querySelector("#clearNeighborhoods"),
  parking: document.querySelector("#parking"),
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
  elements.neighborhoodOptions.addEventListener("change", () => {
    updateNeighborhoodSummary();
    render();
  });
  elements.clearNeighborhoods.addEventListener("click", () => {
    for (const checkbox of elements.neighborhoodOptions.querySelectorAll("input")) checkbox.checked = false;
    updateNeighborhoodSummary();
    render();
  });
  document.addEventListener("pointerdown", (event) => {
    for (const dropdown of [elements.roomsDropdown, elements.neighborhoodDropdown]) {
      if (!dropdown.contains(event.target)) dropdown.open = false;
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      for (const dropdown of [elements.roomsDropdown, elements.neighborhoodDropdown]) {
        if (!dropdown.open) continue;
        dropdown.open = false;
        dropdown.querySelector("summary").focus();
      }
    }
  });
  for (const element of [
    elements.search,
    elements.maxPrice,
    elements.minTotalArea,
    elements.parking,
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
  for (const name of [...neighborhoodOptions(listings), "unknown"]) {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = name;
    input.name = "barrios";
    label.append(input, name === "unknown" ? "Sin dato" : name);
    elements.neighborhoodOptions.append(label);
  }
}

function selectedNeighborhoods() {
  return [...elements.neighborhoodOptions.querySelectorAll("input:checked")].map(input => input.value);
}

function updateNeighborhoodSummary() {
  const selected = selectedNeighborhoods();
  const label = selected.length ? selected.map(value => value === "unknown" ? "Sin dato" : value).join(", ") : "Todos";
  elements.neighborhoodSummary.textContent = label;
  elements.neighborhoodSummary.title = label;
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
  const neighborhoods = selectedNeighborhoods();
  const parking = elements.parking.value;
  const operation = elements.operation.value;
  const propertyType = elements.propertyType.value;
  const agency = elements.agency.value;
  const rooms = selectedRooms();

  state.filtered = state.listings.filter((item) => {
    const text = normalize([item.inmobiliaria, item.direccion, item.barrio, item.titulo, item.resumen].join(" "));
    if (query && !text.includes(query)) return false;
    if (agency && item.inmobiliaria !== agency) return false;
    if (!matchesNeighborhoods(item, neighborhoods)) return false;
    if (!matchesParking(item, parking)) return false;
    if (operation && item.operacion !== operation && !(item.operacion === "Venta / Alquiler" && ["Venta", "Alquiler"].includes(operation))) return false;
    if (propertyType && !matchesPropertyType(item, propertyType)) return false;
    if (!matchesRooms(item, rooms)) return false;
    if (!matchesMinimumTotalArea(item, elements.minTotalArea.value)) return false;
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
    pill(totalAreaFor(item) ? `${formatNumber(totalAreaFor(item))} m² totales` : "m² totales s/d"),
    ...(item.superficieTipo === "total" && totalAreaFor(item) === item.metros ? [] : [
      pill(item.metros ? `${formatNumber(item.metros)} m² ${item.superficieTipo || ""}`.trim() : "m² s/d")
    ]),
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
