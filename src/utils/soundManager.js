import logger from '@/utils/logger';
/**
 * 声音管理器
 * 使用Web Audio API生成通知提示音，无需外部音频文件
 */
class SoundManager {
  constructor() {
    this.enabled = localStorage.getItem('notificationSoundEnabled') !== 'false'
    this.volume = parseFloat(localStorage.getItem('notificationVolume') || '0.5')
    this.audioContext = null
  }

  /**
   * 初始化AudioContext（需要用户交互后才能创建）
   */
  init() {
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      } catch (e) {
        logger.warn('Web Audio API不支持:', e)
      }
    }
  }

  /**
   * 播放通知提示音（类似微信的"叮"声）
   */
  playNotification() {
    if (!this.enabled || !this.audioContext) {
      return
    }

    try {
      const ctx = this.audioContext
      const now = ctx.currentTime

      // 创建振荡器（生成音调）
      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      // 连接节点
      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      // 设置音调（类似微信的清脆声音）
      oscillator.type = 'sine' // 正弦波，声音更柔和
      oscillator.frequency.setValueAtTime(800, now) // 起始频率 800Hz
      oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.1) // 下降到 600Hz

      // 设置音量包络（淡入淡出）
      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(this.volume, now + 0.01) // 快速淡入
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3) // 淡出

      // 播放
      oscillator.start(now)
      oscillator.stop(now + 0.3)
    } catch (e) {
      logger.error('播放声音失败:', e)
    }
  }

  /**
   * 播放成功提示音（双音调）
   */
  playSuccess() {
    if (!this.enabled || !this.audioContext) {
      return
    }

    try {
      const ctx = this.audioContext
      const now = ctx.currentTime

      // 第一个音
      this.createBeep(600, now, 0.1)
      // 第二个音（稍高）
      this.createBeep(800, now + 0.12, 0.1)
    } catch (e) {
      logger.error('播放成功音失败:', e)
    }
  }

  /**
   * 播放警告提示音（低沉）
   */
  playWarning() {
    if (!this.enabled || !this.audioContext) {
      return
    }

    try {
      const ctx = this.audioContext
      const now = ctx.currentTime

      const oscillator = ctx.createOscillator()
      const gainNode = ctx.createGain()

      oscillator.connect(gainNode)
      gainNode.connect(ctx.destination)

      oscillator.type = 'triangle' // 三角波，声音更尖锐
      oscillator.frequency.setValueAtTime(400, now)
      oscillator.frequency.exponentialRampToValueAtTime(300, now + 0.2)

      gainNode.gain.setValueAtTime(0, now)
      gainNode.gain.linearRampToValueAtTime(this.volume * 0.8, now + 0.01)
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4)

      oscillator.start(now)
      oscillator.stop(now + 0.4)
    } catch (e) {
      logger.error('播放警告音失败:', e)
    }
  }

  /**
   * 创建单个beep音
   */
  createBeep(frequency, startTime, duration) {
    const ctx = this.audioContext
    const oscillator = ctx.createOscillator()
    const gainNode = ctx.createGain()

    oscillator.connect(gainNode)
    gainNode.connect(ctx.destination)

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(frequency, startTime)

    gainNode.gain.setValueAtTime(0, startTime)
    gainNode.gain.linearRampToValueAtTime(this.volume * 0.6, startTime + 0.01)
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration)

    oscillator.start(startTime)
    oscillator.stop(startTime + duration)
  }

  /**
   * 设置是否启用声音
   */
  setEnabled(enabled) {
    this.enabled = enabled
    localStorage.setItem('notificationSoundEnabled', enabled.toString())
  }

  /**
   * 设置音量（0-1）
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume))
    localStorage.setItem('notificationVolume', this.volume.toString())
  }

  /**
   * 获取是否启用
   */
  isEnabled() {
    return this.enabled
  }

  /**
   * 获取音量
   */
  getVolume() {
    return this.volume
  }
}

// 创建单例实例
export const soundManager = new SoundManager()

// 导出类供测试使用
export { SoundManager }
