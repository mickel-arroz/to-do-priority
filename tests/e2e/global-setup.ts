import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.test.local" });
dotenv.config({ path: ".env.local" });

export const E2E_EMAIL = "e2e@test.local";
export const E2E_PASSWORD = "e2e-password-123!";

/**
 * Creates a confirmed test user via the admin API (bypasses email
 * confirmation) and wipes their data for isolation. Requires
 * SUPABASE_SERVICE_ROLE_KEY in .env.test.local.
 */
export default async function globalSetup() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "e2e tests need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.test.local)"
    );
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: list } = await admin.auth.admin.listUsers();
  let user = list?.users.find((u) => u.email === E2E_EMAIL);

  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({
      email: E2E_EMAIL,
      password: E2E_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "E2E Tester" },
    });
    if (error) throw error;
    user = data.user;
  }

  // Wipe rows for isolation; the General category and profile stay
  const uid = user!.id;
  await admin.from("habit_logs").delete().eq("user_id", uid);
  await admin.from("habit_tasks").delete().eq("user_id", uid);
  await admin.from("habits").delete().eq("user_id", uid);
  await admin.from("task_completions").delete().eq("user_id", uid);
  await admin.from("tasks").delete().eq("user_id", uid);
  await admin.from("categories").delete().eq("user_id", uid).eq("is_default", false);
}
