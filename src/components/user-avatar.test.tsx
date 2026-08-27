/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { UserAvatar } from "@/components/user-avatar";

afterEach(cleanup);

describe("UserAvatar", () => {
  it("uses the OAuth picture and falls back to an initial if it cannot load", () => {
    render(<UserAvatar name="Ada Learner" avatarUrl="https://lh3.googleusercontent.com/avatar" />);
    const image = screen.getByRole("img", { name: "Ada Learner's profile picture" });
    expect(image.getAttribute("src")).toBe("https://lh3.googleusercontent.com/avatar");

    fireEvent.error(image);
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.getByLabelText("Ada Learner's profile picture").textContent).toBe("A");
  });
});
