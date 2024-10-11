const { reqBody, userFromSession } = require("../utils/http");
const { Note } = require("../models/note");
function notesEndpoints(app) {
  if (!app) return;

  app.get("/notes", async (request, response) => {
    try {
      const { workspaceId, threadId } = request.query;
      const notes = await Note.getallnotes({
        threadId: threadId || null,
        workspaceId: workspaceId || null,
      });
      response.status(200).json(notes);
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
      const notes = await Note.delete({ id: id });
      response.status(200).json(notes);
    } catch (e) {
      console.error(e);
      response.sendStatus(500).end();
    }
  });
}

module.exports = { notesEndpoints };
