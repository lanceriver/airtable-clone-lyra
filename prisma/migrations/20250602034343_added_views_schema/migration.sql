-- CreateTable
CREATE TABLE "views" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "columnIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "filters" JSONB,
    "sort" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ViewColumns" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ViewColumns_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "views_tableId_name_key" ON "views"("tableId", "name");

-- CreateIndex
CREATE INDEX "_ViewColumns_B_index" ON "_ViewColumns"("B");

-- AddForeignKey
ALTER TABLE "views" ADD CONSTRAINT "views_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "Table"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ViewColumns" ADD CONSTRAINT "_ViewColumns_A_fkey" FOREIGN KEY ("A") REFERENCES "Column"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ViewColumns" ADD CONSTRAINT "_ViewColumns_B_fkey" FOREIGN KEY ("B") REFERENCES "views"("id") ON DELETE CASCADE ON UPDATE CASCADE;
