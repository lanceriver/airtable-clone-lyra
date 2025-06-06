
import { BaseNavbar } from "../_components/ui/BaseNavbar";
import  TableNavbar2  from "../_components/ui/TableNavbar2";
import { TableNavbar } from "../_components/ui/TableNavbar";
import { db } from "~/server/db";
import { auth } from "~/server/auth";




type Params = {
    baseId: string;
    tableName: string;
    tableId: string;
    seed: number;
}

export default async function BaseLayout({ children, params }: {children: React.ReactNode, params: {baseId: string}}) {

    const session = await auth();

    console.log("BaseLayout params:", params);
    const { baseId } = params;
    const base = await db.base.findFirst({
        where: {
            id: baseId
        }
    });
    const tables = await db.table.findMany({
        where: { baseId: baseId},
        orderBy: { createdAt: "asc"}
    });
    if (!base) {
        throw new Error("Base not found");
    }
    const tableCount = tables.length;
    return (
        <div>
            <BaseNavbar baseId={base.id} baseName={base.name} userName={session?.user?.name ?? ""} userImage={session?.user?.image ?? ""}>  
                <TableNavbar baseId={base.id} initialTables={tables} />
                {children}
            </BaseNavbar>

        </div>
    )
}
