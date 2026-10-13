import { describe, it, expect } from "vitest"
import * as fs from "fs"
import * as path from "path"
import {
  ensureParagraphIndent,
  ensureFirstParagraphIndent,
  formatPastedText
} from "../src/shared/utils/typography"

describe("Full-Auto Chinese Publication Indentation (Pure Functions)", () => {
  describe("ensureParagraphIndent", () => {
    it("handles empty and null inputs safely", () => {
      expect(ensureParagraphIndent("")).toBe("")
      expect(ensureParagraphIndent(null as any)).toBe("")
      expect(ensureParagraphIndent(undefined as any)).toBe("")
    })

    it("automatically prepends double full-width space (\\u3000\\u3000) to unindented paragraphs", () => {
      const raw = "南淮的夏天总是悄无声息。\n街角茶肆的竹帘垂得低低的。"
      const formatted = ensureParagraphIndent(raw)
      const lines = formatted.split("\n")
      expect(lines[0]).toBe("\u3000\u3000南淮的夏天总是悄无声息。")
      expect(lines[1]).toBe("\u3000\u3000街角茶肆的竹帘垂得低低的。")
    })

    it("does not duplicate indent if a line already begins with \\u3000\\u3000", () => {
      const raw = "\u3000\u3000第一段已经缩进。\n第二段没有缩进。"
      const formatted = ensureParagraphIndent(raw)
      const lines = formatted.split("\n")
      expect(lines[0]).toBe("\u3000\u3000第一段已经缩进。")
      expect(lines[1]).toBe("\u3000\u3000第二段没有缩进。")
    })

    it("cleans half-width spaces, tabs, or single full-width spaces and normalizes to exactly \\u3000\\u3000", () => {
      const raw = "  两半角空格。\n\t一个Tab缩进。\n\u3000单全角空格。\n    四半角空格。"
      const formatted = ensureParagraphIndent(raw)
      const lines = formatted.split("\n")
      expect(lines[0]).toBe("\u3000\u3000两半角空格。")
      expect(lines[1]).toBe("\u3000\u3000一个Tab缩进。")
      expect(lines[2]).toBe("\u3000\u3000单全角空格。")
      expect(lines[3]).toBe("\u3000\u3000四半角空格。")
    })

    it("preserves empty lines between paragraphs without inserting whitespace", () => {
      const raw = "第一段。\n\n第二段。\n\n\n第三段。"
      const formatted = ensureParagraphIndent(raw)
      const lines = formatted.split("\n")
      expect(lines[0]).toBe("\u3000\u3000第一段。")
      expect(lines[1]).toBe("")
      expect(lines[2]).toBe("\u3000\u3000第二段。")
      expect(lines[3]).toBe("")
      expect(lines[4]).toBe("")
      expect(lines[5]).toBe("\u3000\u3000第三段。")
    })
  })

  describe("ensureFirstParagraphIndent", () => {
    it("safely handles empty input", () => {
      expect(ensureFirstParagraphIndent("")).toBe("")
    })

    it("indents only the first non-empty paragraph while keeping subsequent lines unchanged", () => {
      const raw = "第一段未缩进。\n第二段保持原样。\n\u3000\u3000第三段原样。"
      const formatted = ensureFirstParagraphIndent(raw)
      const lines = formatted.split("\n")
      expect(lines[0]).toBe("\u3000\u3000第一段未缩进。")
      expect(lines[1]).toBe("第二段保持原样。")
      expect(lines[2]).toBe("\u3000\u3000第三段原样。")
    })

    it("preserves already indented first paragraph", () => {
      const raw = "\u3000\u3000第一段已缩进。\n第二段。"
      const formatted = ensureFirstParagraphIndent(raw)
      expect(formatted).toBe("\u3000\u3000第一段已缩进。\n第二段。")
    })

    it("skips leading empty lines and indents the first actual content paragraph", () => {
      const raw = "\n\n第一段实际内容。\n第二段。"
      const formatted = ensureFirstParagraphIndent(raw)
      const lines = formatted.split("\n")
      expect(lines[0]).toBe("")
      expect(lines[1]).toBe("")
      expect(lines[2]).toBe("\u3000\u3000第一段实际内容。")
      expect(lines[3]).toBe("第二段。")
    })
  })

  describe("formatPastedText", () => {
    it("handles empty paste gracefully", () => {
      expect(formatPastedText("")).toBe("")
    })

    it("strips Markdown pollution and applies publication indentation to pasted text", () => {
      const raw = "# 第一章 暴风雨\n\n**狂风**骤起，他拔出了`铁剑`。\n- 列表项"
      const formatted = formatPastedText(raw)
      const lines = formatted.split("\n")
      expect(lines[0]).toBe("\u3000\u3000第一章 暴风雨")
      expect(lines[1]).toBe("")
      expect(lines[2]).toBe("\u3000\u3000狂风骤起，他拔出了铁剑。")
      expect(lines[3]).toBe("\u3000\u3000列表项")
    })

    it("standardizes Chinese punctuation in pasted text", () => {
      const raw = '他说:"行动吧..."随后拔刀--迎着夜色。'
      const formatted = formatPastedText(raw)
      expect(formatted).toContain("“行动吧……”")
      expect(formatted).toContain("——迎着夜色")
      expect(formatted.startsWith("\u3000\u3000")).toBe(true)
    })

    it("prevents double indentation when pasting at a line that is already indented", () => {
      const pasted = "你好你好你好\n第二行内容"
      // Cursor is on a line that already has \u3000\u3000
      const formatted = formatPastedText(pasted, "\u3000\u3000")
      const lines = formatted.split("\n")
      // Line 0 should NOT have \u3000\u3000 because prefixBeforeCursor already provides it
      expect(lines[0]).toBe("你好你好你好")
      // Line 1 and beyond should have \u3000\u3000
      expect(lines[1]).toBe("\u3000\u3000第二行内容")
    })

    it("preserves already indented lines without duplicating \\u3000\\u3000 in pasted text", () => {
      const pasted = "\u3000\u3000已有缩进第一行\n\u3000\u3000已有缩进第二行"
      const formatted = formatPastedText(pasted, "")
      const lines = formatted.split("\n")
      expect(lines[0]).toBe("\u3000\u3000已有缩进第一行")
      expect(lines[1]).toBe("\u3000\u3000已有缩进第二行")
    })

    it("correctly handles pasted content when current line is already indented and pasted content is also indented", () => {
      const pasted = "\u3000\u3000已有缩进第一行\n\u3000\u3000已有缩进第二行"
      const formatted = formatPastedText(pasted, "\u3000\u3000")
      const lines = formatted.split("\n")
      // Line 0 stripped of its indent so prefix + line 0 equals exactly 1 indent
      expect(lines[0]).toBe("已有缩进第一行")
      expect(lines[1]).toBe("\u3000\u3000已有缩进第二行")
    })
  })
})

describe("Immersive Editor & Time Machine Integration Guardrails", () => {
  it("verifies EditorCenter contains auto-indent handlers for Enter, paste, input, and blur", () => {
    const editorFilePath = path.resolve(__dirname, "../src/renderer/src/components/layout/EditorCenter.tsx")
    const content = fs.readFileSync(editorFilePath, "utf-8")

    // Enter key handler inserting \n\u3000\u3000
    expect(content).toContain("handleKeyDown")
    expect(content).toContain("\\u3000\\u3000")

    // Paste handler calling formatPastedText
    expect(content).toContain("handlePaste")
    expect(content).toContain("formatPastedText(pasted")

    // Blur handler calling ensureParagraphIndent
    expect(content).toContain("handleBlur")
    expect(content).toContain("ensureParagraphIndent(textarea.value)")

    // Debounced auto-save also calling ensureParagraphIndent
    expect(content).toContain("ensureParagraphIndent(currentContent)")
  })

  it("verifies EditorCenter layout is pure and immersive with unified scroll container", () => {
    const editorFilePath = path.resolve(__dirname, "../src/renderer/src/components/layout/EditorCenter.tsx")
    const content = fs.readFileSync(editorFilePath, "utf-8")

    // Title input placed inside the scrollable container above textarea
    expect(content).toContain("placeholder=\"未命名章节\"")
    expect(content).toContain("max-w-4xl mx-auto px-8 md:px-12 pt-10")

    // Textarea shares scroll with title
    expect(content).toContain("ref={scrollContainerRef}")
    expect(content).toContain("ref={textareaRef}")

    // SnapshotDrawer mounted
    expect(content).toContain("<SnapshotDrawer")
  })

  it("verifies status bar footer hosts the Time Machine button", () => {
    const editorFilePath = path.resolve(__dirname, "../src/renderer/src/components/layout/EditorCenter.tsx")
    const content = fs.readFileSync(editorFilePath, "utf-8")

    // Time Machine button in footer
    expect(content).toMatch(/<footer[\s\S]*?onClick=\{\(\) => setIsSnapshotOpen\(true\)\}[\s\S]*?时光机[\s\S]*?<\/footer>/)
  })
})
