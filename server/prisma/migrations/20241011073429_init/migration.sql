-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_notes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" TEXT,
    "chatId" INTEGER,
    "userId" INTEGER,
    "threadId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_notes" ("chatId", "createdAt", "id", "threadId", "userId", "workspaceId") SELECT "chatId", "createdAt", "id", "threadId", "userId", "workspaceId" FROM "notes";
DROP TABLE "notes";
ALTER TABLE "new_notes" RENAME TO "notes";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
