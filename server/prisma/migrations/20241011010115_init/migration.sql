/*
  Warnings:

  - You are about to drop the column `chat_id` on the `notes` table. All the data in the column will be lost.
  - You are about to drop the column `createdAtAt` on the `notes` table. All the data in the column will be lost.
  - You are about to alter the column `workspaceId` on the `notes` table. The data in that column could be lost. The data in that column will be cast from `String` to `Int`.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_notes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" INTEGER,
    "chatId" INTEGER,
    "userId" INTEGER,
    "threadId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_notes" ("id", "userId", "workspaceId") SELECT "id", "userId", "workspaceId" FROM "notes";
DROP TABLE "notes";
ALTER TABLE "new_notes" RENAME TO "notes";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
