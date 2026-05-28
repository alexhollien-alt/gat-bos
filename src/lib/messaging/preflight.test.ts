import { describe, it, expect } from "vitest";
import { extractImageUrls, stripHtml } from "./preflight";

describe("extractImageUrls", () => {
  it("collects http(s) and protocol-relative urls from src, background, and css url()", () => {
    const html = `
      <img src="https://cdn.example.com/hero.jpg">
      <td background="https://cdn.example.com/bg.png"></td>
      <div style="background-image:url('https://cdn.example.com/tile.gif')"></div>
      <img src="//cdn.example.com/proto.png">
    `;
    expect(extractImageUrls(html)).toEqual([
      "https://cdn.example.com/hero.jpg",
      "https://cdn.example.com/bg.png",
      "//cdn.example.com/proto.png",
      "https://cdn.example.com/tile.gif",
    ]);
  });

  it("excludes data: and cid: sources and dedupes", () => {
    const html = `
      <img src="data:image/png;base64,AAAA">
      <img src="cid:logo">
      <img src="https://cdn.example.com/x.jpg">
      <img src="https://cdn.example.com/x.jpg">
    `;
    expect(extractImageUrls(html)).toEqual(["https://cdn.example.com/x.jpg"]);
  });

  it("captures a quoted url containing an apostrophe without truncating", () => {
    const html = `<img src="https://cdn.example.com/o'brien.jpg">`;
    expect(extractImageUrls(html)).toEqual(["https://cdn.example.com/o'brien.jpg"]);
  });
});

describe("stripHtml", () => {
  it("strips tags, style/script blocks, decodes basic entities, collapses whitespace", () => {
    const html = `
      <style>.x{color:red}</style>
      <h1>Broker Open</h1>
      <p>Join us &amp; tour the home&nbsp;at 4901 East Berneil.</p>
      <script>console.log('no')</script>
    `;
    expect(stripHtml(html)).toBe("Broker Open Join us & tour the home at 4901 East Berneil.");
  });
});

import { detectUnresolvedTokens, findDuplicateEmails } from "./preflight";

describe("detectUnresolvedTokens", () => {
  it("finds {{ token }} markers across subject and body, deduped", () => {
    const subject = "Hi {{ first_name }}";
    const html = "<p>{{first_name}}, see {{event_name}}.</p>";
    expect(detectUnresolvedTokens(subject, html)).toEqual(["first_name", "event_name"]);
  });

  it("returns empty array when fully rendered", () => {
    expect(detectUnresolvedTokens("Hi Alex", "<p>Welcome</p>")).toEqual([]);
  });
});

describe("findDuplicateEmails", () => {
  it("returns lowercased emails appearing more than once", () => {
    const recipients = [
      { email: "a@x.com", name: "A" },
      { email: "A@x.com", name: "A2" },
      { email: "b@x.com", name: "B" },
    ];
    expect(findDuplicateEmails(recipients)).toEqual(["a@x.com"]);
  });
});
