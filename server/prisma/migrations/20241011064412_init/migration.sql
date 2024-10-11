/*
  Warnings:

  - Made the column `threadId` on table `notes` required. This step will fail if there are existing NULL values in that column.
  - Made the column `workspaceId` on table `notes` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_notes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" TEXT NOT NULL,
    "chatId" INTEGER,
    "userId" INTEGER,
    "threadId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_notes" ("chatId", "createdAt", "id", "threadId", "userId", "workspaceId") SELECT "chatId", "createdAt", "id", "threadId", "userId", "workspaceId" FROM "notes";
DROP TABLE "notes";
ALTER TABLE "new_notes" RENAME TO "notes";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
