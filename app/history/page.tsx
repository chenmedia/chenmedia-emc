import { redirect } from "next/navigation";
import { DEFAULT_EVENT_SLUG } from "@/lib/events";

export default function LegacyHistoryPage() {
  redirect(`/events/${DEFAULT_EVENT_SLUG}/history`);
}
