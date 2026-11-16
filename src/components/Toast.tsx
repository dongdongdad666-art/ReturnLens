interface ToastProps {
  message: string
}

export function Toast({ message }: ToastProps) {
  return <p className="toast" role="status" aria-live="polite">{message}</p>
}
