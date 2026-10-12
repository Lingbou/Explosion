import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('React ErrorBoundary caught an unhandled error:', error, errorInfo)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#fbfbfa] dark:bg-[#141413] p-8 text-stone-800 dark:text-stone-200 select-none font-sans">
          <div className="max-w-md w-full bg-white dark:bg-[#1f1e1c] border border-stone-200 dark:border-stone-800 rounded-xl p-6 shadow-xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-center justify-center mx-auto text-rose-600 dark:text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">界面遇到异常</h2>
              <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
                渲染组件遇到未捕获的错误。已保护工作区并避免白屏崩溃。
              </p>
            </div>

            {this.state.error && (
              <pre className="p-3 bg-stone-50 dark:bg-[#141413] border border-stone-200 dark:border-stone-800 rounded-lg text-[11px] font-mono text-left text-rose-700 dark:text-rose-400 overflow-x-auto max-h-32 whitespace-pre-wrap">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}

            <button
              onClick={this.handleReset}
              className="w-full py-2 px-4 rounded-lg bg-stone-900 dark:bg-stone-100 hover:bg-stone-800 dark:hover:bg-white text-white dark:text-stone-900 text-xs font-medium transition-colors shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>重新加载界面</span>
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
