import { redirect } from "next/navigation";
import { DEFAULT_EVENT_SLUG } from "@/lib/events";

export default function LegacyPhotographersPage() {
  redirect(`/events/${DEFAULT_EVENT_SLUG}/photographers`);
}
