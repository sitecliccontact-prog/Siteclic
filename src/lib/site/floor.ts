import type { FloorTable, SiteContent } from "./schema";

/** Plan de salle d'exemple, prêt à l'emploi pour tout restaurant (modifiable ensuite dans l'éditeur).
    Positions en % du plan (centre de la table). */
export const SAMPLE_FLOOR: FloorTable[] = [
  { id: "t1", label: "1", seats: 2, x: 12, y: 27, shape: "rond", zone: "Fenêtre" },
  { id: "t2", label: "2", seats: 2, x: 12, y: 56, shape: "rond", zone: "Fenêtre" },
  { id: "t3", label: "3", seats: 4, x: 37, y: 27, shape: "carre", zone: "Salle" },
  { id: "t4", label: "4", seats: 4, x: 37, y: 56, shape: "carre", zone: "Salle" },
  { id: "t5", label: "5", seats: 6, x: 72, y: 27, shape: "long", zone: "Salle" },
  { id: "t6", label: "6", seats: 4, x: 66, y: 56, shape: "carre", zone: "Salle" },
  { id: "t7", label: "7", seats: 2, x: 88, y: 56, shape: "rond", zone: "Salle" },
  { id: "t8", label: "8", seats: 2, x: 12, y: 87, shape: "rond", zone: "Terrasse" },
  { id: "t9", label: "9", seats: 2, x: 32, y: 87, shape: "rond", zone: "Terrasse" },
  { id: "t10", label: "10", seats: 4, x: 54, y: 87, shape: "carre", zone: "Terrasse" },
  { id: "t11", label: "11", seats: 6, x: 82, y: 87, shape: "long", zone: "Terrasse" },
];

/** Zones du plan (pour les étiquettes) : position de l'étiquette au-dessus des tables de la zone. */
export function floorZones(tables: FloorTable[]) {
  const by = new Map<string, FloorTable[]>();
  for (const t of tables) if (t.zone) by.set(t.zone, [...(by.get(t.zone) ?? []), t]);
  return [...by.entries()].map(([name, list]) => ({
    name,
    x: Math.min(...list.map((t) => t.x)),
    y: Math.min(...list.map((t) => t.y)),
    outside: /terrasse|jardin|patio|extérieur|exterieur/i.test(name),
  }));
}

/** Tables affichées dans la fenêtre de réservation : le plan du commerçant,
    ou le plan d'exemple tant qu'il n'a pas dessiné le sien (sauf s'il a retiré son plan). */
export function siteFloor(c: SiteContent): FloorTable[] {
  const f = c.floor;
  if (!f || !f.tables.length) return SAMPLE_FLOOR;
  return f.enabled ? f.tables : [];
}
