import { baseRouter } from "~/server/api/routers/base";
import { tableRouter } from "~/server/api/routers/table";
import { columnRouter } from "./routers/column";
import { rowRouter } from "./routers/row";
import { cellRouter } from "./routers/cell";
import { viewRouter } from "./routers/view";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { O } from "node_modules/@faker-js/faker/dist/airline-BUL6NtOJ";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  base: baseRouter,
  table: tableRouter,
  column: columnRouter,
  row: rowRouter,
  cell: cellRouter,
  view: viewRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
