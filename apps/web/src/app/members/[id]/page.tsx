// Legacy route — superseded by /members/view?id=<id>.
import { redirect } from "next/navigation";

export const dynamicParams = false;
export async function generateStaticParams() {
  return [] as Array<{ id: string }>;
}

export default async function LegacyMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/members/view?id=${id}`);
}
