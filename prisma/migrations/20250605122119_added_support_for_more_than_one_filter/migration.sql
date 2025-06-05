/*
  Warnings:

  - The `filters` column on the `views` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "views" DROP COLUMN "filters",
ADD COLUMN     "filters" JSONB[];
