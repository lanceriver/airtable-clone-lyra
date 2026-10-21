import { notFound, redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";

export default async function BasePage({
  params,
}: {
  params: Promise<{ baseId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const { baseId } = await params;
  const table = await db.table.findFirst({
    where: { baseId, base: { ownerId: session.user.id } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      views: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!table) notFound();

  const viewId = table.views[0]?.id;
  redirect(`/${baseId}/${table.id}${viewId ? `?viewId=${viewId}` : ""}`);
}
