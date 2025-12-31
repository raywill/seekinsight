
DROP TABLE IF EXISTS `retail_products`;
CREATE TABLE `retail_products` (
  `product_id` int NOT NULL COMMENT 'Unique product identifier',
  `category` varchar(50) DEFAULT NULL COMMENT 'Product category',
  `name` varchar(100) DEFAULT NULL COMMENT 'Product name',
  `price` decimal(10,2) DEFAULT NULL COMMENT 'Unit price',
  PRIMARY KEY (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Product information table';

INSERT INTO `retail_products` VALUES 
(101,'Electronics','Smartphone X',799.00),
(102,'Electronics','Noise Cancelling Headphones',299.00),
(103,'Home','Smart Coffee Maker',149.00),
(104,'Home','Robot Vacuum',499.00),
(105,'Fashion','Leather Jacket',199.00),
(106,'Fashion','Running Shoes',89.00);

DROP TABLE IF EXISTS `retail_customers`;
CREATE TABLE `retail_customers` (
  `customer_id` int NOT NULL COMMENT 'Unique customer identifier',
  `name` varchar(100) DEFAULT NULL COMMENT 'Customer full name',
  `region` varchar(50) DEFAULT NULL COMMENT 'Geographic region',
  `signup_date` date DEFAULT NULL COMMENT 'Date of registration',
  PRIMARY KEY (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Customer details table';

INSERT INTO `retail_customers` VALUES 
(1,'Alice Smith','North America','2023-01-15'),
(2,'Bob Johnson','Europe','2023-02-20'),
(3,'Charlie Lee','Asia','2023-03-10'),
(4,'Diana Prince','North America','2023-04-05');

DROP TABLE IF EXISTS `retail_orders`;
CREATE TABLE `retail_orders` (
  `order_id` int NOT NULL COMMENT 'Unique order identifier',
  `customer_id` int DEFAULT NULL COMMENT 'Associated Customer ID',
  `product_id` int DEFAULT NULL COMMENT 'Associated Product ID',
  `order_date` date DEFAULT NULL COMMENT 'Date the order was placed',
  `quantity` int DEFAULT NULL COMMENT 'Quantity purchased',
  `amount` decimal(10,2) DEFAULT NULL COMMENT 'Total transaction amount',
  PRIMARY KEY (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Sales transaction table';

INSERT INTO `retail_orders` VALUES 
(1001,1,101,'2023-05-01',1,799.00),
(1002,1,102,'2023-05-02',2,598.00),
(1003,2,103,'2023-05-05',1,149.00),
(1004,3,101,'2023-06-01',1,799.00),
(1005,4,106,'2023-06-10',2,178.00),
(1006,2,104,'2023-06-15',1,499.00),
(1007,3,105,'2023-07-01',1,199.00);
