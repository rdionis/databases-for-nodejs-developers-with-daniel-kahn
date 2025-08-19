function requireLogin(req, reply) {
  if (!req.session.get("user")) {
    req.session.set("messages", [
      { type: "warning", text: "Please log in first." }
    ]);
    reply.redirect("/user/login");
    return false; // Prevent further execution
  }
  return true; // Allow execution to continue
}

// creating an unique hasher identifier that we'll use in redis, which will ne namespaced
function basketKey(req) {
  const user = req.session.get("user");
  if (!user) return null;
  return `mybasket:user:${user.id}:items`; //namespace
}

export default async function (fastify) {
  // Route to display basket contents
  fastify.get("/", async (req, reply) => {
    try {
      if (!requireLogin(req, reply)) return; // Stop execution if user is not logged in

      fastify.log.info("Fetching basket contents.");
      // Fetch basket contents from Redis

      const key = basketKey(req);
      const basket = await fastify.redis.hgetall(key); // returns all the basket items for a given key

      const items = await Promise.all(
        Object.entries(basket).map(async ([sku, quantity]) => {
          const item = await fastify.Item.findOne({ sku });
          return {
            sku,
            name: item ? item.name : "Unknown Item",
            price: item ? item.price : "N/A",
            quantity: parseInt(quantity, 10)
          };
        })
      );

      return reply.view("basket.ejs", {
        title: "Your Basket",
        currentPath: "/basket",
        items
      });
    } catch (error) {
      fastify.log.error("Error fetching basket contents:", error);
      req.session.set("messages", [
        { type: "danger", text: "Failed to load basket contents." }
      ]);
      return reply.redirect("/basket");
    }
  });

  // Route to add an item to the basket
  fastify.post("/add", async (req, reply) => {
    try {
      if (!requireLogin(req, reply)) return;

      const { sku, quantity } = req.body;
      fastify.log.info(`Adding item with SKU: ${sku}, quantity: ${quantity}`);

      // Add the item to the Redis basket

      const key = basketKey(req);
      await fastify.redis.hincrby(key, sku, parseInt(quantity, 10));

      req.session.set("messages", [
        {
          type: "success",
          text: `Item with SKU: ${sku} was added to the basket.`
        }
      ]);
      return reply.redirect(req.headers.referer || "/basket");
    } catch (error) {
      fastify.log.error("Error adding item to basket:", error);
      req.session.set("messages", [
        { type: "danger", text: "Failed to add item to the basket." }
      ]);
      return reply.redirect("/basket");
    }
  });

  // Route to remove an item from the basket
  fastify.post("/remove", async (req, reply) => {
    try {
      if (!requireLogin(req, reply)) return;

      const { sku } = req.body;
      fastify.log.info(`Removing item with SKU: ${sku}`);

      // Remove the item from the Redis basket

      const key = basketKey(req);
      await fastify.redis.hdel(key, sku);

      req.session.set("messages", [
        {
          type: "success",
          text: `Item with SKU: ${sku} was removed from the basket.`
        }
      ]);
      return reply.redirect(req.headers.referer || "/basket");
    } catch (error) {
      fastify.log.error("Error removing item from basket:", error);
      req.session.set("messages", [
        { type: "danger", text: "Failed to remove item from the basket." }
      ]);
      return reply.redirect("/basket");
    }
  });

  // Route to buy all items in the basket
  fastify.post("/buy", async (req, reply) => {
    try {
      if (!requireLogin(req, reply)) return;

      fastify.log.info("Processing basket purchase...");
      // Retrieve basket items from Redis and process purchase
      const key = basketKey(req);
      const basket = await fastify.redis.hgetall(key); // returns all the basket items for a given key
      console.log("key: ", key);
      console.log("basket: ", basket);

      const items = await Promise.all(
        Object.entries(basket).map(async ([sku, quantity]) => {
          const item = await fastify.Item.findOne({ sku });
          if (!item) throw new Error(`Could not find an item with SKU ${sku}`);
          return {
            sku,
            name: item.name,
            price: item.price,
            quantity: parseInt(quantity, 10)
          };
        })
      );
      console.log("items: ", items);
      // Clear the basket after successful purchase

      const sequelize = fastify.sequelize;
      await sequelize.transaction(async (transaction) => {
        const user = req.session.get("user");
        console.log("user inside sequelize transaction", user);
        const order = await fastify.models.Order.create(
          {
            userId: user.id,
            email: user.email,
            status: "Pending"
          },
          { transaction }
        );
        console.log("order inside sequelize transaction", order);

        for (const item of items) {
          console.log("OrderItem inside sequelize transaction", item);
          await fastify.models.OrderItem.create(
            {
              orderId: order.id,
              sku: item.sku,
              qty: item.quantity,
              name: item.name,
              price: item.price
            },
            { transaction }
          );
          console.log("finishing transaction"); // does not log
        }
        await fastify.redis.del(key);
        console.log("clearing out basket after purchase"); // does not log
      });

      req.session.set("messages", [
        {
          type: "success",
          text: "Thank you for your purchase! Your basket has been processed."
        }
      ]);
      console.error("was it a success?"); // does not log
      return reply.redirect("/");
    } catch (error) {
      console.log("falling inside the catch block"); // logs
      fastify.log.error("Error processing basket purchase:", error);
      req.session.set("messages", [
        { type: "danger", text: "Failed to process your purchase." }
      ]);
      return reply.redirect("/basket");
    }
  });

  // Route to clear the basket
  fastify.post("/clear", async (req, reply) => {
    try {
      if (!requireLogin(req, reply)) return;

      fastify.log.info("Clearing all items from the basket.");
      // Clear all basket items from Redis

      const key = basketKey(req);
      await fastify.redis.del(key);

      req.session.set("messages", [
        { type: "success", text: "Your basket has been cleared." }
      ]);
      return reply.redirect(req.headers.referer || "/basket");
    } catch (error) {
      fastify.log.error("Error clearing basket:", error);
      req.session.set("messages", [
        { type: "danger", text: "Failed to clear the basket." }
      ]);
      return reply.redirect("/basket");
    }
  });
}
