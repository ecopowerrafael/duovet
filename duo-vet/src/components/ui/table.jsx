import * as React from "react"

import { cn } from "../../lib/utils"

const Table = React.forwardRef(function Table(
  /** @type {{className?: string, children?: import('react').ReactNode} & import('react').TableHTMLAttributes<HTMLTableElement>} */
  { className, ...props },
  ref
) {
  return (
    <div className="relative w-full overflow-auto">
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props} />
    </div>
  );
})
Table.displayName = "Table"

const TableHeader = React.forwardRef(function TableHeader(
  /** @type {{className?: string, children?: import('react').ReactNode} & import('react').HTMLAttributes<HTMLTableSectionElement>} */
  { className, ...props },
  ref
) {
  return (
    <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
  );
})
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef(function TableBody(
  /** @type {{className?: string, children?: import('react').ReactNode} & import('react').HTMLAttributes<HTMLTableSectionElement>} */
  { className, ...props },
  ref
) {
  return (
    <tbody
      ref={ref}
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props} />
  );
})
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef(function TableFooter(
  /** @type {{className?: string, children?: import('react').ReactNode} & import('react').HTMLAttributes<HTMLTableSectionElement>} */
  { className, ...props },
  ref
) {
  return (
    <tfoot
      ref={ref}
      className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)}
      {...props} />
  );
})
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef(function TableRow(
  /** @type {{className?: string, children?: import('react').ReactNode} & import('react').HTMLAttributes<HTMLTableRowElement>} */
  { className, ...props },
  ref
) {
  return (
    <tr
      ref={ref}
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...props} />
  );
})
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef(function TableHead(
  /** @type {{className?: string, children?: import('react').ReactNode} & import('react').ThHTMLAttributes<HTMLTableCellElement>} */
  { className, ...props },
  ref
) {
  return (
    <th
      ref={ref}
      className={cn(
        "h-10 px-2 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props} />
  );
})
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef(function TableCell(
  /** @type {{className?: string, children?: import('react').ReactNode} & import('react').TdHTMLAttributes<HTMLTableCellElement>} */
  { className, ...props },
  ref
) {
  return (
    <td
      ref={ref}
      className={cn(
        "p-2 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props} />
  );
})
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef(function TableCaption(
  /** @type {{className?: string, children?: import('react').ReactNode} & import('react').TableHTMLAttributes<HTMLTableCaptionElement>} */
  { className, ...props },
  ref
) {
  return (
    <caption
      ref={ref}
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...props} />
  );
})
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
