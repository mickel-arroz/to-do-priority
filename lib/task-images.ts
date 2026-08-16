import type { createClient } from "@/lib/supabase/server";
import type { Task } from "@/lib/types";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

const BUCKET = "task-images";
const SIGNED_URL_TTL = 3600; // 1h, matches the upload endpoint

/**
 * Attach a fresh signed URL to every `task_images` entry.
 *
 * `storage_path` is what lives in the DB; the browser can only render the image
 * through a short-lived signed URL. The upload endpoint signs URLs on create,
 * but server-side reads don't — so without this the image goes blank after a
 * reload. Signs all paths in a single batched Storage call.
 */
export async function attachImageUrls(
  supabase: ServerSupabase,
  tasks: Task[]
): Promise<Task[]> {
  const paths = tasks.flatMap((t) =>
    (t.task_images ?? []).map((img) => img.storage_path)
  );
  if (paths.length === 0) return tasks;

  const { data } = await supabase.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);

  const urlByPath = new Map<string, string>();
  for (const item of data ?? []) {
    if (item.path && item.signedUrl) urlByPath.set(item.path, item.signedUrl);
  }

  return tasks.map((t) =>
    t.task_images && t.task_images.length > 0
      ? {
          ...t,
          task_images: t.task_images.map((img) => ({
            ...img,
            signed_url: urlByPath.get(img.storage_path),
          })),
        }
      : t
  );
}
