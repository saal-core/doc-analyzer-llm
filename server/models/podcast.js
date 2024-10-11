const prisma = require("../utils/prisma");

const Podcasts = {
  get: async function (clause = {}) {
    try {
      const podcasts = await prisma.podcasts.findMany({
        where: clause,
      });
      return podcasts;
    } catch (error) {
      console.error(error.message);
      return null;
    }
  },

  create: async function (newPodcastsParams) {
    try {
      const podcasts = await prisma.podcasts.create({
        data: newPodcastsParams,
      });
      return podcasts;
    } catch (error) {
      console.error(error.message);
      return null;
    }
  },

  delete: async function (clause = {}) {
    try {
      const result = await prisma.podcasts.deleteMany({ where: clause });
      return result;
    } catch (error) {
      console.error(error.message);
      return false;
    }
  },
};

module.exports = { Podcasts };
