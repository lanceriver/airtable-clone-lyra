"use client";

import { use, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { api } from "~/trpc/react";
import { TableWorkspace } from "./TableWorkspace";

type Params = {
    baseId: string;
    tableId: string;
};

function Message({ children }: { children: React.ReactNode }) {
    return <div className="p-6 text-sm text-gray-500">{children}</div>;
}

export default function TablePage(props: { params: Promise<Params> }) {
    const { baseId, tableId } = use(props.params);
    const router = useRouter();
    const requestedViewId = useSearchParams().get("viewId");

    const tableQuery = api.table.get.useQuery({ tableId }, { retry: false });
    const viewQuery = api.view.get.useQuery(
        { viewId: requestedViewId ?? "" },
        { enabled: !!requestedViewId, retry: false },
    );

    const table = tableQuery.data;
    const view = viewQuery.data?.tableId === tableId ? viewQuery.data : undefined;

    const firstViewId = table?.views[0]?.id;
    const viewIsInvalid =
        !requestedViewId || viewQuery.isError || (!!viewQuery.data && !view);

    useEffect(() => {
        if (viewIsInvalid && firstViewId) {
            router.replace(`/${baseId}/${tableId}?viewId=${firstViewId}`);
        }
    }, [viewIsInvalid, firstViewId, baseId, tableId, router]);

    if (tableQuery.isError) {
        return <Message>This table could not be found.</Message>;
    }
    if (!table || !view) {
        return <Message>Loading...</Message>;
    }

    return (
        <TableWorkspace key={view.id} baseId={baseId} table={table} view={view} />
    );
}
