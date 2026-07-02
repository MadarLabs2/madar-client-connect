const NAMED_COLORS: Array<{ name: string; hex: string }> = [
  { name: "שחור", hex: "#000000" },
  { name: "לבן", hex: "#ffffff" },
  { name: "אפור", hex: "#808080" },
  { name: "כסף", hex: "#c0c0c0" },
  { name: "זהב", hex: "#d4af37" },
  { name: "בז'", hex: "#d2b48c" },
  { name: "חום", hex: "#8b4513" },
  { name: "אדום", hex: "#ff0000" },
  { name: "ורוד", hex: "#ffc0cb" },
  { name: "כתום", hex: "#ffa500" },
  { name: "צהוב", hex: "#ffff00" },
  { name: "ירוק", hex: "#008000" },
  { name: "טורקיז", hex: "#40e0d0" },
  { name: "כחול", hex: "#0000ff" },
  { name: "כחול כהה", hex: "#00008b" },
  { name: "סגול", hex: "#800080" },
  { name: "בורדו", hex: "#800020" },
  { name: "קרם", hex: "#fffdd0" },
  { name: "חאקי", hex: "#c3b091" },
  { name: "נavy", hex: "#001f3f" },
];

function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function getNearestColorName(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  let best = NAMED_COLORS[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const c of NAMED_COLORS) {
    const cr = hexToRgb(c.hex);
    if (!cr) continue;
    const d = (rgb.r - cr.r) ** 2 + (rgb.g - cr.g) ** 2 + (rgb.b - cr.b) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = c;
    }
  }
  return best.name;
}
