import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Eski "Uy vazifalari" sahifasi.
 *
 * Vazifalar endi guruh sahifasining "Vazifalar" tabida
 * (`/admin/crm/guruh?id=...&tab=vazifalar`). Bu manzil eski
 * havolalar va xatcho'plar uchun qoldirildi: o'quv guruhi id'sidan
 * CRM guruhini topib, o'sha tabga yo'naltiradi.
 */
type PageProps = {
  searchParams: Promise<{
    groupId?: string | string[];
  }>;
};

export default async function AdminGroupAssignmentsPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;
  const raw = Array.isArray(params.groupId) ? params.groupId[0] : params.groupId;
  const groupId = Number(raw);

  if (!Number.isInteger(groupId) || groupId <= 0) {
    notFound();
  }

  const supabase = await createClient();

  const { data } = await supabase
    .from("crm_groups")
    .select("id")
    .eq("study_group_id", groupId)
    .maybeSingle();

  redirect(
    data ? `/admin/crm/guruh?id=${data.id}&tab=vazifalar` : "/admin/crm",
  );
}
