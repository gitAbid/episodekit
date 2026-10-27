import { describe, expect, it } from "vitest";
import { isSupportedAsrLanguage, supportedInput } from "@/lib/asr/language";

// supportedInput is ported from api/generate-suite.js: Latin ratio < 0.6 fails.
describe("supportedInput (ported)", () => {
  it("accepts English text", () => {
    expect(supportedInput("Welcome back to the show, focus is a budget.")).toBe(true);
  });

  it("fails when the Latin ratio is below 0.6 (U19)", () => {
    expect(supportedInput("これは日本語のテキストです。文字化けではなく、意図的に日本語で書かれています。")).toBe(false);
    expect(supportedInput("Привет, это русский текст для проверки проверки проверки")).toBe(false);
  });

  it("accepts mixed text as long as Latin letters are >= 60%", () => {
    expect(supportedInput("hello world with one 中文 word")).toBe(true);
  });

  it("fails text with no letters at all", () => {
    expect(supportedInput("123 456 !!! ---")).toBe(false);
    expect(supportedInput("")).toBe(false);
  });
});

// ASR results: the Whisper `language` field AND the Latin ratio both gate.
describe("isSupportedAsrLanguage", () => {
  it("accepts english/en whisper field with English text", () => {
    expect(isSupportedAsrLanguage("english", "Hello there, welcome back.")).toBe(true);
    expect(isSupportedAsrLanguage("en", "Hello there, welcome back.")).toBe(true);
  });

  it("fails a non-English whisper field regardless of text", () => {
    expect(isSupportedAsrLanguage("dutch", "Hello there, welcome back.")).toBe(false);
    expect(isSupportedAsrLanguage("japanese", "こんにちは")).toBe(false);
  });

  it("fails a missing whisper field when the text is not Latin enough", () => {
    expect(isSupportedAsrLanguage(undefined, "これは日本語です")).toBe(false);
  });

  it("fails English field with non-Latin text (misdetected audio)", () => {
    expect(isSupportedAsrLanguage("english", "これは日本語です")).toBe(false);
  });
});
