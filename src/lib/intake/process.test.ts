import { describe, it, expect } from "vitest";
import {
  buildContactNotes,
  buildIntakeTitle,
  buildListingData,
  intakeSchema,
  sanitizeFreeText,
  splitName,
} from "./process";

describe("sanitizeFreeText", () => {
  it("returns undefined for non-strings", () => {
    expect(sanitizeFreeText(undefined, 100)).toBeUndefined();
    expect(sanitizeFreeText(null, 100)).toBeUndefined();
    expect(sanitizeFreeText(42, 100)).toBeUndefined();
  });

  it("strips HTML tags", () => {
    expect(sanitizeFreeText("<script>alert(1)</script>hi", 100)).toBe("alert(1)hi");
    expect(sanitizeFreeText("<b>bold</b>", 100)).toBe("bold");
  });

  it("strips ASCII control characters", () => {
    expect(sanitizeFreeText("a\x00b\x1fc\x7fd", 100)).toBe("abcd");
  });

  it("trims whitespace", () => {
    expect(sanitizeFreeText("   hello   ", 100)).toBe("hello");
  });

  it("enforces max length", () => {
    expect(sanitizeFreeText("abcdefghij", 5)).toBe("abcde");
  });
});

describe("splitName", () => {
  it("splits first and last", () => {
    expect(splitName("John Doe")).toEqual({ first: "John", last: "Doe" });
  });

  it("joins multi-word last names", () => {
    expect(splitName("Maria Van Den Bossche")).toEqual({
      first: "Maria",
      last: "Van Den Bossche",
    });
  });

  it("handles single name", () => {
    expect(splitName("Cher")).toEqual({ first: "Cher", last: "" });
  });

  it("collapses internal whitespace", () => {
    expect(splitName("Jane    Smith")).toEqual({ first: "Jane", last: "Smith" });
  });

  it("trims input", () => {
    expect(splitName("  John Doe  ")).toEqual({ first: "John", last: "Doe" });
  });
});

describe("buildContactNotes", () => {
  it("includes brokerage when present", () => {
    expect(buildContactNotes("relisting", "Coldwell Banker")).toBe(
      "Signed up via intake form (relisting). Brokerage: Coldwell Banker",
    );
  });

  it("falls back to 'general' when situation undefined", () => {
    expect(buildContactNotes(undefined, "Russ Lyon")).toContain("(general)");
  });

  it("omits brokerage clause when not provided", () => {
    expect(buildContactNotes("buyer", undefined)).toBe(
      "Signed up via intake form (buyer).",
    );
  });
});

describe("buildIntakeTitle", () => {
  it("uses listing address when present", () => {
    expect(
      buildIntakeTitle(
        "Julie Jarmiolowski",
        { address: "7700 E Gainey Ranch Rd", agent_email: "x" } as never,
        "new listing",
      ),
    ).toBe("Intake: Julie Jarmiolowski - 7700 E Gainey Ranch Rd");
  });

  it("falls back to situation when no listing", () => {
    expect(buildIntakeTitle("Fiona Bigbee", undefined, "branding refresh")).toBe(
      "Intake: Fiona Bigbee - branding refresh",
    );
  });

  it("falls back to 'general' when neither address nor situation", () => {
    expect(buildIntakeTitle("Amber Hollien", undefined, undefined)).toBe(
      "Intake: Amber Hollien - general",
    );
  });
});

describe("buildListingData", () => {
  it("emits all-empty payload when listing undefined, state defaults to AZ", () => {
    const data = buildListingData(undefined);
    expect(data.state).toBe("AZ");
    expect(data.address).toBe("");
    expect(data.key_features).toEqual([]);
    expect(data.gallery_images).toEqual([]);
  });

  it("preserves provided fields", () => {
    const data = buildListingData({
      address: "123 Main",
      city: "Scottsdale",
      state: "AZ",
      key_features: ["pool"],
      gallery_images: ["a.jpg", "b.jpg"],
    } as never);
    expect(data.address).toBe("123 Main");
    expect(data.city).toBe("Scottsdale");
    expect(data.key_features).toEqual(["pool"]);
    expect(data.gallery_images).toEqual(["a.jpg", "b.jpg"]);
  });

  it("returns all 17 listing fields", () => {
    const data = buildListingData(undefined);
    expect(Object.keys(data).sort()).toEqual(
      [
        "address",
        "bathrooms",
        "bedrooms",
        "city",
        "description",
        "gallery_images",
        "garage",
        "hero_image",
        "key_features",
        "lot_size",
        "price",
        "sqft",
        "special_instructions",
        "state",
        "status",
        "year_built",
        "zip",
      ].sort(),
    );
  });
});

describe("intakeSchema", () => {
  const minimalAgent = {
    agent_name: "Test Agent",
    agent_email: "test@example.com",
  };

  it("accepts a minimal valid payload", () => {
    const result = intakeSchema.safeParse({
      products: ["flyer"],
      agent: minimalAgent,
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty products array", () => {
    const result = intakeSchema.safeParse({
      products: [],
      agent: minimalAgent,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown product type", () => {
    const result = intakeSchema.safeParse({
      products: ["billboard"],
      agent: minimalAgent,
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown top-level fields (strict mode)", () => {
    const result = intakeSchema.safeParse({
      products: ["flyer"],
      agent: minimalAgent,
      malicious: "extra",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid email", () => {
    const result = intakeSchema.safeParse({
      products: ["flyer"],
      agent: { agent_name: "X", agent_email: "not-an-email" },
    });
    expect(result.success).toBe(false);
  });

  it("strips HTML tags (but not inner text) from agent_name via preprocess", () => {
    const result = intakeSchema.safeParse({
      products: ["flyer"],
      agent: { agent_name: "<b>Bold</b> Name", agent_email: "x@y.com" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // Tags stripped, text preserved.
      expect(result.data.agent.agent_name).toBe("Bold Name");
    }
  });

  it("accepts the full intake-form shape", () => {
    const result = intakeSchema.safeParse({
      products: ["flyer", "brochure"],
      listing: {
        address: "7700 E Gainey Ranch Rd",
        city: "Scottsdale",
        state: "AZ",
        zip: "85258",
        price: "1750000",
        bedrooms: "4",
        bathrooms: "3.5",
        sqft: "3500",
        year_built: "2002",
        lot_size: "0.5 acres",
        garage: "3-car",
        description: "Stunning home",
        key_features: ["mountain views", "pool"],
        status: "Coming Soon",
        hero_image: "https://example.com/hero.jpg",
        gallery_images: ["https://example.com/g1.jpg"],
        special_instructions: "use twilight photography",
      },
      agent: {
        agent_name: "Julie Jarmiolowski",
        agent_email: "julie@example.com",
        agent_phone: "480-555-0100",
        brokerage: "Russ Lyon Sotheby's",
      },
      situation: "new listing",
    });
    expect(result.success).toBe(true);
  });

  it("rejects products array > 20", () => {
    const result = intakeSchema.safeParse({
      products: Array(21).fill("flyer"),
      agent: minimalAgent,
    });
    expect(result.success).toBe(false);
  });
});
