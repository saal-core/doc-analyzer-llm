const { reqBody } = require("../utils/http");
const { Note } = require("../models/note");
function notesEndpoints(app) {
  if (!app) return;

  app.get("/notes", async (request, response) => {
    try {
      const notes = await Note.get();
      response.status(200).json(notes);
    } catch (e) {
      console.error(e);
      response.sendStatus(500).end();
    }
  });

  app.get("/notes/thread/:threadId", async (request, response) => {
    try {
      const { threadId } = request.params;
      const notes = await Note.getallnotes({ threadId: Number(threadId) });
      response.status(200).json(notes);
    } catch (e) {
      console.error(e);
      response.sendStatus(500).end();
    }
  });

  app.post("/notes", async (request, response) => {
    try {
      const newNoteParams = reqBody(request);
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
