export function roomValue(value) {
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? String(count) : "unknown";
}

export function roomOptions(listings) {
  const counts = new Set(["1", "2", "3", "4", "5"]);
  for (const item of listings) {
    const value = roomValue(item.ambientes);
    if (value !== "unknown") counts.add(value);
  }
  return [...counts].sort((a, b) => Number(a) - Number(b)).concat("unknown");
}

export function matchesRooms(item, selected) {
  return selected.length === 0 || selected.includes(roomValue(item.ambientes));
}
