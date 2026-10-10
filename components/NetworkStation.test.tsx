// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import NetworkStation from "./NetworkStation";

afterEach(cleanup);

describe("NetworkStation component", () => {
  it("renders CIDR calculator and calculates subnet values", () => {
    render(<NetworkStation toolId="cidr-calculator" />);
    expect(screen.getByText("Subnet Configuration")).toBeDefined();
    expect(screen.getByText("Network Address")).toBeDefined();
    expect(screen.getByText("192.168.1.0")).toBeDefined();
  });

  it("renders port reference and filters ports", () => {
    render(<NetworkStation toolId="port-reference" />);
    expect(screen.getByText("Common Ports Directory")).toBeDefined();
    const filter = screen.getByLabelText("Search by Port, Service or Description");
    fireEvent.change(filter, { target: { value: "5432" } });
    expect(screen.getByText("PostgreSQL")).toBeDefined();
  });

  it("renders Dockerfile generator and changes language", () => {
    render(<NetworkStation toolId="dockerfile-generator" />);
    expect(screen.getByText("Dockerfile Builder")).toBeDefined();
    const code = screen.getByLabelText("Generated Dockerfile");
    expect(code.textContent).toContain("FROM node:20-alpine");
  });
});
