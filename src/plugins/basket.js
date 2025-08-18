import fp from "fastify-plugin";

async function basketPlugin(fastify) {
  fastify.addHook("preHandler", async (req, reply) => {
    const user = req.session.get("user");
    if (!user) return null;
    const key = `mybasket:user:${user.id}:items`; //namespace

    // fetching all the basket items for this user
    const basketItems = await fastify.redis.hgetall(key);
    const basketCount = Object.values(basketItems).reduce(
      (total, quantity) => total + parseInt(quantity, 10),
      0
    );

    // everything in reply.locals is available in templates
    reply.locals = {
      ...(reply.locals || {}),
      basketCount
    };
  });
}

export default fp(basketPlugin, { name: "basket-plugin" });
// fp is a function from fastify that makes the contents of the plugin available throughout the application
