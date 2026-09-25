// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ListWindow } from "./ListControls";

afterEach(cleanup);
test("a partially filled page does not skip new records when more arrive", () => {
  const rows = Array.from({ length: 19 }, (_, index) => index + 1);
  const loadMore = vi.fn();
  const view = (items: number[]) => <ListWindow items={items} hasMore loadMore={loadMore}>
    {visible => visible.map(item => <p key={item}>Record {item}</p>)}
  </ListWindow>;
  const { rerender } = render(view(rows));
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(loadMore).toHaveBeenCalledTimes(1);
  expect(screen.getByText("Record 1")).toBeTruthy();
  rerender(view([...rows, 20, 21, 22]));
  expect(screen.getByText("Record 20")).toBeTruthy();
  expect(screen.queryByText("Record 19")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Previous page" }));
  expect(screen.getByText("Record 19")).toBeTruthy();
  expect(screen.queryByText("Record 20")).toBeNull();
});
