import React, { useState, useMemo } from 'react';
import './IconPicker.css';

// Unicode Emoji 图标列表 - 无需任何外部库
const EMOJI_ICONS = [
  { emoji: '📁', name: '文件夹', keywords: 'folder wenjian' },
  { emoji: '📂', name: '打开文件夹', keywords: 'folder open dakai' },
  { emoji: '📋', name: '剪贴板', keywords: 'clipboard jianti' },
  { emoji: '📌', name: '图钉', keywords: 'pin tuding' },
  { emoji: '📍', name: '位置', keywords: 'location weizhi' },
  { emoji: '📎', name: '回形针', keywords: 'clip huixing' },
  { emoji: '📚', name: '书籍', keywords: 'books shuji' },
  { emoji: '📖', name: '打开的书', keywords: 'book open shu' },
  { emoji: '📝', name: '备忘录', keywords: 'memo beiwang' },
  { emoji: '📄', name: '文档', keywords: 'document wendang' },
  { emoji: '📃', name: '卷页', keywords: 'page juanye' },
  { emoji: '📑', name: '书签标签', keywords: 'bookmark shuqian' },
  { emoji: '🔖', name: '书签', keywords: 'bookmark shuqian' },
  { emoji: '⭐', name: '星星', keywords: 'star xingxing' },
  { emoji: '🌟', name: '闪亮星星', keywords: 'star shining shanliang' },
  { emoji: '✨', name: '火花', keywords: 'sparkles huohua' },
  { emoji: '💫', name: '眩晕', keywords: 'dizzy xuanyun' },
  { emoji: '🎯', name: '靶心', keywords: 'target baxin' },
  { emoji: '🎓', name: '学士帽', keywords: 'graduation xueshi' },
  { emoji: '🎨', name: '调色板', keywords: 'palette tiaoban' },
  { emoji: '🏆', name: '奖杯', keywords: 'trophy jiangbei' },
  { emoji: '🏅', name: '奖牌', keywords: 'medal jiangpai' },
  { emoji: '🎖️', name: '军功章', keywords: 'medal jungong' },
  { emoji: '💼', name: '公文包', keywords: 'briefcase gongwen' },
  { emoji: '💡', name: '灯泡', keywords: 'bulb dengpao idea' },
  { emoji: '🔍', name: '放大镜', keywords: 'search fangda' },
  { emoji: '🔎', name: '放大镜右', keywords: 'search fangda' },
  { emoji: '🔔', name: '铃铛', keywords: 'bell lingdang notification' },
  { emoji: '🔕', name: '静音铃铛', keywords: 'bell mute jingyin' },
  { emoji: '📢', name: '扩音器', keywords: 'loudspeaker kuoyin announcement' },
  { emoji: '📣', name: '喇叭', keywords: 'megaphone laba' },
  { emoji: '📡', name: '卫星天线', keywords: 'satellite weixing' },
  { emoji: '🎬', name: '场记板', keywords: 'movie changji' },
  { emoji: '🎥', name: '摄像机', keywords: 'camera shexiang' },
  { emoji: '📷', name: '相机', keywords: 'camera xiangji' },
  { emoji: '📸', name: '闪光相机', keywords: 'camera flash shanguang' },
  { emoji: '🖼️', name: '画框', keywords: 'frame huakuang' },
  { emoji: '🎵', name: '音符', keywords: 'music yinfu' },
  { emoji: '🎶', name: '音乐', keywords: 'music yinyue' },
  { emoji: '🎤', name: '麦克风', keywords: 'microphone maikefeng' },
  { emoji: '🎧', name: '耳机', keywords: 'headphones erji' },
  { emoji: '📻', name: '收音机', keywords: 'radio shouyinji' },
  { emoji: '🛒', name: '购物车', keywords: 'cart gouwu' },
  { emoji: '🛍️', name: '购物袋', keywords: 'shopping gouwu' },
  { emoji: '💰', name: '钱袋', keywords: 'money qiandai' },
  { emoji: '💵', name: '美元', keywords: 'dollar meiyuan' },
  { emoji: '💳', name: '信用卡', keywords: 'card xinyong' },
  { emoji: '🏪', name: '便利店', keywords: 'store bianli' },
  { emoji: '🏬', name: '百货商店', keywords: 'store baihuo' },
  { emoji: '🏢', name: '办公楼', keywords: 'office bangong' },
  { emoji: '🏛️', name: '古典建筑', keywords: 'building gudian' },
  { emoji: '🏠', name: '房屋', keywords: 'home fangwu' },
  { emoji: '🏡', name: '花园房屋', keywords: 'home garden huayuan' },
  { emoji: '🌍', name: '地球', keywords: 'earth diqiu world' },
  { emoji: '🌎', name: '地球美洲', keywords: 'earth americas diqiu' },
  { emoji: '🌏', name: '地球亚洲', keywords: 'earth asia diqiu' },
  { emoji: '🗺️', name: '世界地图', keywords: 'map shijie ditu' },
  { emoji: '🧭', name: '指南针', keywords: 'compass zhinan' },
  { emoji: '📍', name: '图钉', keywords: 'pin tuding location' },
  { emoji: '📆', name: '日历', keywords: 'calendar rili' },
  { emoji: '📅', name: '日期', keywords: 'date riqi' },
  { emoji: '🗓️', name: '螺旋日历', keywords: 'calendar luoxuan' },
  { emoji: '⏰', name: '闹钟', keywords: 'alarm naozhong' },
  { emoji: '⏱️', name: '秒表', keywords: 'stopwatch miaobiao' },
  { emoji: '⏲️', name: '计时器', keywords: 'timer jishiqi' },
  { emoji: '⌛', name: '沙漏', keywords: 'hourglass shalou' },
  { emoji: '⏳', name: '流沙漏', keywords: 'hourglass flowing liushalou' },
  { emoji: '🔒', name: '锁', keywords: 'lock suo' },
  { emoji: '🔓', name: '开锁', keywords: 'unlock kaisuo' },
  { emoji: '🔐', name: '钥匙锁', keywords: 'lock key yaoshi' },
  { emoji: '🔑', name: '钥匙', keywords: 'key yaoshi' },
  { emoji: '🗝️', name: '旧钥匙', keywords: 'key old jiu' },
  { emoji: '🛡️', name: '盾牌', keywords: 'shield dunpai security' },
  { emoji: '⚔️', name: '交叉剑', keywords: 'swords jiacha' },
  { emoji: '🔧', name: '扳手', keywords: 'wrench banshou settings' },
  { emoji: '🔨', name: '锤子', keywords: 'hammer chuizi' },
  { emoji: '⚙️', name: '齿轮', keywords: 'gear chilun settings' },
  { emoji: '🛠️', name: '工具', keywords: 'tools gongju' },
  { emoji: '⚗️', name: '蒸馏器', keywords: 'alembic zhengliuqi science' },
  { emoji: '🔬', name: '显微镜', keywords: 'microscope xianweijing science' },
  { emoji: '🔭', name: '望远镜', keywords: 'telescope wangyuanjing' },
  { emoji: '🧪', name: '试管', keywords: 'test tube shiguan science' },
  { emoji: '🧬', name: 'DNA', keywords: 'dna biology' },
  { emoji: '💬', name: '对话框', keywords: 'chat duihua' },
  { emoji: '💭', name: '思考泡泡', keywords: 'thought sikao' },
  { emoji: '🗨️', name: '左对话框', keywords: 'chat left zuo' },
  { emoji: '🗯️', name: '愤怒泡泡', keywords: 'angry fennu' },
  { emoji: '✉️', name: '信封', keywords: 'mail xinfeng email' },
  { emoji: '📧', name: '电子邮件', keywords: 'email dianzi youjian' },
  { emoji: '📨', name: '收件箱', keywords: 'inbox shoujian' },
  { emoji: '📩', name: '带箭头信封', keywords: 'mail arrow xinfeng' },
  { emoji: '👤', name: '人像', keywords: 'person renxiang user' },
  { emoji: '👥', name: '两个人', keywords: 'people liangren users' },
  { emoji: '👨‍👩‍👧‍👦', name: '家庭', keywords: 'family jiating group' },
  { emoji: '👨‍💼', name: '商务人士', keywords: 'business shangwu' },
  { emoji: '👩‍💼', name: '女商务人士', keywords: 'business woman shangwu' },
  { emoji: '🚩', name: '旗帜', keywords: 'flag qizhi' },
  { emoji: '🏁', name: '方格旗', keywords: 'checkered flag fangge' },
  { emoji: '🎌', name: '交叉旗帜', keywords: 'flags jiacha' },
  { emoji: '🏷️', name: '标签', keywords: 'label biaoqian tag' },
  { emoji: '🔗', name: '链接', keywords: 'link lianjie' },
  { emoji: '⛓️', name: '链条', keywords: 'chains liantiao' },
  { emoji: '📊', name: '柱状图', keywords: 'chart zhuzhuang analytics' },
  { emoji: '📈', name: '上升趋势', keywords: 'chart trending up shangsheng' },
  { emoji: '📉', name: '下降趋势', keywords: 'chart trending down xiajiang' },
  { emoji: '💹', name: '图表上升', keywords: 'chart rising shangsheng' },
  { emoji: '✅', name: '勾选', keywords: 'check gouxuan done' },
  { emoji: '✔️', name: '对勾', keywords: 'check duigou' },
  { emoji: '❌', name: '叉号', keywords: 'cross chahao cancel' },
  { emoji: '❎', name: '叉按钮', keywords: 'cross button chahao' },
  { emoji: '➕', name: '加号', keywords: 'plus jiahao add' },
  { emoji: '➖', name: '减号', keywords: 'minus jianhao' },
  { emoji: '✖️', name: '乘号', keywords: 'multiply chenghao' },
  { emoji: '➗', name: '除号', keywords: 'divide chuhao' },
  { emoji: '🔴', name: '红圆', keywords: 'red circle hong' },
  { emoji: '🟠', name: '橙圆', keywords: 'orange circle cheng' },
  { emoji: '🟡', name: '黄圆', keywords: 'yellow circle huang' },
  { emoji: '🟢', name: '绿圆', keywords: 'green circle lv' },
  { emoji: '🔵', name: '蓝圆', keywords: 'blue circle lan' },
  { emoji: '🟣', name: '紫圆', keywords: 'purple circle zi' },
  { emoji: '⚪', name: '白圆', keywords: 'white circle bai' },
  { emoji: '⚫', name: '黑圆', keywords: 'black circle hei' },
  { emoji: '🟤', name: '棕圆', keywords: 'brown circle zong' },
];

const IconPicker = ({ value, onChange, onClose }) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredIcons = useMemo(() => {
    if (!searchTerm) return EMOJI_ICONS;
    const term = searchTerm.toLowerCase();
    return EMOJI_ICONS.filter(icon =>
      icon.name.toLowerCase().includes(term) ||
      icon.keywords.toLowerCase().includes(term) ||
      icon.emoji.includes(searchTerm)
    );
  }, [searchTerm]);

  const handleIconClick = (emoji) => {
    onChange(emoji);
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
              key={icon.emoji}
              className={`icon-item ${value === icon.emoji ? 'selected' : ''}`}
              onClick={() => handleIconClick(icon.emoji)}
              title={icon.name}
            >
              <span className="emoji-icon">{icon.emoji}</span>
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

