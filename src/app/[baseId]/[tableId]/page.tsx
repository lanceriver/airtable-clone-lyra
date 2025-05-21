"use client";
import { use } from "react";
import { Table } from "~/app/_components/ui/Table";
import { faker } from "@faker-js/faker";
import { generateFakeData } from "~/app/_components/ui/Table";
import { db } from "~/server/db";

export default function BasePage({params} : {params: {tableName: string, tableId: string, seed: number}}) {   
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