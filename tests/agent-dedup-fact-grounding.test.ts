import { describe, it, expect, vi } from "vitest"
import * as fs from "fs"
import * as path from "path"
import * as os from "os"
import { AgentRunner } from "../src/main/agent/runner"
import { STATIC_SYSTEM_PROMPT_PREFIX, buildAgentEnvironmentPrompt } from "../src/main/agent/prompts"
import { LLMAdapter } from "../src/main/llm/adapter"
import { ConfigStore } from "../src/main/config/store"

describe("Agent Turn Tool Deduplication & Fact Grounding Guardrails", () => {
  it("strictly enforces Fact Grounding & Anti-Hallucination rule in system prompt", () => {
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain("客观事实考据严谨性与防幻觉铁律 (Fact Grounding & Anti-Hallucination)")
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain("严禁脑补清单")
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain("严禁将《苍云古齿》胡编为《苍云神骑》")
    expect(STATIC_SYSTEM_PROMPT_PREFIX).toContain("本地素材资料库优先原则")
  })

  it("lists existing library books in agent environment prompt for prompt-level awareness", () => {
    const tempLibDir = fs.mkdtempSync(path.join(os.tmpdir(), "explosion-lib-test-"))
    const bookSubDir = path.join(tempLibDir, "九州·缥缈录")
    fs.mkdirSync(bookSubDir, { recursive: true })
    fs.writeFileSync(path.join(bookSubDir, "卷一.txt"), "正文", "utf-8")
    fs.writeFileSync(path.join(bookSubDir, "卷二_苍云古齿.txt"), "正文", "utf-8")

    const envPrompt = buildAgentEnvironmentPrompt({
      libraryPath: tempLibDir
    })

    expect(envPrompt).toContain("素材资料库当前已收录藏书:")
    expect(envPrompt).toContain("《九州·缥缈录》")
    expect(envPrompt).toContain("包含 2 卷")

    fs.rmSync(tempLibDir, { recursive: true, force: true })
  })

  it("deduplicates identical tool calls in the exact same turn to prevent duplicated execution and UI spam", async () => {
    const tempConfigDir = fs.mkdtempSync(path.join(os.tmpdir(), "explosion-runner-test-"))
    const configStore = new ConfigStore(tempConfigDir)

    let executeCount = 0
    // Mock LLM Adapter returning 2 identical tool calls in turn 0
    const mockLLMAdapter = {
      generateStream: vi.fn().mockImplementation(async (options, requestId, onChunk) => {
        if (executeCount === 0) {
          executeCount++
          return {
            text: "",
            toolCalls: [
              {
                id: "call_1",
                type: "function",
                name: "read_file",
                arguments: JSON.stringify({ path: "/tmp/non-existent-test.txt" })
              },
              {
                id: "call_2",
                type: "function",
                name: "read_file",
                arguments: JSON.stringify({ path: "/tmp/non-existent-test.txt" })
              }
            ]
          }
        }
        // Turn 1: completion
        return {
          text: "查询完成",
          toolCalls: []
        }
      })
    } as unknown as LLMAdapter

    const runner = new AgentRunner({
      llmAdapter: mockLLMAdapter,
      configStore,
      maxTurns: 3
    })

    const events: any[] = []
    await runner.runTask(
      "test-dedup-task",
      { userPrompt: "测试重复工具调用" },
      (ev) => {
        events.push(ev)
      }
    )

    // Verify tool_start was emitted ONLY ONCE despite 2 identical tool calls in the model response
    const toolStarts = events.filter((e) => e.type === "tool_start")
    expect(toolStarts.length).toBe(1)
    expect(toolStarts[0].toolCall.id).toBe("call_1")

    const toolResults = events.filter((e) => e.type === "tool_result")
    expect(toolResults.length).toBe(1)

    // Done event received
    const doneEv = events.find((e) => e.type === "done")
    expect(doneEv).toBeDefined()

    fs.rmSync(tempConfigDir, { recursive: true, force: true })
  })
})
