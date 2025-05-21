import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper
} from "@tanstack/react-table";
import type { ColumnDef } from "@tanstack/react-table";
import { faker } from "@faker-js/faker";

type DefaultTableData = {
    firstName: string;
    lastName: string;
    number: Number;
    email: string;
}

export function generateFakeData(count: number, seed: number): DefaultTableData[] {
  faker.seed(seed);
  return Array.from({ length: count }, () => ({
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    number: faker.number.int({ min: 0, max: 10000}),
    email: faker.internet.email(),
  }));
}

const columnHelper = createColumnHelper<DefaultTableData>();

const columns = [
  columnHelper.accessor("firstName", {
    header: () => <span>First Name</span>,
    cell: info => info.getValue(),
  }),
  columnHelper.accessor("lastName", {
    header: () => <span>Last Name</span>,
    cell: info => info.getValue(),
  }),
  columnHelper.accessor("number", {
    header: () => <span>Number</span>,
    cell: info => info.getValue(),
  }),
  columnHelper.accessor("email", {
    header: () => <span>Email</span>,
    cell: info => info.getValue(),
  }),
]

export function Table(props: { data: DefaultTableData[] }) {
  const { data } = props;
  const table = useReactTable({
    data,
    columns: columns as ColumnDef<typeof data[number], any>[],
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <table className="min-w-full border">
      <thead>
        {table.getHeaderGroups().map(headerGroup => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <th key={header.id} className="border px-2 py-1 bg-gray-100">
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="text-center py-4 text-gray-400">
              No data
            </td>
          </tr>
        ) : (
          table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td key={cell.id} className="border px-2 py-1">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}