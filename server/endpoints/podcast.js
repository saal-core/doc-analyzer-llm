const { reqBody } = require("../utils/http");
const { Podcasts } = require("../models/podcast");
const { WorkspaceChats } = require("../models/workspaceChats");
const { cli } = require("../utils/agents/aibitat/plugins/cli");
function podcastEndpoints(app) {
  if (!app) return;

  app.get("/podcasts", async (request, response) => {
    try {
      const podcasts = await Podcasts.get();
      response.status(200).json(podcasts);
    } catch (e) {
      console.error(e);
      response.sendStatus(500).end();
    }
  });

  app.get("/podcasts/workspace/:workspaceId", async (request, response) => {
    try {
      const { workspaceId } = request.params;
      const podcasts = await Podcasts.get({
        workspaceId: workspaceId,
      });
      const alist = [];
      for (const podcast of podcasts) {
        const chat = await WorkspaceChats.getchatbyid({ id: podcast.chatId });
        podcast.chat = chat[0];
        console.log(podcast);
        alist.push(podcast);
      }
      console.log(alist);
      response.status(200).json(alist);
    } catch (e) {
      console.error(e);
      response.sendStatus(500).end();
    }å
  });

  app.get(
    "/podcasts/workspace/:workspaceId/suggestions",
    async (request, response) => {
      try {
        const { workspaceId } = request.params;
        const podcasts = await Podcasts.get({
          workspaceId: workspaceId,
        });
        response.status(200).json(podcasts);
      } catch (e) {
        console.error(e);
        response.sendStatus(500).end();
      }
    }
  );

  app.post("/podcasts", async (request, response) => {
    try {
      const newPodcastsReq = reqBody(request);
      const podcasts = await Podcasts.create(newPodcastsReq);
      response.status(200).json(podcasts);
    } catch (e) {
      console.error(e);
      response.sendStatus(500).end(e.message);
    }
  });

  app.delete("/podcasts/:id", async (request, response) => {
    try {
      const { id } = request.params;
      const podcasts = await Podcasts.delete({ id: Number(id) });
      response.status(200).json(podcasts);
    } catch (e) {
      console.error(e);
      response.sendStatus(500).end();
    }
  });
}

module.exports = { podcastEndpoints };
