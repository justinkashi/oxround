// Legacy route — superseded by /members/view?id=<id> (query-param route works in
// static export for the public demo). Kept as a redirect stub; generateStaticParams
// + dynamicParams=false make it a no-op under `output: "export"`.
import { redirect } from "next/navigation";

export const dynamicParams = false;
export async function generateStaticParams() {
  return [] as Array<{ id: string }>;
}

export default async function LegacyMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/members/view?id=${id}`);
}
