// Material Design Icons 图标库
// 用于分类管理的随机图标分配

const MATERIAL_ICONS = [
  // 文件夹和分类
  'folder', 'folder_open', 'folder_special', 'create_new_folder',
  'category', 'label', 'label_important', 'bookmark', 'bookmarks',

  // 星标和评分
  'star', 'star_border', 'star_half', 'favorite', 'favorite_border',
  'grade', 'workspace_premium',

  // 教育和学习
  'class', 'school', 'menu_book', 'book', 'library_books',
  'auto_stories', 'import_contacts', 'article', 'description',
  'subject', 'topic', 'quiz', 'assignment', 'assignment_turned_in',

  // 工作和业务
  'work', 'work_outline', 'business_center', 'business',
  'corporate_fare', 'domain', 'store', 'storefront',

  // 仪表板和分析
  'dashboard', 'dashboard_customize', 'assessment', 'analytics',
  'bar_chart', 'pie_chart', 'show_chart', 'trending_up',

  // 设置和工具
  'settings', 'build', 'construction', 'handyman',
  'engineering', 'science', 'biotech',

  // 通信和社交
  'chat', 'forum', 'comment', 'message', 'mail',
  'notifications', 'campaign', 'announcement',

  // 媒体和内容
  'image', 'photo', 'collections', 'video_library',
  'music_note', 'audiotrack', 'headphones',

  // 购物和商务
  'shopping_cart', 'shopping_bag', 'local_mall',
  'store', 'storefront', 'inventory', 'receipt',

  // 位置和地图
  'location_on', 'place', 'map', 'explore',
  'public', 'language', 'travel_explore',

  // 时间和日历
  'event', 'today', 'calendar_month', 'schedule',
  'alarm', 'timer', 'hourglass_empty',

  // 安全和隐私
  'lock', 'security', 'verified_user', 'admin_panel_settings',
  'shield', 'gpp_good', 'privacy_tip',

  // 用户和团队
  'person', 'people', 'group', 'groups',
  'account_circle', 'supervised_user_circle', 'face',

  // 其他常用
  'home', 'apps', 'widgets', 'extension',
  'lightbulb', 'emoji_objects', 'tips_and_updates',
  'flag', 'push_pin', 'sell', 'local_offer',
];

/**
 * 获取随机图标
 * @returns {string} 随机选择的图标名称
 */
function getRandomIcon() {
  return MATERIAL_ICONS[Math.floor(Math.random() * MATERIAL_ICONS.length)];
}

/**
 * 获取所有可用图标
 * @returns {string[]} 所有图标名称数组
 */
function getAllIcons() {
  return [...MATERIAL_ICONS];
}

/**
 * 搜索图标
 * @param {string} keyword - 搜索关键词
 * @returns {string[]} 匹配的图标名称数组
 */
function searchIcons(keyword) {
  if (!keyword) return getAllIcons();
  const lowerKeyword = keyword.toLowerCase();
  return MATERIAL_ICONS.filter(icon => icon.includes(lowerKeyword));
}

/**
 * 验证图标是否存在
 * @param {string} iconName - 图标名称
 * @returns {boolean} 是否存在
 */
function isValidIcon(iconName) {
  return MATERIAL_ICONS.includes(iconName);
}

module.exports = {
  MATERIAL_ICONS,
  getRandomIcon,
  getAllIcons,
  searchIcons,
  isValidIcon,
};
