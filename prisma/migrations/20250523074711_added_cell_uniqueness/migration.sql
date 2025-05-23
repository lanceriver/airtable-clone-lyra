/*
  Warnings:

  - A unique constraint covering the columns `[rowId,columnId]` on the table `Cell` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Cell_rowId_columnId_key" ON "Cell"("rowId", "columnId");
