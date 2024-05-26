const { Sequelize, DataTypes } = require('sequelize');

// Initialize a new Sequelize instance
const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: 'database.sqlite',
});

// Define the Wallet model
const Wallet = sequelize.define('Wallet', {
    address: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
    },
    privateKey: {
        type: DataTypes.TEXT,
        allowNull: false,
    },
});

// Synchronize the Wallet model with the database
sequelize.sync();

module.exports = { Wallet };
