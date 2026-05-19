import { redirect } from "next/navigation";

/** Deploy is integrated into the composer workflow. */
export default async function DeployPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const params = await searchParams;
  const q = params.template
    ? `?template=${encodeURIComponent(params.template)}`
    : "";
  redirect(`/${q}`);
}
