"use client"

import { api } from "~/trpc/react"
import { CreateBaseForm } from "./CreateBase"
import { BaseCard } from "./BaseCard"
import type { Base } from "@prisma/client"

type Props = {
    initialBases: Base[];
}

export function HomeDashboard({ initialBases }: Props) {
const { data: bases, isLoading } = api.base.getBases.useQuery(undefined, {
    initialData: initialBases,
});


    return (
        <div className="bg-gray-50">
            <h1 className="text-3xl font-semibold px-8 py-10">
                Home
            </h1>
            <CreateBaseForm />
            <div className="grid grid-cols-6 py-10">
                {bases?.map((base) => (
                    <BaseCard key={base.id} baseId={base.id} baseName={base.name}></BaseCard>
                ))}
            </div>
        </div>
    )
}