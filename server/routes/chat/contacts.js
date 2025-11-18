module.exports = async function (fastify, options) {
  const { mysql } = options;

  // GET /api/chat/contacts - 获取好友列表
  fastify.get('/contacts', async (request, reply) => {
    // Implementation for fetching contacts list
    return { message: 'Get contacts list' };
  });

  // POST /api/chat/contacts - 添加好友
  fastify.post('/contacts', async (request, reply) => {
    // Implementation for adding a contact
    return { message: 'Add contact' };
  });

  // PUT /api/chat/contacts/:id - 更新好友信息（备注）
  fastify.put('/contacts/:id', async (request, reply) => {
    const { id } = request.params;
    // Implementation for updating contact info (remark)
    return { message: `Update contact ${id} remark` };
  });

  // DELETE /api/chat/contacts/:id - 删除好友
  fastify.delete('/contacts/:id', async (request, reply) => {
    const { id } = request.params;
    // Implementation for deleting a contact
    return { message: `Delete contact ${id}` };
  });

  // POST /api/chat/contacts/:id/block - 拉黑好友
  fastify.post('/contacts/:id/block', async (request, reply) => {
    const { id } = request.params;
    // Implementation for blocking a contact
    return { message: `Block contact ${id}` };
  });
};
