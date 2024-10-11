const { reqBody, userFromSession } = require("../utils/http");
const { WorkspaceChats } = require("../models/workspaceChats");
const { Note } = require("../models/note");
function notesEndpoints(app) {
  if (!app) return;

  app.get("/notes", async (request, response) => {
    try {
      const { workspaceId, threadId } = request.query;
      console.log(workspaceId, threadId);
      const notes = await Note.get({
        threadId: threadId || null,
        workspaceId: workspaceId || null,
      });

      const userNotes = [];
      for (const note of notes) {
        let chat = await WorkspaceChats.getchatbyid({ id: note.chatId });
        chat = chat[0];
        chat.noteId = note.id;
        userNotes.push(chat);
      }

      response.status(200).json(userNotes);
    } catch (e) {
      console.error(e);
      response.sendStatus(500).end();
    }
  });

  app.post("/notes", async (request, response) => {
    try {
      const user = await userFromSession(request, response);
      let newNoteParams = reqBody(request);
      if (newNoteParams.threadId == 'null') {
        newNoteParams.threadId = "default";
      }
      newNoteParams.userId = user.id;
      const notes = await Note.create(newNoteParams);
      response.status(200).json(notes);
    } catch (e) {
      console.error(e);
      response.sendStatus(500).end(e.message);
    }
  });

  app.delete("/notes/:id", async (request, response) => {
    try {
      const { id } = request.params;
      const notes = await Note.delete({ id: Number(id) });
      response.status(200).json(notes);
    } catch (e) {
      console.error(e);
      response.sendStatus(500).end();
    }
  });
}

module.exports = { notesEndpoints };
