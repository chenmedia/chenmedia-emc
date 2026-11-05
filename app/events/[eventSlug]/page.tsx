import { notFound } from "next/navigation";
import EventPlanner from "@/components/event-planner";
import { isEditor } from "@/lib/auth";
import { getEventBySlug } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params;
  const [event, canEdit] = await Promise.all([getEventBySlug(eventSlug), isEditor()]);
  if (!event) notFound();
  return <EventPlanner event={event} canEdit={canEdit} />;
}
