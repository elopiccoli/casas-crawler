// Unknown is deliberately separate from an explicitly absent parking space.
export function parkingStatus(value, structured = false) {
  const text = String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
  if (!text) return "";
  if (structured && /^(?:\d+|si|no|true|false)$/.test(text)) {
    return /^(?:0|no|false)$/.test(text) ? "No" : "Sí";
  }
  const space = "(?:cocheras?|garages?|garajes?)";
  if (!new RegExp(`\\b${space}\\b`).test(text)) return "";
  if (new RegExp(`\\b${space}\\b[^.;!?]{0,35}\\b(?:opcional|optativa|adicional|aparte|no incluid[ao]|por separado)\\b|\\b(?:opcional|opcion (?:de|a)|posibilidad de(?: alquilar)?)\\s+(?:una\\s+)?${space}\\b`).test(text)) return "Opcional";
  const no = new RegExp(`\\b(?:sin|no tiene|no posee|no cuenta con|no dispone de)\\s+(?:una?\\s+)?${space}\\b|\\b${space}\\s*:?\\s*(?:no|0)\\b`).test(text);
  const yes = new RegExp(`\\b(?:con|incluye|incluyen|tiene|posee|cuenta con|dispone de)\\s+(?:(?:una?|dos|\\d+)\\s+)?${space}\\b|\\b${space}\\b\\s*(?:incluid[ao]|cubiert[ao]|descubiert[ao]|fij[ao]|propi[ao]|doble)\\b|\\b${space}\\s*:?\\s*(?:si|[1-9]\\d*)\\b`).test(text);
  if (no) return "No";
  if (yes) return "Sí";
  if (new RegExp(`(?:^|[,;+])\\s*${space}\\b(?:\\s*[,;+]|\\s+para\\s+(?:un|dos|\\d+)\\s+(?:auto|vehiculo))|\\bcon\\s+(?:tambien\\s+)?espacio\\s+de\\s+${space}\\b`).test(text)) return "Sí";
  if (structured && new RegExp(`^${space}\\s*:?\\s*[1-9]\\d*$`).test(text)) return "Sí";
  return "";
}

export function parkingFor(fields) {
  return parkingStatus(fields.parkingRaw, true)
    || parkingStatus(fields.title)
    || parkingStatus(fields.summary)
    || "No informado";
}
