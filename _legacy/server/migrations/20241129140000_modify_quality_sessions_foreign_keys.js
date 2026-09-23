// Migration to modify quality_sessions table to use foreign keys for platform and shop
module.exports = {
  async up(queryInterface, Sequelize) {
    // First, we need to add the new columns
    await queryInterface.addColumn('quality_sessions', 'platform_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'platforms',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addColumn('quality_sessions', 'shop_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'shops',
        key: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Then populate the new columns with data from the old varchar columns
    // This would require custom logic to map platform/shop names to IDs
    // For now, we'll leave this to be handled separately

    // Finally, we'll remove the old columns in a separate migration
    // await queryInterface.removeColumn('quality_sessions', 'platform');
    // await queryInterface.removeColumn('quality_sessions', 'shop');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('quality_sessions', 'platform_id');
    await queryInterface.removeColumn('quality_sessions', 'shop_id');
  }
};
