import React, { useState, useMemo } from 'react';
import './IconPicker.css';

// Material Design Icons 列表
const MATERIAL_ICONS = [
  'folder', 'folder_open', 'folder_special', 'create_new_folder',
  'category', 'label', 'label_important', 'bookmark', 'bookmarks',
  'star', 'star_border', 'star_half', 'favorite', 'favorite_border',
  'grade', 'workspace_premium',
  'class', 'school', 'menu_book', 'book', 'library_books',
  'auto_stories', 'import_contacts', 'article', 'description',
  'subject', 'topic', 'quiz', 'assignment', 'assignment_turned_in',
  'work', 'work_outline', 'business_center', 'business',
  'corporate_fare', 'domain', 'store', 'storefront',
  'dashboard', 'dashboard_customize', 'assessment', 'analytics',
  'bar_chart', 'pie_chart', 'show_chart', 'trending_up',
  'settings', 'build', 'construction', 'handyman',
  'engineering', 'science', 'biotech',
  'chat', 'forum', 'comment', 'message', 'mail',
  'notifications', 'campaign', 'announcement',
  'image', 'photo', 'collections', 'video_library',
  'music_note', 'audiotrack', 'headphones',
  'shopping_cart', 'shopping_bag', 'local_mall',
  'inventory', 'receipt',
  'location_on', 'place', 'map', 'explore',
  'public', 'language', 'travel_explore',
  'event', 'today', 'calendar_month', 'schedule',
  'alarm', 'timer', 'hourglass_empty',
  'lock', 'security', 'verified_user', 'admin_panel_settings',
  'shield', 'gpp_good', 'privacy_tip',
  'person', 'people', 'group', 'groups',
  'account_circle', 'supervised_user_circle', 'face',
  'home', 'apps', 'widgets', 'extension',
  'lightbulb', 'emoji_objects', 'tips_and_updates',
  'flag', 'push_pin', 'sell', 'local_offer',
];

const IconPicker = ({ value, onChange, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIcons = useMemo(() => {
    if (!searchTerm) return MATERIAL_ICONS;
    return MATERIAL_ICONS.filter(icon =>
      icon.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);

  const handleIconClick = (icon) => {
    onChange(icon);
    if (onClose) onClose();
  };

  return (
    <div className="icon-picker-overlay" onClick={onClose}>
      <div className="icon-picker-modal" onClick={(e) => e.stopPropagation()}>
        <div className="icon-picker-header">
          <h3>选择图标</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="icon-picker-search">
          <input
            type="text"
            placeholder="搜索图标..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>

        <div className="icon-picker-grid">
          {filteredIcons.map((icon) => (
            <div
              key={icon}
              className={`icon-item ${value === icon ? 'selected' : ''}`}
              onClick={() => handleIconClick(icon)}
              title={icon}
            >
              <span className="material-icons">{icon}</span>
            </div>
          ))}
        </div>

        {filteredIcons.length === 0 && (
          <div className="no-results">
            <p>未找到匹配的图标</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default IconPicker;
