
DROP TABLE IF EXISTS `saas_subscriptions`;
CREATE TABLE `saas_subscriptions` (
  `sub_id` int NOT NULL,
  `customer_email` varchar(100) DEFAULT NULL,
  `plan` varchar(20) DEFAULT NULL,
  `status` varchar(20) DEFAULT NULL,
  `mrr` int DEFAULT NULL,
  `start_date` date DEFAULT NULL,
  PRIMARY KEY (`sub_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `saas_subscriptions` VALUES 
(1,'cust1@corp.com','Enterprise','Active',500,'2023-01-01'),
(2,'cust2@startup.io','Pro','Active',99,'2023-02-15'),
(3,'cust3@gmail.com','Basic','Churned',29,'2023-01-10'),
(4,'cust4@tech.net','Pro','Active',99,'2023-03-01'),
(5,'cust5@agency.com','Enterprise','Active',500,'2023-03-20');

DROP TABLE IF EXISTS `saas_active_users`;
CREATE TABLE `saas_active_users` (
  `log_id` int NOT NULL,
  `date` date DEFAULT NULL,
  `dau` int DEFAULT NULL,
  `wau` int DEFAULT NULL,
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `saas_active_users` VALUES 
(1,'2023-06-01',1200,5500),
(2,'2023-06-02',1250,5600),
(3,'2023-06-03',1100,5400),
(4,'2023-06-04',1050,5450),
(5,'2023-06-05',1300,5700);
