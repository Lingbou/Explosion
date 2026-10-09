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
        <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#fbfbfa] p-8 text-stone-800 select-none font-sans">
          <div className="max-w-md w-full bg-white border border-stone-200 rounded-xl p-6 shadow-xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center mx-auto text-rose-600">
              <AlertCircle className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h2 className="text-base font-semibold text-stone-900">界面遇到异常</h2>
              <p className="text-xs text-stone-500 leading-relaxed">
                渲染组件遇到未捕获的错误。已保护工作区并避免白屏崩溃。
              </p>
            </div>

            {this.state.error && (
              <pre className="p-3 bg-stone-50 border border-stone-200 rounded-lg text-[11px] font-mono text-left text-rose-700 overflow-x-auto max-h-32 whitespace-pre-wrap">
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}

            <button
              onClick={this.handleReset}
              className="w-full py-2 px-4 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-medium transition-colors shadow-2xs flex items-center justify-center gap-1.5"
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
