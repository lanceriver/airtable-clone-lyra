"use client";
import { Table } from "~/app/_components/ui/Table";
import { faker } from "@faker-js/faker";
import { generateFakeData } from "~/app/_components/ui/Table";
import { db } from "~/server/db";
import { use } from "react";

type Params = {
    baseId: string;
    tableName: string;
    tableId: string;
    seed: number;
};

export default function BasePage(props: { params: Promise<Params> }) {   
    const params = use(props.params);
    const seed = params.seed;
    const data = generateFakeData(5, seed);
    console.log(data);
    const { tableId } = params;
    return (
        <div>
            This table is for {tableId}
            <Table data={data} />
        </div>
    )
}