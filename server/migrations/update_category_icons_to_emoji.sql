-- SQL脚本：将分类管理中的Material Icons替换为Unicode Emoji图标
-- 这个脚本会将exam_categories表中的icon字段从Material Icons名称更新为对应的emoji

-- 更新常用的分类图标
UPDATE exam_categories SET icon = '📁' WHERE icon = 'folder' OR icon = 'folder_open' OR icon = 'folder_special' OR icon IS NULL OR icon = '';
UPDATE exam_categories SET icon = '📚' WHERE icon = 'library_books' OR icon = 'menu_book' OR icon = 'book';
UPDATE exam_categories SET icon = '📖' WHERE icon = 'auto_stories' OR icon = 'import_contacts';
UPDATE exam_categories SET icon = '📝' WHERE icon = 'article' OR icon = 'description';
UPDATE exam_categories SET icon = '📋' WHERE icon = 'assignment' OR icon = 'assignment_turned_in';
UPDATE exam_categories SET icon = '🔖' WHERE icon = 'bookmark' OR icon = 'bookmarks';
UPDATE exam_categories SET icon = '🏷️' WHERE icon = 'label' OR icon = 'label_important' OR icon = 'local_offer' OR icon = 'sell';
UPDATE exam_categories SET icon = '⭐' WHERE icon = 'star' OR icon = 'star_border';
UPDATE exam_categories SET icon = '🌟' WHERE icon = 'star_half';
UPDATE exam_categories SET icon = '💫' WHERE icon = 'grade' OR icon = 'workspace_premium';
UPDATE exam_categories SET icon = '🎓' WHERE icon = 'school' OR icon = 'class';
UPDATE exam_categories SET icon = '🎯' WHERE icon = 'subject' OR icon = 'topic';
UPDATE exam_categories SET icon = '📄' WHERE icon = 'quiz';
UPDATE exam_categories SET icon = '💼' WHERE icon = 'work' OR icon = 'work_outline' OR icon = 'business_center' OR icon = 'business';
UPDATE exam_categories SET icon = '🏢' WHERE icon = 'corporate_fare' OR icon = 'domain';
UPDATE exam_categories SET icon = '🏪' WHERE icon = 'store' OR icon = 'storefront';
UPDATE exam_categories SET icon = '📊' WHERE icon = 'dashboard' OR icon = 'dashboard_customize' OR icon = 'assessment' OR icon = 'analytics' OR icon = 'bar_chart' OR icon = 'pie_chart';
UPDATE exam_categories SET icon = '📈' WHERE icon = 'show_chart' OR icon = 'trending_up';
UPDATE exam_categories SET icon = '⚙️' WHERE icon = 'settings' OR icon = 'build';
UPDATE exam_categories SET icon = '🔧' WHERE icon = 'construction' OR icon = 'handyman';
UPDATE exam_categories SET icon = '🔬' WHERE icon = 'science' OR icon = 'biotech';
UPDATE exam_categories SET icon = '🛠️' WHERE icon = 'engineering';
UPDATE exam_categories SET icon = '💬' WHERE icon = 'chat' OR icon = 'forum' OR icon = 'comment';
UPDATE exam_categories SET icon = '✉️' WHERE icon = 'message' OR icon = 'mail';
UPDATE exam_categories SET icon = '🔔' WHERE icon = 'notifications';
UPDATE exam_categories SET icon = '📢' WHERE icon = 'campaign' OR icon = 'announcement';
UPDATE exam_categories SET icon = '📷' WHERE icon = 'image' OR icon = 'photo';
UPDATE exam_categories SET icon = '🖼️' WHERE icon = 'collections';
UPDATE exam_categories SET icon = '🎬' WHERE icon = 'video_library';
UPDATE exam_categories SET icon = '🎵' WHERE icon = 'music_note';
UPDATE exam_categories SET icon = '🎶' WHERE icon = 'audiotrack';
UPDATE exam_categories SET icon = '🎧' WHERE icon = 'headphones';
UPDATE exam_categories SET icon = '🛒' WHERE icon = 'shopping_cart' OR icon = 'shopping_bag' OR icon = 'local_mall';
UPDATE exam_categories SET icon = '📦' WHERE icon = 'inventory';
UPDATE exam_categories SET icon = '🧾' WHERE icon = 'receipt';
UPDATE exam_categories SET icon = '📍' WHERE icon = 'location_on' OR icon = 'place';
UPDATE exam_categories SET icon = '🗺️' WHERE icon = 'map' OR icon = 'explore';
UPDATE exam_categories SET icon = '🌍' WHERE icon = 'public' OR icon = 'language' OR icon = 'travel_explore';
UPDATE exam_categories SET icon = '📅' WHERE icon = 'event' OR icon = 'today' OR icon = 'calendar_month';
UPDATE exam_categories SET icon = '⏰' WHERE icon = 'schedule' OR icon = 'alarm';
UPDATE exam_categories SET icon = '⏱️' WHERE icon = 'timer';
UPDATE exam_categories SET icon = '⌛' WHERE icon = 'hourglass_empty';
UPDATE exam_categories SET icon = '🔒' WHERE icon = 'lock' OR icon = 'security';
UPDATE exam_categories SET icon = '🛡️' WHERE icon = 'verified_user' OR icon = 'admin_panel_settings' OR icon = 'shield' OR icon = 'gpp_good' OR icon = 'privacy_tip';
UPDATE exam_categories SET icon = '👤' WHERE icon = 'person' OR icon = 'account_circle' OR icon = 'face';
UPDATE exam_categories SET icon = '👥' WHERE icon = 'people' OR icon = 'group' OR icon = 'groups' OR icon = 'supervised_user_circle';
UPDATE exam_categories SET icon = '🏠' WHERE icon = 'home';
UPDATE exam_categories SET icon = '🧩' WHERE icon = 'apps' OR icon = 'widgets' OR icon = 'extension';
UPDATE exam_categories SET icon = '💡' WHERE icon = 'lightbulb' OR icon = 'emoji_objects' OR icon = 'tips_and_updates';
UPDATE exam_categories SET icon = '🚩' WHERE icon = 'flag';
UPDATE exam_categories SET icon = '📌' WHERE icon = 'push_pin';
UPDATE exam_categories SET icon = '📂' WHERE icon = 'create_new_folder';
UPDATE exam_categories SET icon = '🏷️' WHERE icon = 'category';

-- 查看更新后的结果
SELECT id, name, icon, code FROM exam_categories ORDER BY id;
