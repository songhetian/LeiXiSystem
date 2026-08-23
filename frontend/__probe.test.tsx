import * as React from 'react';
import { Avatar } from '@arco-design/web-react';
import { IconStar, IconSafe, IconBook, IconCustomerService, IconDashboard, IconFile, IconNotification, IconSettings, IconUser, IconCalendar, IconIdcard, IconCheckCircle, IconPoweroff, IconDown } from '@arco-design/web-react/icon';

test('probe after importing Arco main + icons', () => {
  console.log('IconStar=', typeof IconStar);
  console.log('IconSafe=', typeof IconSafe);
  console.log('IconBook=', typeof IconBook);
  console.log('IconCustomerService=', typeof IconCustomerService);
  const tree = React.createElement(IconStar, { 'data-testid': 'star' } as any);
  expect(React.isValidElement(tree)).toBe(true);
});