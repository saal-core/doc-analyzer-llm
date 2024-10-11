const prisma = require("../utils/prisma");

const Note = {
  get: async function () {
    try {
      const notes = await prisma.notes.findMany();
      return notes;
    } catch (error) {
      console.error(error.message);
      return null;
    }
  },

  create: async function (newNoteParams) {
    try {
      const user = await prisma.notes.create({
        data: newNoteParams,
      });
      return user;
    } catch (error) {
      console.error(error.message);
      return null;
    }
  },

  delete: async function (clause = {}) {
    try {
      const result = await prisma.notes.deleteMany({ where: clause });
      return result;
    } catch (error) {
      console.error(error.message);
      return false;
    }
  },

  getallnotes: async function (clause = {}) {
    try {
      const notes = await prisma.notes.findMany({
        where: clause,
        select: {
          chatId: true,
        },
      });
      const chatIds = notes.map((note) => note.chatId);

      const workspaceChats = await prisma.workspace_chats.findMany({
        where: {
          id: {
            in: chatIds,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return workspaceChats;
    } catch (error) {
      console.error(error.message);
      return null;
    }
  },
};

module.exports = { Note };
