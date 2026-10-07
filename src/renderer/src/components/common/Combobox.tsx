import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  options: string[]
  placeholder?: string
  className?: string
}

export const Combobox: React.FC<ComboboxProps> = ({
  value,
  onChange,
  options,
  placeholder = '选择或手动输入模型...',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(value)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setInputValue(value)
  }, [value])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(inputValue.toLowerCase())
  )

  const handleSelect = (opt: string) => {
    setInputValue(opt)
    onChange(opt)
    setIsOpen(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInputValue(val)
    onChange(val)
    setIsOpen(true)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        <input
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className="w-full bg-stone-900 border border-stone-700/80 rounded-lg px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500/80 focus:ring-1 focus:ring-amber-500/80 transition-all font-mono"
        />
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="absolute right-2.5 p-1 text-stone-400 hover:text-stone-200 transition-colors"
          tabIndex={-1}
        >
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1.5 bg-stone-900 border border-stone-800 rounded-lg shadow-2xl max-h-56 overflow-y-auto py-1 text-sm scrollbar-thin">
          {filtered.length > 0 ? (
            filtered.map((opt) => (
              <div
                key={opt}
                onClick={() => handleSelect(opt)}
                className={`flex items-center justify-between px-3.5 py-2 cursor-pointer font-mono text-xs transition-colors ${
                  opt === value
                    ? 'bg-amber-500/15 text-amber-300 font-medium'
                    : 'text-stone-300 hover:bg-stone-800 hover:text-stone-100'
                }`}
              >
                <span className="truncate">{opt}</span>
                {opt === value && <Check className="w-3.5 h-3.5 text-amber-400 ml-2 shrink-0" />}
              </div>
            ))
          ) : (
            <div className="px-3.5 py-2.5 text-xs text-stone-500">
              {inputValue ? `直接使用: "${inputValue}"` : '暂无预设，可直接输入'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
