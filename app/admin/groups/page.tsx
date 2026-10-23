import { redirect } from "next/navigation";

/**
 * Eski "Guruhlar" ro'yxati.
 *
 * Onlayn va offline guruhlar birlashtirildi — endi ikkalasi ham
 * `/admin/crm` da bitta ro'yxatda turadi. Bu sahifa saqlanib
 * qolgan havolalar va xatcho'plar uchun qoldirildi.
 *
 * Guruhning ichki sahifasi (`/admin/groups/view`) o'z joyida —
 * uy vazifalari o'sha yerda beriladi va yangi guruh sahifasidan
 * havola bilan ochiladi.
 */
export default function AdminGroupsPage() {
  redirect("/admin/crm");
}
