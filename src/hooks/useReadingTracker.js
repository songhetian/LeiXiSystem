import { useEffect, useRef } from 'react'
import axios from 'axios'
import { getApiUrl } from '../utils/apiConfig'

export default function useReadingTracker({ articleId, isOpen, contentRef }) {
  const sessionIdRef = useRef(null)
  const lastHeartbeatAtRef = useRef(0)
  const activeAccumRef = useRef(0)
  const eventsRef = useRef({ wheel: 0, mousemove: 0, keydown: 0 })
  const scrollDepthRef = useRef(0)
  const activeTimerRef = useRef(null)
  const inactivityTimeoutRef = useRef(null)
  const isActiveRef = useRef(false)

  const getToken = () => {
    return localStorage.getItem('token') || localStorage.getItem('access_token') || ''
  }

  const authHeader = () => {
    const token = getToken()
    return token ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` } : {}
  }

  // Helper: start session
  const startSession = async () => {
    if (!articleId) return
    try {
      const res = await axios.post(getApiUrl(`/api/knowledge/articles/${articleId}/reading/start`), {}, { headers: authHeader() })
      sessionIdRef.current = res.data?.session_id || null
      lastHeartbeatAtRef.current = Date.now()
    } catch (e) {
      sessionIdRef.current = null
    }
  }

  // Helper: send heartbeat
  const sendHeartbeat = async () => {
    if (!sessionIdRef.current || !articleId) return
    const now = Date.now()
    const deltaSeconds = Math.round((now - lastHeartbeatAtRef.current) / 1000)
    lastHeartbeatAtRef.current = now
    try {
      await axios.put(getApiUrl(`/api/knowledge/articles/${articleId}/reading/heartbeat`), {
        session_id: sessionIdRef.current,
        active_delta: activeAccumRef.current,
        wheel: eventsRef.current.wheel,
        mousemove: eventsRef.current.mousemove,
        keydown: eventsRef.current.keydown,
        scroll_depth_percent: scrollDepthRef.current
      }, { headers: authHeader() })
      activeAccumRef.current = 0
      eventsRef.current = { wheel: 0, mousemove: 0, keydown: 0 }
    } catch (e) {
      // Best-effort: keep accumulators; end will merge
    }
  }

  // Helper: end session
  const endSession = async (closeType) => {
    if (!sessionIdRef.current || !articleId) return
    const url = getApiUrl(`/api/knowledge/articles/${articleId}/reading/end`)
    const body = JSON.stringify({ session_id: sessionIdRef.current, close_type: closeType || 'user_close' })
    const headers = Object.entries(authHeader()).map(([k, v]) => `${k}: ${v}`).join('\r\n')
    try {
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' })
        navigator.sendBeacon(url, blob)
      } else {
        await axios.put(url, JSON.parse(body), { headers: authHeader() })
      }
    } catch (e) {
      // swallow
    } finally {
      sessionIdRef.current = null
    }
  }

  // Update scroll depth percent based on contentRef scroll
  const updateScrollDepth = () => {
    const el = contentRef?.current
    if (!el) return
    const scrollTop = el.scrollTop
    const maxScroll = el.scrollHeight - el.clientHeight
    if (maxScroll <= 0) {
      scrollDepthRef.current = 100
      return
    }
    const percent = Math.min(100, Math.round((scrollTop / maxScroll) * 100))
    scrollDepthRef.current = Math.max(scrollDepthRef.current, percent)
  }

  // Mark active and reset inactivity timer
  const markActive = () => {
    isActiveRef.current = true
    clearTimeout(inactivityTimeoutRef.current)
    inactivityTimeoutRef.current = setTimeout(() => {
      isActiveRef.current = false
    }, 30000) // 30s inactivity threshold
  }

  useEffect(() => {
    if (!isOpen || !articleId) return

    startSession()

    const el = contentRef?.current
    const onWheel = () => { eventsRef.current.wheel += 1; markActive(); updateScrollDepth() }
    const onMouseMove = () => { eventsRef.current.mousemove += 1; markActive() }
    const onKeyDown = () => { eventsRef.current.keydown += 1; markActive() }
    const onScroll = () => { updateScrollDepth(); markActive() }
    const onVisibility = () => {
      // If hidden, do not accumulate active seconds
    }

    if (el) {
      el.addEventListener('wheel', onWheel)
      el.addEventListener('mousemove', onMouseMove)
      el.addEventListener('keydown', onKeyDown)
      el.addEventListener('scroll', onScroll)
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Accumulate active seconds every 1s
    activeTimerRef.current = setInterval(() => {
      if (document.visibilityState === 'visible' && isActiveRef.current) {
        activeAccumRef.current += 1
      }
    }, 1000)

    // Heartbeat every ~12s
    const hbTimer = setInterval(() => {
      sendHeartbeat()
    }, 12000)

    return () => {
      clearInterval(hbTimer)
      clearInterval(activeTimerRef.current)
      clearTimeout(inactivityTimeoutRef.current)
      if (el) {
        el.removeEventListener('wheel', onWheel)
        el.removeEventListener('mousemove', onMouseMove)
        el.removeEventListener('keydown', onKeyDown)
        el.removeEventListener('scroll', onScroll)
      }
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [isOpen, articleId])

  // End session on modal close or pagehide
  useEffect(() => {
    const onPageHide = () => endSession('auto_close')
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('beforeunload', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('beforeunload', onPageHide)
    }
  }, [])

  useEffect(() => {
    if (!isOpen && sessionIdRef.current) {
      endSession(document.visibilityState === 'hidden' ? 'tab_hidden' : 'user_close')
    }
  }, [isOpen])
}