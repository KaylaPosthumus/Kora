/**
 * The admin tables, as cards on a phone.
 *
 * The property worth pinning is that the card view has no markup of its own for
 * a cell: it calls the column's existing `render`. That is what stops the phone
 * layout drifting from the desktop one, and it is invisible from the outside
 * unless a test asserts the same renderer feeds both.
 *
 * jsdom applies no CSS, so `hidden lg:block` and `lg:hidden` both render into
 * the DOM. The two regions carry test ids so a query can say which it means.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ResponsiveTable from "@/shared/components/ResponsiveTable";

interface Row extends Record<string, unknown> {
  id: string;
  name: string;
  days: number;
}

const rows: Row[] = [
  { id: "a", name: "Sam Employee", days: 12 },
  { id: "b", name: "Jo Worker", days: 3 },
];

const columns = [
  { key: "name", dataIndex: "name", title: "Employee", render: (v: unknown) => <b>{String(v)}</b> },
  {
    key: "days",
    dataIndex: "days",
    title: "Leave",
    render: (v: unknown) => <span>{String(v)} days</span>,
  },
];

const cards = () => within(screen.getByTestId("responsive-table-cards"));

describe("the card view", () => {
  it("renders one card per row using the columns' own renderers", () => {
    render(<ResponsiveTable<Row> columns={columns} dataSource={rows} rowKey="id" />);

    // <b> comes from the column's render, not from the card.
    expect(cards().getByText("Sam Employee").tagName).toBe("B");
    expect(cards().getByText("12 days")).toBeInTheDocument();
    expect(cards().getByText("Jo Worker")).toBeInTheDocument();
  });

  it("labels each cell with its column title", () => {
    render(<ResponsiveTable<Row> columns={columns} dataSource={rows} rowKey="id" />);
    expect(cards().getAllByText("Leave").length).toBe(rows.length);
  });

  it("drops the label for a column named as the card's heading", () => {
    render(
      <ResponsiveTable<Row>
        columns={columns}
        dataSource={rows}
        rowKey="id"
        headerKeys={["name"]}
      />
    );
    expect(cards().getByText("Sam Employee")).toBeInTheDocument();
    expect(cards().queryByText("Employee")).not.toBeInTheDocument();
  });

  it("honours a column marked desktop-only", () => {
    const desktopOnly = [
      ...columns,
      {
        key: "secret",
        dataIndex: "id",
        title: "Internal",
        responsive: ["lg" as const],
        render: () => <span>desktop only</span>,
      },
    ];
    render(<ResponsiveTable<Row> columns={desktopOnly} dataSource={rows} rowKey="id" />);

    // Only the card half is asserted. Ant applies `responsive` itself through
    // matchMedia, which jsdom answers "no match" to, so the desktop table hides
    // the column here as well — that half is browser behaviour, not ours.
    expect(cards().queryByText("desktop only")).not.toBeInTheDocument();
    expect(cards().queryByText("Internal")).not.toBeInTheDocument();
  });

  it("shows an empty state rather than a bare gap", () => {
    render(
      <ResponsiveTable<Row>
        columns={columns}
        dataSource={[]}
        rowKey="id"
        emptyText="No employees"
      />
    );
    expect(cards().getByText("No employees")).toBeInTheDocument();
  });
});

describe("opening a row", () => {
  it("fires the same handler from a card as from a table row", async () => {
    const onRowClick = vi.fn();
    render(
      <ResponsiveTable<Row>
        columns={columns}
        dataSource={rows}
        rowKey="id"
        onRowClick={onRowClick}
      />
    );

    await userEvent.click(cards().getByText("Sam Employee"));

    expect(onRowClick).toHaveBeenCalledTimes(1);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});

describe("paging", () => {
  it("shows only the current page's rows, matching the table", () => {
    render(
      <ResponsiveTable<Row>
        columns={columns}
        dataSource={rows}
        rowKey="id"
        pagination={{ current: 2, pageSize: 1, total: 2 }}
      />
    );

    expect(cards().queryByText("Sam Employee")).not.toBeInTheDocument();
    expect(cards().getByText("Jo Worker")).toBeInTheDocument();
  });
});
