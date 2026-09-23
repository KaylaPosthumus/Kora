import React from "react";
import { Table, Spin, Empty, Pagination } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import type { TablePaginationConfig } from "antd/es/table/interface";
import type { Breakpoint } from "antd/es/_util/responsiveObserver";

/**
 * An Ant `<Table>` on a desktop, the same rows as stacked cards on a phone.
 *
 * The admin screens were built table-first and have no mobile layout at all: a
 * seven-column table on a 390px screen is a horizontal scrollbar at best. The
 * roadmap's answer was "tables become cards below `lg`".
 *
 * The thing worth noticing is what this does *not* do. It defines no card markup
 * of its own — it calls each column's existing `render` function and stacks the
 * results under that column's own `title` as a label. So a page keeps one
 * definition of how a cell looks, and the phone layout cannot drift from the
 * desktop one, which is exactly what happens when a card view is hand-written
 * beside a table.
 *
 * A column opts out of the card by setting `responsive: ["lg"]` — that is Ant's
 * own prop, and it already means "desktop only", so nothing new is invented.
 */

export interface ResponsiveColumn<T> {
  key?: string;
  dataIndex?: string;
  title?: React.ReactNode;
  className?: string;
  responsive?: Breakpoint[];
  render?: (value: unknown, record: T, index: number) => React.ReactNode;
}

interface ResponsiveTableProps<T> {
  /**
   * Ant's own column type, so a page defines its columns once and passes them
   * straight through. Optional in Ant's own typing, so it is optional here too
   * rather than making every caller assert.
   */
  columns: ColumnsType<T> | undefined;
  dataSource: T[];
  rowKey: keyof T & string;
  loading?: boolean;
  /**
   * Columns whose output is the card's heading — rendered first, without a
   * label. Usually the one carrying the name or the title of the thing.
   */
  headerKeys?: string[];
  /** Rendered instead of the cards when there is nothing to show. */
  emptyText?: string;
  /** Passed to the table; the cards paginate to match rather than scrolling forever. */
  pagination?: false | TablePaginationConfig;
  onChange?: TableProps<T>["onChange"];
  /**
   * Opening a row. Wired to the table row and to the whole card from one
   * definition, so a screen cannot end up clickable on a desktop and dead on a
   * phone — which is what happens when the two views are written separately.
   */
  onRowClick?: (record: T) => void;
}

const keyOf = <T,>(column: ResponsiveColumn<T>, index: number) =>
  column.key ?? column.dataIndex ?? String(index);

function ResponsiveTable<T extends object>({
  columns,
  dataSource,
  rowKey,
  loading = false,
  headerKeys = [],
  emptyText = "Nothing to show",
  pagination = false,
  onChange,
  onRowClick,
}: ResponsiveTableProps<T>) {
  // Ant types `columns` loosely enough to include undefined; the card side needs
  // `render`, `title` and `responsive`, which ResponsiveColumn names.
  const allColumns = (columns ?? []) as ResponsiveColumn<T>[];

  const cellFor = (column: ResponsiveColumn<T>, record: T, index: number) => {
    // `dataIndex` is a plain string on Ant's column type, so reading it off a
    // record typed as an interface needs the cast; the alternative is forcing
    // every caller's row type to carry an index signature.
    const field = (name: string) => (record as Record<string, unknown>)[name];

    if (column.render) {
      return column.render(column.dataIndex ? field(column.dataIndex) : undefined, record, index);
    }
    return column.dataIndex ? String(field(column.dataIndex) ?? "") : null;
  };

  // Ant's own "desktop only" marker, honoured here so a page states it once.
  const cardColumns = allColumns.filter((column) => !column.responsive?.includes("lg"));
  const headers = cardColumns.filter((column, index) =>
    headerKeys.includes(keyOf(column, index))
  );
  const rows = cardColumns.filter(
    (column, index) => !headerKeys.includes(keyOf(column, index))
  );

  // The cards show the same page the table would, rather than every row: a
  // phone scrolling through 200 employees is not an improvement on a scrollbar.
  const current = pagination === false ? 1 : (pagination.current ?? 1);
  const pageSize = pagination === false ? dataSource.length : (pagination.pageSize ?? 10);
  const pageRows =
    pagination === false
      ? dataSource
      : dataSource.slice((current - 1) * pageSize, current * pageSize);

  return (
    <>
      {/* Desktop: the table, unchanged. */}
      <div data-testid="responsive-table-desktop" className="hidden lg:block overflow-hidden rounded-xl">
        <Table
          columns={columns}
          dataSource={dataSource}
          rowKey={rowKey}
          pagination={pagination}
          loading={loading}
          onChange={onChange}
          onRow={
            onRowClick
              ? (record) => ({
                  onClick: () => onRowClick(record),
                  className: "cursor-pointer hover:bg-zinc-50",
                })
              : undefined
          }
        />
      </div>

      {/* Phone and tablet: one card per row. */}
      <div data-testid="responsive-table-cards" className="lg:hidden flex flex-col gap-3">
        {loading && (
          <div className="flex justify-center py-10">
            <Spin />
          </div>
        )}

        {!loading && dataSource.length === 0 && (
          <div className="bg-white rounded-2xl py-10">
            <Empty description={emptyText} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        )}

        {!loading &&
          pageRows.map((record, index) => (
            <div
              key={String(record[rowKey])}
              onClick={onRowClick ? () => onRowClick(record) : undefined}
              className={`bg-white rounded-2xl p-4 shadow-sm flex flex-col gap-3 ${
                onRowClick ? "cursor-pointer active:bg-zinc-50" : ""
              }`}
            >
              {headers.length > 0 && (
                <div className="flex flex-col gap-2">
                  {headers.map((column, columnIndex) => (
                    <div key={keyOf(column, columnIndex)}>
                      {cellFor(column, record, index)}
                    </div>
                  ))}
                </div>
              )}

              {rows.map((column, columnIndex) => {
                const content = cellFor(column, record, index);
                if (content === null || content === undefined || content === "") return null;
                return (
                  <div
                    key={keyOf(column, columnIndex)}
                    className="flex items-start justify-between gap-3 border-t border-zinc-100 pt-3 first:border-t-0 first:pt-0"
                  >
                    {column.title ? (
                      <span className="text-xs text-zinc-500 shrink-0 pt-1">{column.title}</span>
                    ) : null}
                    <div className="min-w-0 text-right ml-auto">{content}</div>
                  </div>
                );
              })}
            </div>
          ))}

        {/* Paging the cards calls the table's own onChange, so both views share
            one piece of state rather than drifting apart. */}
        {!loading && pagination !== false && dataSource.length > pageSize && (
          <div className="flex justify-center py-2">
            <Pagination
              simple
              current={current}
              pageSize={pageSize}
              total={pagination.total ?? dataSource.length}
              onChange={(page, size) =>
                onChange?.({ ...pagination, current: page, pageSize: size }, {}, [], {
                  currentDataSource: dataSource,
                  action: "paginate",
                })
              }
            />
          </div>
        )}
      </div>
    </>
  );
}

export default ResponsiveTable;
