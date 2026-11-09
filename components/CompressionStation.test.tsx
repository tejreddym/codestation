// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import CompressionStation from "./CompressionStation";

afterEach(cleanup);

describe("CompressionStation Component", () => {
  it("renders ZIP Extractor & Viewer dropzone and header", () => {
    render(<CompressionStation toolId="zip-extractor" />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("ZIP Extractor & Viewer");
    expect(screen.getByText("Drop a .zip file here, or click to browse")).toBeDefined();
  });

  it("renders ZIP Archive Creator controls and level selection", () => {
    render(<CompressionStation toolId="zip-creator" />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("ZIP Archive Creator");
    expect(screen.getByText("Drop files to compress, or click to choose")).toBeDefined();
  });

  it("renders Gzip / Deflate Compressor with mode tabs and text input", () => {
    render(<CompressionStation toolId="gzip-compressor" />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Gzip / Deflate Compressor");
    expect(screen.getByText("Raw Text Input")).toBeDefined();
    expect(screen.getByText("Binary File Upload")).toBeDefined();

    const textarea = screen.getByPlaceholderText("Enter or paste text to compress...");
    fireEvent.change(textarea, { target: { value: "Sample text to compress" } });
    expect((textarea as HTMLTextAreaElement).value).toBe("Sample text to compress");
  });

  it("renders Gzip / Deflate Decompressor with mode tabs and base64 input", () => {
    render(<CompressionStation toolId="gzip-decompressor" />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("Gzip / Deflate Decompressor");
    expect(screen.getByText("Compressed File (.gz / .zz)")).toBeDefined();
    expect(screen.getByText("Base64 String Input")).toBeDefined();

    fireEvent.click(screen.getByText("Base64 String Input"));
    expect(screen.getByPlaceholderText("e.g. H4sICAAAAAAA/...")).toBeDefined();
  });

  it("renders TAR / TAR.GZ Inspector dropzone", () => {
    render(<CompressionStation toolId="tar-inspector" />);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("TAR / TAR.GZ Inspector");
    expect(screen.getByText("Drop a .tar, .tar.gz, or .tgz archive here")).toBeDefined();
  });
});
