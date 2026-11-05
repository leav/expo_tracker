import { redirect } from "next/navigation";

export default async function SeriesRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/cons/${id}`);
}
