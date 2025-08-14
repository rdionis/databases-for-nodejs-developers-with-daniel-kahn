import fp from "fastify-plugin";
import { Sequelize } from "sequelize";
import { readdir } from "fs/promises";
import path from "path";

async function sequelizePlugin(fastify, config) {
  let mysqlStatus = "disconnected";

  // Connect to MySQL via Sequelize and update the status
  try {
    const sequelize = new Sequelize(config.uri, config.options);
    await sequelize.authenticate();
    fastify.log.info("Connected to MySQL");
    mysqlStatus = "connected";
    fastify.decorate("sequelize", sequelize);

    // Deal with models

    const models = {};
    const modelsPath = path.resolve("src/models/sequelize");
    const modelFiles = await readdir(modelsPath);

    console.log("Model Path:", modelsPath);
    console.log("Model Files:", modelFiles);

    for (const file of modelFiles) {
      if (file.endsWith(".js")) {
        const model = (await import(path.join(modelsPath, file))).default(
          sequelize,
          Sequelize.DataTypes
        );
        models[model.name] = model;
        fastify.log.info(`Sequelize model ${model.name} loaded`);
        console.log("The model is:", model);
      }
    }
    Object.values(models).forEach((model) => {
      if (model.associate) {
        model.associate(models);
        console.log("MODEL ASSOCIATE", model.associate);
        console.log("LADIDA MODEL", model);
      }
    });
    console.log("Line before AWAIT");
    await sequelize.sync({ alter: false });
    fastify.log.info("Sequelize models synced successfully");
  } catch (err) {
    fastify.log.error("Failed to connect to MySQL " + err);
    throw err;
  }
  fastify.decorate("mysqlStatus", () => mysqlStatus);

  // Graceful shutdown
  fastify.addHook("onClose", async (fastifyInstance, done) => {
    mysqlStatus = "disconnected";
    const sequelize = new Sequelize(config.uri, config.options);
    await sequelize.close();
    // Close Sequelize connection
    done();
  });
}
console.log("sequelize.js is read until the end");
export default fp(sequelizePlugin, { name: "sequelize-plugin" });
