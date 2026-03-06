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
  defaultRadius: 'sm', // 符合文档要求的“专业办公”硬朗感
  fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  headings: {
    fontWeight: '900',
  },
  components: {
    Button: {
      defaultProps: {
        fw: 900,
      },
    },
    TextInput: {
      styles: {
        label: { marginBottom: 4, fontSize: 12, fontWeight: 700 },
      },
    },
    Table: {
      styles: {
        th: { backgroundColor: '#f8fafc', padding: '12px 16px' },
        td: { padding: '12px 16px' },
      },
    },
  },
});
