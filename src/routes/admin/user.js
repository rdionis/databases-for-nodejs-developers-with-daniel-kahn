export default async function (fastify) {
  // GET /admin/user - Fetch and display a list of users
  fastify.get("/", async (request, reply) => {
    try {
      // Fetch users from the database
      const users = await fastify.models.User.findAll();
      // if we call without any arguments, it will just call all the users in the system

      return reply.view("admin/user.ejs", {
        title: "Manage Users",
        currentPath: "/admin/user",
        users
      });
    } catch (error) {
      request.log.error(error);
      request.session.set("messages", [
        { type: "danger", text: "Failed to fetch users." }
      ]);
      return reply.redirect("/admin/user");
    }
  });

  // POST /admin/user – Create or update a user
  fastify.post("/", async (request, reply) => {
    const { userId, email, password } = request.body;

    try {
      if (userId) {
        // Update existing user in the database
        const user = await fastify.models.User.findByPk(userId);
        if (!user) {
          request.session.set("messages", [
            { type: "danger", text: "Could not find user." }
          ]);
          return reply.redirect("/admin/user");
        }

        user.email = email;

        if (password) {
          await user.setPassword(password);
        }
        await user.save();

        request.session.set("messages", [
          { type: "success", text: "User updated successfully." }
        ]);
      } else {
        // Create a new user in the database
        await fastify.models.User.create({ email, password });
        request.session.set("messages", [
          { type: "success", text: "User created successfully." }
        ]);
      }
      return reply.redirect("/admin/user");
    } catch (error) {
      request.log.error(error);
      request.session.set("messages", [
        { type: "danger", text: "Failed to save user." }
      ]);
      return reply.redirect("/admin/user");
    }
  });

  // GET /admin/user/:id – Fetch a specific user for editing
  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params;

    try {
      // Fetch user by ID from the database
      const user = await fastify.models.User.findByPk(id);
      return reply.view("admin/user.ejs", {
        title: "Edit User",
        currentPath: "/admin/user",
        user,
        users: [] // Pass empty users array
      });
    } catch (error) {
      request.log.error(error);
      request.session.set("messages", [
        { type: "danger", text: "Failed to fetch user." }
      ]);
      return reply.redirect("/admin/user");
    }
  });

  // GET /admin/user/delete/:id – Delete a user
  fastify.get("/delete/:id", async (request, reply) => {
    const { id } = request.params;

    try {
      // Delete user from the database
      const user = await fastify.models.User.findByPk(id);
      if (!user) {
        request.session.set("messages", [
          { type: "danger", text: "Could not find user." }
        ]);
        return reply.redirect("/admin/user");
      }

      await user.destroy();

      request.session.set("messages", [
        { type: "success", text: "User deleted successfully." }
      ]);
      return reply.redirect("/admin/user");
    } catch (error) {
      request.log.error(error);
      request.session.set("messages", [
        { type: "danger", text: "Failed to delete user." }
      ]);
      return reply.redirect("/admin/user");
    }
  });

  // GET /admin/user/impersonate/:id – Impersonate a user
  fastify.get("/impersonate/:id", async (request, reply) => {
    const { id } = request.params;

    try {
      // Impersonate user by ID
      const user = await fastify.models.User.findByPk(id);
      if (!user) {
        request.session.set("messages", [
          { type: "danger", text: "Could not find user." }
        ]);
        return reply.redirect("/admin/user");
      }
      request.session.set("user", { id: user.id, email: user.email });

      request.session.set("messages", [
        {
          type: "success",
          text: `Impersonating user with the email: ${user.email}.`
        }
      ]);

      return reply.redirect("/"); // Redirect after impersonation
    } catch (error) {
      request.log.error(error);
      request.session.set("messages", [
        { type: "danger", text: "Failed to impersonate user." }
      ]);
      return reply.redirect("/admin/user");
    }
  });
}
