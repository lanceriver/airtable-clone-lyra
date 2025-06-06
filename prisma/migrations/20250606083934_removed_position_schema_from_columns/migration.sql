/*
  Warnings:

  - You are about to drop the column `position` on the `Column` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Column_tableId_position_key";

-- AlterTable
ALTER TABLE "Column" DROP COLUMN "position";
