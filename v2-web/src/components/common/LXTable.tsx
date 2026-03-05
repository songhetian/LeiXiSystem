import React from 'react';
import { Table, ScrollArea, Pagination, Group, Text, Center, Box, LoadingOverlay } from '@mantine/core';
import { TableVirtuoso } from 'react-virtuoso';

interface LXTableProps {
  columns: {
    key: string;
    title: string;
    render?: (record: any, index: number) => React.ReactNode;
    width?: string | number;
    align?: 'left' | 'center' | 'right';
  }[];
  data: any[];
  loading?: boolean;
  maxHeight?: number | string;
  pagination?: {
    current: number;
    pageSize: number;
    total: number;
    onChange: (page: number) => void;
  };
}

export const LXTable = ({ columns, data, loading, maxHeight = 600, pagination }: LXTableProps) => {
  // 规约执行：根据数据量智能判断是否开启虚拟滚动
  const isVirtualized = data.length > 50;

  const TableHeader = () => (
    <Table.Tr style={{ backgroundColor: '#f8fafc' }}>
      {columns.map((col) => (
        <Table.Th key={col.key} style={{ width: col.width, textAlign: col.align || 'left' }}>
          <Text size="xs" fw={900} c="dimmed" style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {col.title}
          </Text>
        </Table.Th>
      ))}
    </Table.Tr>
  );

  const TableRow = (index: number, record: any) => (
    <>
      {columns.map((col) => (
        <Table.Td key={col.key} style={{ textAlign: col.align || 'left' }}>
          {col.render ? col.render(record, index) : (record[col.key] ?? '-')}
        </Table.Td>
      ))}
    </>
  );

  return (
    <Box pos="relative">
      <LoadingOverlay visible={!!loading} overlayProps={{ blur: 2 }} />
      
      {isVirtualized ? (
        <Box style={{ height: maxHeight }}>
          <TableVirtuoso
            data={data}
            fixedHeaderContent={() => <TableHeader />}
            itemContent={(index, record) => <TableRow index={index} record={record} />}
            components={{
              Table: (props) => <Table {...props} verticalSpacing="sm" highlightOnHover style={{ borderCollapse: 'separate' }} />,
              TableHead: Table.Thead,
              TableBody: Table.Tbody,
              TableRow: Table.Tr,
            }}
          />
        </Box>
      ) : (
        <ScrollArea>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <TableHeader />
            </Table.Thead>
            <Table.Tbody>
              {data.length > 0 ? (
                data.map((record, index) => (
                  <Table.Tr key={record.id || index}>
                    <TableRow index={index} record={record} />
                  </Table.Tr>
                ))
              ) : (
                <Table.Tr>
                  <Table.Td colSpan={columns.length}>
                    <Center py="xl">
                      <Text size="sm" c="dimmed" fw={700}>暂无物理存证数据</Text>
                    </Center>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {pagination && (
        <Group justify="space-between" mt="md" px="md" pb="md">
          <Text size="xs" c="dimmed" fw={700}>共 {pagination.total} 条存证记录</Text>
          <Pagination value={pagination.current} onChange={pagination.onChange} total={Math.ceil(pagination.total / pagination.pageSize)} size="sm" radius="md" withEdges />
        </Group>
      )}
    </Box>
  );
};
