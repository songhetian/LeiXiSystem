import { createTheme, MantineColorsTuple } from '@mantine/core';

const leixiEmerald: MantineColorsTuple = [
  '#ebfef5',
  '#d7fbe9',
  '#acf5d3',
  '#7defbc',
  '#57e9a9',
  '#3fe59c',
  '#31e395',
  '#22ca81',
  '#16b371',
  '#009b5f'
];

export const theme = createTheme({
  primaryColor: 'emerald',
  colors: {
    emerald: leixiEmerald,
  },
  defaultRadius: 'md',
  fontFamily: '"PingFang SC", "Helvetica Neue", "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  headings: {
    fontWeight: '800',
  },
  components: {
    Button: {
      defaultProps: {
        fw: 700,
      },
    },
    TextInput: {
      styles: {
        label: { marginBottom: 4, fontSize: 12, fontWeight: 700 },
      },
    },
    Paper: {
      defaultProps: {
        radius: 'xl',
      },
    },
    Table: {
      styles: {
        th: { backgroundColor: '#f7f8fa', padding: '12px 16px' },
        td: { padding: '12px 16px' },
      },
    },
  },
});
