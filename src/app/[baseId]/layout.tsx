import { notFound, redirect } from "next/navigation";

import { auth } from "~/server/auth";
import { db } from "~/server/db";
import { BaseHeader } from "../_components/base/BaseHeader";
import { BaseRail } from "../_components/base/BaseRail";
import { TableTabs } from "../_components/base/TableTabs";

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
    select: { id: true, name: true, color: true },
  });
  if (!base) notFound();

  const tables = await db.table.findMany({
    where: { baseId: base.id },
    select: { id: true, name: true, createdAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  return (
    <div className="flex h-screen overflow-hidden">
      <BaseRail
        userName={session.user.name ?? ""}
        userEmail={session.user.email}
        userImage={session.user.image}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <BaseHeader baseId={base.id} baseName={base.name} color={base.color} />
        <TableTabs baseId={base.id} initialTables={tables} color={base.color} />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
