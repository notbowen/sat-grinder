import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDashboard, getPracticeSession, submitPracticeAnswer } from "@/lib/supabase-api";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  createSignedUrls: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabase: () => ({
    rpc: mocks.rpc,
    storage: { from: () => ({ createSignedUrls: mocks.createSignedUrls }) },
  }),
}));

beforeEach(() => {
  mocks.rpc.mockReset();
  mocks.createSignedUrls.mockReset();
});

describe("Supabase API client", () => {
  it("surfaces RPC errors", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Authentication required." } });
    await expect(getDashboard()).rejects.toThrow("Authentication required.");
  });

  it("replaces private asset references with signed URLs", async () => {
    const hash = "a".repeat(64);
    const path = `${hash}.png`;
    mocks.rpc.mockResolvedValue({
      data: {
        session: { id: "session", mode: "random", requestedCount: 1, status: "active", createdAt: "2026-01-01", completedAt: null, abandonedAt: null },
        total: 1,
        resolved: 0,
        firstAttemptCorrect: 0,
        current: {
          id: "question", displayId: "Q1", section: "math", domainName: "Algebra", skillName: "Linear equations",
          difficulty: "medium", type: "mcq", stimulusHtml: null,
          stemHtml: `<img src="/question-assets/${path}">`, answerOptions: [{ letter: "A", content: "A" }], retryCount: 0, position: 0,
        },
      },
      error: null,
    });
    mocks.createSignedUrls.mockResolvedValue({ data: [{ path, signedUrl: "https://signed.example/asset" }], error: null });

    const result = await getPracticeSession("session");

    expect(mocks.createSignedUrls).toHaveBeenCalledWith([path], 3600);
    expect(result.current?.stemHtml).toContain("https://signed.example/asset");
  });

  it("signs protected rationale assets only after a correct response", async () => {
    const path = `${"b".repeat(64)}.svg`;
    mocks.rpc.mockResolvedValue({ data: { correct: true, rationaleHtml: `/question-assets/${path}`, correctAnswers: ["A"] }, error: null });
    mocks.createSignedUrls.mockResolvedValue({ data: [{ path, signedUrl: "https://signed.example/rationale" }], error: null });

    const result = await submitPracticeAnswer("session", "question", "A");

    expect(result.rationaleHtml).toBe("https://signed.example/rationale");
  });
});
