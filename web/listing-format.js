function cleanText(value) {
  return String(value || "").replace(/&(?:nbsp|#160|#x0*a0);/gi, " ").replace(/\s+/g, " ").trim();
}

export function listingHeading(item) {
  // Older exports may contain whole pages in the address or title fields.
  for (const value of [item.direccion, item.titulo]) {
    const text = cleanText(value);
    if (text && text.length <= 200) return text;
  }
  return "Propiedad sin dirección";
}

export function listingType(item) {
  const text = cleanText(item.tipo).replace(/^Tipo de inmueble:\s*/i, "");
  return text && text.length <= 80 ? text : "Tipo s/d";
}
