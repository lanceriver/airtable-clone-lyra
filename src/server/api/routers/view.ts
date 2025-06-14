/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { Prisma } from "@prisma/client";

export interface ViewSort {
  columnId: string;
  order: "asc" | "desc";
  type?: "string" | "number"
}

export interface ViewFilter {
  columnId: string | undefined; // columnId can be undefined for global search
  operator: "contains" | "does not contain" | "is" | "is not" | "empty" | "is not empty" | "gt" | "lt" | "gte" | "lte";
  value?: string | number;
};

export const viewRouter = createTRPCRouter({
    createView: protectedProcedure
        .input(z.object({ name: z.string().min(1), tableId: z.string().min(1), filters: z.object({columnId: z.string().min(1), operator: z.enum(['contains', 'does not contain', 'is', 'is not', 'empty', 'is not empty']), 
                value: z.union([z.string().min(1), z.number()]).optional(),
            }).array().optional(), sort: z.object({ columnId: z.string().min(1), order: z.enum(['asc', 'desc']), type: z.enum(['string', 'number']) }).optional() }))
        .mutation(async ({ ctx, input}) => {
            const columns = await ctx.db.column.findMany({
                where: { tableId: input.tableId },
                select: { id: true }
            });
            const view = await ctx.db.view.create({
                data: {
                    name: input.name,
                    tableId: input.tableId,
                    filters: input.filters ?? undefined,
                    sort: input.sort ?? undefined,
                    visibleColumns: columns.map(column => column.id)
                }
            })
            if (!view) {
                throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to create view" });
            }
            return view;
        }),
    queryView: protectedProcedure
        .input(z.object({ id: z.string().min(1)}))
        .query(async ({ ctx, input}) => {
            const view = await ctx.db.view.findUnique({
                where: { id: input.id },
                select: {
                    id: true,
                    name: true,
                    filters: true,
                    sort: true,
                },
            });
            if (!view) {
                throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });
            }
            return view;
        }),
    getViews: protectedProcedure
        .input(z.object({ tableId: z.string().min(1)}))
        .query(async ({ ctx, input}) => {
            const views = await ctx.db.view.findMany({
                where: { tableId: input.tableId},
                orderBy: { createdAt: "asc" }
            })
            if (!views) {
                throw new TRPCError({ code: "NOT_FOUND", message: "No views found for this table" });
            }
            console.log("Fetched views:", views);
            return views.map(view => ({
                ...view,
                sort: view.sort ? (typeof view.sort === "string" ? JSON.parse(view.sort) : view.sort) as ViewSort: null,
                filters: view.filters ? (typeof view.filters === "string" ? JSON.parse(view.filters) : view.filters) as ViewFilter[] : null
            }));
        }),
    getActiveView: protectedProcedure
        .input(z.object({ tableId: z.string().min(1)}))
        .query(async ({ ctx, input}) => {
            const view = await ctx.db.table.findFirst({
                where: { id: input.tableId },
                select: {
                    activeViewId: true,
                    views: {
                        select: {
                            id: true,
                            name: true,
                            filters: true,
                            sort: true,
                            visibleColumns: true,
                        }
                    }
                }
            });
            if (!view?.activeViewId) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Active view not found for this table" });
            }
            // Find the active view from the fetched views
            const activeView = view.views.find(v => v.id === view.activeViewId);
            if (!activeView) {
                throw new TRPCError({ code: "NOT_FOUND", message: "Active view not found in views" });
            }
            return activeView;
        }),
    deleteView: protectedProcedure
        .input(z.object({ id: z.string().min(1)}))
        .mutation(async ({ ctx, input}) => {
            const deletedView = await ctx.db.view.delete({
                where: { id: input.id}
            })
            if (!deletedView) {
                throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });
            }
            return deletedView;
        }),
    updateView: protectedProcedure
        .input(z.object({ 
            id: z.string().min(1).nullish(), 
            name: z.string().min(1).optional(),
            filters: z.union([
                z.object({
                    columnId: z.string().optional(), 
                    operator: z.enum(['contains', 'does not contain', 'is', 'is not', 'empty', 'is not empty', 'gt', 'lt', 'gte', 'lte']).optional(),
                    value: z.union([z.string().min(1), z.number()]).optional(),
                }), 
                z.null()
            ]).array().optional(), 
            sort: z.union([z.object({ columnId: z.string().min(1), order: z.enum(['asc', 'desc']), type: z.enum(['number', 'string']) }), z.null()]).optional(),
            visibleColumns: z.array(z.string().min(1)).optional()
        }))
        .mutation(async ({ ctx, input}) => {
            console.log("Updating view with input:", input);

            const { name, filters, sort, visibleColumns } = input;
            
            /* const updateData = {
                name: name ?? undefined, 
                filters: filters ?? Prisma.JsonNull,
                sort: sort ?? Prisma.JsonNull
            }; */

            /* const updateData: any = {};
            updateData.name = input.name;
            updateData.filters = input.filters;
            updateData.sort = input.sort;
            console.log("Update data prepared:", updateData); */

            const updateData: Record<string, unknown> = {};
        
            if ('name' in input && input.name !== undefined) {
                updateData.name = input.name;
            }
        
            if ('filters' in input && input.filters !== undefined) {
                updateData.filters = input.filters ?? Prisma.JsonNull;
            }

            if (input.filters === undefined || input.filters === null) {
                updateData.filters = [];
            }
        
            if ('sort' in input && input.sort !== undefined) {
                updateData.sort = input.sort ?? Prisma.JsonNull;
            }

            if ('visibleColumns' in input && input.visibleColumns !== undefined || input.visibleColumns !== null) {
                updateData.visibleColumns = input.visibleColumns;
            }

            if (!input.id) {
                throw new TRPCError({ code: "BAD_REQUEST", message: "View id is required" });
            }
            const view = await ctx.db.view.update({
                where: { id: input.id },
                data: updateData
            });
            console.log("Updated view:", view);

            if (!view) {
                throw new TRPCError({ code: "NOT_FOUND", message: "View not found" });
            }
            return view;
        })
})