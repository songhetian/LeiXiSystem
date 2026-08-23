import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import ShiftForm, { ShiftFormValues } from '@/features/attendance/pages/ShiftForm';

const baseValues: ShiftFormValues = {
  name: '早班',
  departmentId: 'global',
  startTime: '08:00',
  endTime: '16:00',
  isNextDay: false,
  restDuration: 60,
  lateThreshold: 30,
  earlyThreshold: 30,
  useGlobalThreshold: true,
  description: '',
  isActive: true,
  color: '#3B82F6',
};

jest.mock('@arco-design/web-react', () => {
  const React = require('react');
  const formInstance = {
    setFieldsValue: jest.fn(),
    getFieldsValue: jest.fn(() => baseValues),
    getFieldValue: jest.fn(() => undefined),
    setFieldValue: jest.fn(),
    validate: jest.fn(),
    getFields: jest.fn(),
  };
  const Form = ({ form, children, layout, initialValues }: any) => (
    <form data-testid="shift-form">{children}</form>
  );
  Form.useForm = jest.fn(() => [formInstance, {}]);
  Form.useWatch = jest.fn(() => undefined);
  Form.Item = ({ label, field, rules, children, required }: any) => (
    <div data-testid={`form-item-${field}`}>
      {label && <label htmlFor={field}>{label}</label>}
      {children}
    </div>
  );

  const Modal = ({ visible, onOk, onCancel, title, okText, cancelText, children }: any) => {
    if (!visible) return null;
    return (
      <div role="dialog" data-testid="shift-modal">
        <div data-testid="modal-title">{title}</div>
        <div data-testid="modal-content">{children}</div>
        <button data-testid="btn-ok" onClick={onOk}>{okText}</button>
        <button data-testid="btn-cancel" onClick={onCancel}>{cancelText}</button>
      </div>
    );
  };

  const Input: any = React.forwardRef(
    ({ value, onChange, placeholder, id }: any, ref: any) => (
      <input
        ref={ref}
        id={id}
        type="text"
        data-testid={`input-${id || 'default'}`}
        value={value || ''}
        placeholder={placeholder}
        onChange={(e) => onChange?.(e.target.value)}
      />
    ),
  );
  Input.TextArea = Input;

  const Select = ({ children, value, onChange, placeholder, id }: any) => (
    <select data-testid={`select-${id || 'default'}`} id={id} value={value || ''}
      onChange={(e) => onChange?.(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
  Select.Option = ({ value, children }: any) => <option value={value}>{children}</option>;

  const InputNumber = ({ value, onChange, min, max, placeholder, id }: any) => (
    <input
      type="number"
      id={id}
      data-testid={`input-number-${id || 'default'}`}
      value={value ?? ''}
      placeholder={placeholder}
      min={min} max={max}
      onChange={(e) => onChange?.(Number(e.target.value))}
    />
  );

  const Switch = ({ checked, onChange }: any) => (
    <input
      type="checkbox"
      data-testid="switch-global"
      checked={!!checked}
      onChange={(e) => onChange?.(e.target.checked)}
    />
  );

  return { Form, Modal, Input, Select, InputNumber, Switch };
});

describe('ShiftForm 校验聚焦', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('校验失败时聚焦第一个错误字段', async () => {
    const user = userEvent.setup();
    const onOk = jest.fn();
    const arco = require('@arco-design/web-react');
    const formInstance = arco.Form.useForm()[0];
    // 模拟名称未填写 → name 字段校验失败
    formInstance.validate.mockImplementationOnce(() =>
      Promise.reject({
        name: { message: '请输入班次名称', field: 'name' },
        endTime: { message: '请选择下班时间', field: 'endTime' },
      }),
    );

    render(
      <ShiftForm
        visible
        title="新建班次"
        departments={[]}
        initialValues={baseValues}
        onOk={onOk}
        onCancel={() => {}}
      />,
    );

    await user.click(screen.getByTestId('btn-ok'));
    expect(onOk).not.toHaveBeenCalled();
    await screen.findByTestId('input-name');
    expect(screen.getByTestId('input-name')).toHaveFocus();
  });
});