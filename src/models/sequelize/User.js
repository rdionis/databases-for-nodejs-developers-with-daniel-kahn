export default (sequelize, DataTypes) => {
  console.log("This is the user model");
  const User = sequelize.define("User", {
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false
    }
  });
  User.associate = (models) => {
    User.hasMany(models.Order, { foreignKey: "userId", as: "orders" });
  };

  return User;
};
