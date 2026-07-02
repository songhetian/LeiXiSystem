import '@arco-design/web-react'

declare module '@arco-design/web-react' {
  interface ModalProps {
    children?: React.ReactNode
    width?: number | string
  }
}
