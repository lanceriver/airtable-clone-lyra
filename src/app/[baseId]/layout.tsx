import { notFound, redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { BaseNavbar } from "../_components/ui/BaseNavbar";
import { TableNavbar } from "../_components/ui/TableNavbar";

export default async function BaseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ baseId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/");

  const { baseId } = await params;
  const base = await db.base.findFirst({
    where: { id: baseId, ownerId: session.user.id },
    select: { id: true, name: true },
  });
  if (!base) notFound();

  const tables = await db.table.findMany({
    where: { baseId: base.id },
    select: { id: true, name: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return (
    <div>
      <BaseNavbar
        baseId={base.id}
        baseName={base.name}
        userName={session.user.name ?? ""}
        userImage={session.user.image ?? ""}
      >
        <TableNavbar baseId={base.id} initialTables={tables} />
        {children}
      </BaseNavbar>
    </div>
  );
}
