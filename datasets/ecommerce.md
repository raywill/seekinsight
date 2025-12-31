
CREATE TABLE IF NOT EXISTS `ecommerce_products` (
  `product_id` INT PRIMARY KEY COMMENT 'Unique identifier for the product',
  `product_name` VARCHAR(100) COMMENT 'Name of the product',
  `category` VARCHAR(50) COMMENT 'Product category (e.g., Electronics, Apparel)',
  `price` DECIMAL(10, 2) COMMENT 'Selling price of the product',
  `cost` DECIMAL(10, 2) COMMENT 'Manufacturing or acquisition cost'
) COMMENT='Product catalog with pricing and cost information';

INSERT INTO `ecommerce_products` VALUES 
(101, 'Smartphone X', 'Electronics', 899.00, 450.00),
(102, 'Wireless Earbuds', 'Electronics', 129.99, 40.00),
(103, 'Running Shoes', 'Apparel', 89.50, 30.00),
(104, 'Cotton T-Shirt', 'Apparel', 25.00, 8.00),
(105, 'Coffee Maker', 'Home', 79.99, 35.00),
(106, 'Office Chair', 'Furniture', 199.00, 90.00),
(107, 'Gaming Laptop', 'Electronics', 1499.00, 900.00),
(108, 'Yoga Mat', 'Sports', 29.99, 10.00),
(109, 'Protein Powder', 'Health', 45.00, 20.00),
(110, 'Desk Lamp', 'Home', 35.00, 12.00);

CREATE TABLE IF NOT EXISTS `ecommerce_orders` (
  `order_id` INT PRIMARY KEY COMMENT 'Unique identifier for the order',
  `customer_id` INT COMMENT 'ID of the customer who placed the order',
  `order_date` DATE COMMENT 'Date when the order was placed',
  `region` VARCHAR(20) COMMENT 'Geographic region of the order (North, South, etc.)',
  `product_id` INT COMMENT 'ID of the product ordered',
  `quantity` INT COMMENT 'Number of units ordered',
  `total_amount` DECIMAL(10, 2) COMMENT 'Total transaction value'
) COMMENT='Transactional records of customer orders';

INSERT INTO `ecommerce_orders` VALUES 
(5001, 1001, '2023-01-15', 'North', 101, 1, 899.00),
(5002, 1002, '2023-01-16', 'South', 103, 2, 179.00),
(5003, 1003, '2023-01-17', 'East', 105, 1, 79.99),
(5004, 1001, '2023-02-10', 'North', 102, 1, 129.99),
(5005, 1004, '2023-02-12', 'West', 107, 1, 1499.00),
(5006, 1002, '2023-02-15', 'South', 104, 3, 75.00),
(5007, 1005, '2023-03-01', 'East', 109, 2, 90.00),
(5008, 1003, '2023-03-05', 'East', 106, 1, 199.00),
(5009, 1006, '2023-03-10', 'North', 108, 1, 29.99),
(5010, 1004, '2023-03-15', 'West', 101, 1, 899.00),
(5011, 1001, '2023-04-02', 'North', 110, 2, 70.00),
(5012, 1007, '2023-04-05', 'South', 102, 1, 129.99),
(5013, 1008, '2023-04-10', 'West', 103, 1, 89.50),
(5014, 1002, '2023-04-12', 'South', 109, 1, 45.00),
(5015, 1005, '2023-04-15', 'East', 107, 1, 1499.00);
