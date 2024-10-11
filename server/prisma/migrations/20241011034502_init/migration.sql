-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_podcasts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "workspaceId" TEXT NOT NULL,
    "podcastName" TEXT NOT NULL,
    "podcastQuery" TEXT NOT NULL DEFAULT 'query',
    "content" TEXT NOT NULL,
    "userId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_podcasts" ("content", "createdAt", "id", "podcastName", "userId", "workspaceId") SELECT "content", "createdAt", "id", "podcastName", "userId", "workspaceId" FROM "podcasts";
DROP TABLE "podcasts";
ALTER TABLE "new_podcasts" RENAME TO "podcasts";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
