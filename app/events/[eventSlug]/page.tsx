import { notFound } from "next/navigation";
import EventPlanner from "@/components/event-planner";
import { getEventAccess } from "@/lib/event-access";
import { getEventBySlug } from "@/lib/events";

export const dynamic = "force-dynamic";

export default async function EventPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params;
  const event = await getEventBySlug(eventSlug);
  if (!event) notFound();
  const { canEdit } = await getEventAccess(event.eventKey);
  return <EventPlanner event={event} canEdit={canEdit} />;
}
