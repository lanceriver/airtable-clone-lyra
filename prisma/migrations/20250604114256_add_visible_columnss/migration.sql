/*
  Warnings:

  - You are about to drop the column `visibleColumnIds` on the `views` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "views" DROP COLUMN "visibleColumnIds",
ADD COLUMN     "visibleColumns" TEXT[];
