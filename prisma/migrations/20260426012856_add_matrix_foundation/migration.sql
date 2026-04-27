-- AlterTable
ALTER TABLE "characters" ADD COLUMN     "activeNodeId" TEXT,
ADD COLUMN     "isJackedIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "matrix_nodes" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "securityLevel" INTEGER NOT NULL DEFAULT 1,
    "hostType" TEXT NOT NULL DEFAULT 'public',
    "roomId" TEXT NOT NULL,

    CONSTRAINT "matrix_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "matrix_nodes_slug_key" ON "matrix_nodes"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "matrix_nodes_roomId_key" ON "matrix_nodes"("roomId");

-- AddForeignKey
ALTER TABLE "characters" ADD CONSTRAINT "characters_activeNodeId_fkey" FOREIGN KEY ("activeNodeId") REFERENCES "matrix_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matrix_nodes" ADD CONSTRAINT "matrix_nodes_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
