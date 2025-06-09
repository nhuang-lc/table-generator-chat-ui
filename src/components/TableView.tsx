import React, { useState, useMemo } from 'react';
import { useStreamContext } from "@/providers/Stream";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";

type SortConfig = {
  key: string;
  direction: 'asc' | 'desc';
};

type TableRowData = Record<string, any>;

export function TableView() {
  const { values } = useStreamContext();
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  const tableData: TableRowData[] = values?.finalTable || [];
  const columns = useMemo(() => {
    if (tableData.length === 0) return [];
    return Object.keys(tableData[0]);
  }, [tableData]);

  const sortedData = useMemo(() => {
    if (!sortConfig || tableData.length === 0) return tableData;

    return [...tableData].sort((a: TableRowData, b: TableRowData) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === bValue) return 0;
      
      const comparison = aValue < bValue ? -1 : 1;
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });
  }, [tableData, sortConfig]);

  const requestSort = (key: string) => {
    setSortConfig((currentSort) => {
      if (!currentSort || currentSort.key !== key) {
        return { key, direction: 'asc' };
      }
      if (currentSort.direction === 'asc') {
        return { key, direction: 'desc' };
      }
      return null;
    });
  };

  const getSortIcon = (column: string) => {
    if (!sortConfig || sortConfig.key !== column) {
      return <ArrowUpDown className="ml-2 h-4 w-4 text-gray-400" />;
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="ml-2 h-4 w-4 text-primary" />
    ) : (
      <ArrowDown className="ml-2 h-4 w-4 text-primary" />
    );
  };

  if (!tableData || tableData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">No table data available</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-4">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column}>
                <Button
                  variant="ghost"
                  onClick={() => requestSort(column)}
                  className={cn(
                    "h-8 text-left font-medium",
                    sortConfig?.key === column && "text-primary"
                  )}
                >
                  {column}
                  {getSortIcon(column)}
                </Button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.map((row: TableRowData, rowIndex: number) => (
            <TableRow key={rowIndex}>
              {columns.map((column) => (
                <TableCell key={`${rowIndex}-${column}`}>
                  {row[column]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
} 