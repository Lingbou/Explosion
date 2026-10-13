import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"

describe("Editor IME Stability & Undo (Ctrl+Z) Preservation Guardrails", () => {
  const editorFilePath = path.resolve(__dirname, "../src/renderer/src/components/layout/EditorCenter.tsx")
  const content = fs.readFileSync(editorFilePath, "utf-8")

  it("isolates chapter title typing in local state to prevent async IPC renames and screen flicker", () => {
    // Title input must use local state titleInput rather than triggering updateChapterTitle on every keystroke
    expect(content).toContain("const [titleInput, setTitleInput] = useState(currentTitle)")
    expect(content).toContain("onChange={(e) => setTitleInput(e.target.value)}")

    // Only commit on onBlur or confirmed Enter
    expect(content).toContain("onBlur={handleCommitTitle}")
    expect(content).toContain("handleCommitTitle()")

    // IME protection for Enter key
    expect(content).toContain("!e.nativeEvent.isComposing")
  })

  it("keeps handleChange completely pure to preserve browser native Undo/Redo stack (Ctrl+Z / Cmd+Z)", () => {
    // handleChange must not directly mutate textarea.value = nextVal or setSelectionRange during continuous keystrokes
    const handleChangeBlock = content.match(/const handleChange = \([\s\S]*?triggerTypewriterScroll[\s\S]*?\}/)?.[0]
    expect(handleChangeBlock).toBeDefined()
    expect(handleChangeBlock).not.toContain("textarea.value =")
    expect(handleChangeBlock).not.toContain("setSelectionRange")
    expect(handleChangeBlock).toContain("updateContent(nextVal)")
  })

  it("does not mutate textarea DOM value in debounce autosave timer to prevent destroying undo history", () => {
    const autoSaveBlock = content.match(/useEffect\(\(\) => \{[\s\S]*?saveActiveDocument\(\)[\s\S]*?\}, \[[\s\S]*?saveActiveDocument[\s\S]*?\]\)/)?.[0]
    expect(autoSaveBlock).toBeDefined()
    expect(autoSaveBlock).not.toContain("textareaRef.current.value =")
  })

  it("uses document.execCommand insertText for publication-grade indentation with native undo support", () => {
    expect(content).toContain('document.execCommand?.("insertText", false, "\\u3000\\u3000")')
    expect(content).toContain('document.execCommand?.("insertText", false, insertText)')
    expect(content).toContain("isComposingRef.current")
  })
})
