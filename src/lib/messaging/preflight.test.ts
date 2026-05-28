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

import { partitionContacts } from "./preflight";

describe("partitionContacts", () => {
  it("includes live emailable rows; excludes soft-deleted and missing-email by name", () => {
    const rows = [
      { first_name: "Jane", last_name: "Doe", email: "jane@x.com", brokerage: "KW", deleted_at: null },
      { first_name: "No", last_name: "Email", email: null, brokerage: null, deleted_at: null },
      { first_name: "Gone", last_name: "Away", email: "gone@x.com", brokerage: null, deleted_at: "2026-01-01T00:00:00Z" },
      { first_name: " ", last_name: " ", email: "blank@x.com", brokerage: null, deleted_at: null },
    ];
    const { included, excluded } = partitionContacts(rows);
    expect(included).toEqual([
      { email: "jane@x.com", name: "Jane Doe" },
      { email: "blank@x.com", name: "(no name)" },
    ]);
    expect(excluded).toEqual([
      { email: null, name: "No Email", reason: "missing email" },
      { email: "gone@x.com", name: "Gone Away", reason: "soft-deleted" },
    ]);
  });
});

import { checkImageUrls } from "./preflight";

describe("checkImageUrls", () => {
  it("marks 200 as ok and non-200 as not ok, normalizing protocol-relative urls", async () => {
    const calls: string[] = [];
    const fakeFetch = (async (url: string) => {
      calls.push(url);
      return { status: url.includes("broken") ? 404 : 200 } as Response;
    }) as unknown as typeof fetch;

    const results = await checkImageUrls(
      ["https://cdn.example.com/ok.jpg", "https://cdn.example.com/broken.jpg", "//cdn.example.com/proto.png"],
      fakeFetch,
    );

    expect(results).toEqual([
      { url: "https://cdn.example.com/ok.jpg", ok: true, status: 200 },
      { url: "https://cdn.example.com/broken.jpg", ok: false, status: 404 },
      { url: "//cdn.example.com/proto.png", ok: true, status: 200 },
    ]);
    expect(calls[2]).toBe("https://cdn.example.com/proto.png");
  });

  it("captures fetch errors as not ok with null status", async () => {
    const fakeFetch = (async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;
    const results = await checkImageUrls(["https://cdn.example.com/x.jpg"], fakeFetch);
    expect(results[0]).toEqual({
      url: "https://cdn.example.com/x.jpg",
      ok: false,
      status: null,
      error: "ECONNREFUSED",
    });
  });
});

import { buildPreflightReport } from "./preflight";

describe("buildPreflightReport", () => {
  it("assembles counts, duplicates, body preview, tokens, and image urls without network", () => {
    const report = buildPreflightReport({
      subject: "Broker Open at 4901 East Berneil Drive",
      html: `<h1>Broker Open</h1><img src="https://cdn.example.com/hero.jpg"><p>{{first_name}}</p>`,
      recipients: [
        { email: "a@x.com", name: "A" },
        { email: "a@x.com", name: "A dup" },
      ],
      excluded: [{ email: null, name: "No Email", reason: "missing email" }],
      filterDescription: 'contacts.tags contains "BerneilBlast"',
      expectedCount: 2,
    });
    expect(report.recipientCount).toBe(2);
    expect(report.expectedCount).toBe(2);
    expect(report.duplicateEmails).toEqual(["a@x.com"]);
    expect(report.bodyPreview).toBe("Broker Open {{first_name}}");
    expect(report.unresolvedTokens).toEqual(["first_name"]);
    expect(report.imageUrls).toEqual(["https://cdn.example.com/hero.jpg"]);
    expect(report.imageChecks).toEqual([]);
    expect(report.filterDescription).toBe('contacts.tags contains "BerneilBlast"');
    expect(report.excluded).toHaveLength(1);
  });
});
