const bcrypt = require('bcryptjs');

const hash = '$2b$12$KIXxLQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5GyYqNqYq';
const password = '123456';

bcrypt.compare(password, hash).then(res => {
  console.log(`Password "123456" matches hash: ${res}`);
}).catch(err => {
  console.error(err);
});
