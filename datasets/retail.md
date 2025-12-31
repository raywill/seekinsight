
DROP TABLE IF EXISTS `retail_products`;
CREATE TABLE `retail_products` (
  `product_id` int NOT NULL,
  `category` varchar(50) DEFAULT NULL,
  `name` varchar(100) DEFAULT NULL,
  `price` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `retail_products` VALUES 
(101,'Electronics','Smartphone X',799.00),
(102,'Electronics','Noise Cancelling Headphones',299.00),
(103,'Home','Smart Coffee Maker',149.00),
(104,'Home','Robot Vacuum',499.00),
(105,'Fashion','Leather Jacket',199.00),
(106,'Fashion','Running Shoes',89.00);

DROP TABLE IF EXISTS `retail_customers`;
CREATE TABLE `retail_customers` (
  `customer_id` int NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `region` varchar(50) DEFAULT NULL,
  `signup_date` date DEFAULT NULL,
  PRIMARY KEY (`customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `retail_customers` VALUES 
(1,'Alice Smith','North America','2023-01-15'),
(2,'Bob Johnson','Europe','2023-02-20'),
(3,'Charlie Lee','Asia','2023-03-10'),
(4,'Diana Prince','North America','2023-04-05');

DROP TABLE IF EXISTS `retail_orders`;
CREATE TABLE `retail_orders` (
  `order_id` int NOT NULL,
  `customer_id` int DEFAULT NULL,
  `product_id` int DEFAULT NULL,
  `order_date` date DEFAULT NULL,
  `quantity` int DEFAULT NULL,
  `amount` decimal(10,2) DEFAULT NULL,
  PRIMARY KEY (`order_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `retail_orders` VALUES 
(1001,1,101,'2023-05-01',1,799.00),
(1002,1,102,'2023-05-02',2,598.00),
(1003,2,103,'2023-05-05',1,149.00),
(1004,3,101,'2023-06-01',1,799.00),
(1005,4,106,'2023-06-10',2,178.00),
(1006,2,104,'2023-06-15',1,499.00),
(1007,3,105,'2023-07-01',1,199.00);
