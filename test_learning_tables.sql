USE leixin_customer_service;

CREATE TABLE IF NOT EXISTS learning_tasks_test (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to INT NOT NULL,
  assigned_by INT,
  status ENUM('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
  priority ENUM('low','medium','high') NOT NULL DEFAULT 'medium',
  due_date DATETIME NULL,
  completed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SELECT 'Test table created successfully' AS message;
