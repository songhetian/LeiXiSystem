// Migration to remove old platform and shop varchar columns from quality_sessions table
module.exports = {
  async up(queryInterface, Sequelize) {
    // Remove the old columns
    await queryInterface.removeColumn('quality_sessions', 'platform');
    await queryInterface.removeColumn('quality_sessions', 'shop');
  },

  async down(queryInterface, Sequelize) {
    // Add back the old columns if we need to rollback
    await queryInterface.addColumn('quality_sessions', 'platform', {
      type: Sequelize.STRING(255),
      allowNull: false,
      comment: '平台来源'
    });

    await queryInterface.addColumn('quality_sessions', 'shop', {
      type: Sequelize.STRING(255),
      allowNull: false,
      comment: '店铺名称'
    });
  }
};
