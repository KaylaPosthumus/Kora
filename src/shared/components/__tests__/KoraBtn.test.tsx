/**
 * The buttons, after Bootstrap.
 *
 * `variant="primary"` used to make react-bootstrap emit `btn btn-primary`, and
 * `buttons.css` selected on those classes for every active, focus and disabled
 * state. Both halves are ours now — the component sets `kora-btn--primary`, the
 * stylesheet selects it — and nothing connects them but the string.
 *
 * A rename on either side is silent: the button still renders, still clicks, and
 * simply loses its state colours. So the stylesheet is read here and its
 * selectors checked against what the components actually emit.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import KoraBtn from "@/shared/components/KoraBtn";
import KoraCircleBtn from "@/shared/components/KoraCircleBtn";

const buttonsCss = readFileSync(resolve(process.cwd(), "src/styles/buttons.css"), "utf8");

describe("it is a plain button now", () => {
  it("renders a real <button>, not a framework wrapper", () => {
    render(<KoraBtn>Save</KoraBtn>);
    expect(screen.getByRole("button", { name: "Save" }).tagName).toBe("BUTTON");
  });

  it("carries no Bootstrap classes", () => {
    render(<KoraBtn>Save</KoraBtn>);
    const cls = screen.getByRole("button").className;
    expect(cls).not.toMatch(/\bbtn-primary\b/);
    expect(cls).not.toMatch(/\bbtn-outline-primary\b/);
  });

  it("still fires onClick and still honours disabled", async () => {
    const onClick = vi.fn();
    const { rerender } = render(<KoraBtn onClick={onClick}>Go</KoraBtn>);
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <KoraBtn onClick={onClick} disabled>
        Go
      </KoraBtn>
    );
    await userEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe("the classes the stylesheet selects on are the ones emitted", () => {
  it("marks a primary button with the class buttons.css styles", () => {
    render(<KoraBtn>Save</KoraBtn>);
    const cls = screen.getByRole("button").className;
    expect(cls).toContain("kora-btn");
    expect(cls).toContain("kora-btn--primary");
    expect(buttonsCss).toContain(".kora-btn.kora-btn--primary");
  });

  it("marks a secondary button with the class buttons.css styles", () => {
    render(<KoraBtn secondary>Cancel</KoraBtn>);
    const cls = screen.getByRole("button").className;
    expect(cls).toContain("kora-btn--secondary");
    expect(buttonsCss).toContain(".kora-btn.kora-btn--secondary");
  });

  it("does the same for the circle button", () => {
    render(<KoraCircleBtn icon={<span>x</span>} aria-label="Edit" />);
    const cls = screen.getByRole("button", { name: "Edit" }).className;
    expect(cls).toContain("kora-btn");
    expect(cls).toContain("kora-btn--primary");
  });

  it("keeps the colour-family hooks the stylesheet matches on", () => {
    // buttons.css keys its active states off the Tailwind colour classes, e.g.
    // [class*="bg-corigreen"]. If the component stopped emitting those, one rule
    // would stop covering a whole family with nothing to show for it.
    render(<KoraBtn style="black">Save</KoraBtn>);
    expect(screen.getByRole("button").className).toMatch(/bg-zinc/);
    expect(buttonsCss).toContain('[class*="bg-zinc"]');

    render(<KoraBtn secondary style="red">Delete</KoraBtn>);
    expect(screen.getByRole("button", { name: "Delete" }).className).toMatch(/border-red/);
    expect(buttonsCss).toContain('[class*="border-red"]');
  });
});
