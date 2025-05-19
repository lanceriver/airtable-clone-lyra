import { z } from "zod";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "~/server/api/trpc";

export const baseRouter = createTRPCRouter({
    // Creates a new base for the user with the given name
    createBase: protectedProcedure
        .input(z.object({ name: z.string().min(1)}))
        .mutation(async ({ ctx, input }) => {
            return ctx.db.base.create({
                data: {
                    name: input.name,
                    ownerId: ctx.session.user.id,
                    createdAt: new Date(),
                },
            });
        }),
        // Get all created bases by the current user
    getBases: protectedProcedure
        .query(async ({ ctx }) => {
            return ctx.db.base.findMany({
                where: { ownerId: ctx.session.user.id}
            })
        }),
        // Delete a base by id
    deleteBase: protectedProcedure
        .input(z.object({ baseId: z.string().min(1)}))
        .mutation(async ({ ctx, input }) => {
            return ctx.db.base.delete({
                where: { id: input.baseId}
            })
        })
});