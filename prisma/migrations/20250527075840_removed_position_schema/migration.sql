/*
  Warnings:

  - You are about to drop the column `position` on the `Row` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Row_tableId_position_key";

-- AlterTable
ALTER TABLE "Row" DROP COLUMN "position";
