"use client"

import { api, type RouterOutputs } from "~/trpc/react"
import { BaseCard } from "./BaseCard"
import { HomeSidebar } from "./HomeSidebar"


type Props = {
    initialBases: RouterOutputs["base"]["list"];
}

export function HomeDashboard({ initialBases }: Props) {
    const { data: bases } = api.base.list.useQuery(undefined, {
        initialData: initialBases,
    });

    return (
        <div className="flex h-screen">
            <HomeSidebar />
            <main className="flex-1 overflow-auto bg-gray-50">
                <div className="max-w-7xl mx-12">
                    <h1 className="text-3xl font-semibold py-10">
                        Home
                    </h1>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {bases.map((base) => (
                            <BaseCard
                                key={base.id}
                                baseId={base.id}
                                baseName={base.name}
                                firstTableId={base.firstTableId}
                                firstViewId={base.firstViewId}
                            />
                        ))}
                    </div>
                </div>
            </main>
        </div>
    )
}
