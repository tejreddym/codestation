// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { markdownTools } from "@/config/markdown-tools";
import * as engine from "@/lib/tools/markdown/engine";
import MarkdownStation from "./MarkdownStation";
vi.mock("@/lib/tools/markdown/engine",()=>({runMarkdown:vi.fn()}));
afterEach(cleanup);
let writeText:ReturnType<typeof vi.fn>; beforeEach(()=>{vi.mocked(engine.runMarkdown).mockResolvedValue({text:"# Result ✓",data:{}});writeText=vi.fn().mockResolvedValue(undefined);Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText}});});
describe("Markdown station controls",()=>{
 it.each(markdownTools)("$id has exact labeled controls, keyboard action, copy and clear",async tool=>{const user=userEvent.setup();const {container}=render(<MarkdownStation toolId={tool.id}/>);for(const field of tool.localContract.fields){const control=screen.getByLabelText(field.label);expect(control.getAttribute("id")).toBe(`markdown-${tool.id}-${field.name}`);if(control instanceof HTMLTextAreaElement)fireEvent.change(control,{target:{value:"# Unicode 雪\n\ncontent"}});else if(control instanceof HTMLInputElement&&control.type==="number")fireEvent.change(control,{target:{value:"1"}});}
  const action=screen.getByRole("button",{name:tool.localContract.action});action.focus();await user.keyboard("{Enter}");await waitFor(()=>expect(screen.getByRole("status").textContent).toBe("Result ready."));expect(engine.runMarkdown).toHaveBeenCalledWith(tool.id,expect.any(Object));await user.click(screen.getByRole("button",{name:"Copy"}));await waitFor(()=>expect(screen.getByRole("status").textContent).toBe("Result copied."));await user.click(screen.getByRole("button",{name:"Clear"}));expect(screen.queryByRole("alert")).toBeNull();expect(container.querySelector("pre")).toBeNull();});
 it("does not execute network or markup and handles engine errors accessibly",async()=>{vi.mocked(engine.runMarkdown).mockRejectedValueOnce(new Error("Malformed <script>"));render(<MarkdownStation toolId="markdown-preview"/>);fireEvent.change(screen.getByLabelText("Markdown text"),{target:{value:"<script>alert(1)</script>"}});fireEvent.click(screen.getByRole("button",{name:"Preview"}));expect((await screen.findByRole("alert")).textContent).toBe("Could not process this Markdown input.");expect(document.querySelector("script")).toBeNull();});
});
