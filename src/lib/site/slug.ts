/** Transforme « Le Petit Provençal » en « le-petit-provencal » pour l'adresse du site. */
export function slugify(name: string) {
  const s = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
  return s || "mon-site";
}

export function publicPath(slug: string) {
  return `/s/${slug}`;
}
