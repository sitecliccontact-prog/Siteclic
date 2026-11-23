import type { PublishState } from "@/components/PublishButton";

type Row = { status?: string | null; slug?: string | null; published_at?: string | null; updated_at?: string | null };

/** État de mise en ligne d'un site, à partir de sa ligne en base. */
export function publishState(row: Row | null | undefined): PublishState {
  const online = row?.status === "en_ligne" && Boolean(row.slug);
  const hasChanges = Boolean(online && row?.published_at && row.updated_at && new Date(row.updated_at) > new Date(row.published_at));
  return { online, slug: row?.slug ?? null, hasChanges };
}
