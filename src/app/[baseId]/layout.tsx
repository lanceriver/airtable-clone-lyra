
import { BaseNavbar } from "../_components/ui/BaseNavbar";
import { BaseSidebar } from "../_components/ui/BaseSidebar";
import  TableNavbar2  from "../_components/ui/TableNavbar2";
import { db } from "~/server/db";


type Params = {
    baseId: string;
    tableName: string;
    tableId: string;
    seed: number;
}

export default async function BaseLayout({ children, params }: {children: React.ReactNode, params: Params}) {
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
    const initialTableCount = base.tableCount;
    const tableCount = tables.length;
    return (
        <div>
            <BaseNavbar baseId={base.id} baseName={base.name} />
                <TableNavbar2 baseId={baseId} initialTables={tables} tableCount={tableCount}>
                    {children}
                </TableNavbar2>
        </div>
    )
}
