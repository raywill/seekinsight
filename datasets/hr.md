
DROP TABLE IF EXISTS `hr_departments`;
CREATE TABLE `hr_departments` (
  `dept_id` int NOT NULL,
  `dept_name` varchar(50) DEFAULT NULL,
  `location` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`dept_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `hr_departments` VALUES 
(1,'Engineering','San Francisco'),
(2,'Sales','New York'),
(3,'HR','Chicago'),
(4,'Marketing','London');

DROP TABLE IF EXISTS `hr_employees`;
CREATE TABLE `hr_employees` (
  `emp_id` int NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `dept_id` int DEFAULT NULL,
  `hire_date` date DEFAULT NULL,
  `title` varchar(50) DEFAULT NULL,
  PRIMARY KEY (`emp_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `hr_employees` VALUES 
(101,'John Doe',1,'2020-01-15','Senior Engineer'),
(102,'Jane Smith',2,'2021-03-22','Sales Manager'),
(103,'Mike Brown',1,'2022-06-01','Junior Engineer'),
(104,'Sarah Davis',4,'2019-11-10','Marketing Lead'),
(105,'Chris Wilson',3,'2021-09-05','HR Specialist');

DROP TABLE IF EXISTS `hr_salaries`;
CREATE TABLE `hr_salaries` (
  `salary_id` int NOT NULL,
  `emp_id` int DEFAULT NULL,
  `amount` int DEFAULT NULL,
  `effective_date` date DEFAULT NULL,
  PRIMARY KEY (`salary_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT INTO `hr_salaries` VALUES 
(1,101,150000,'2023-01-01'),
(2,102,120000,'2023-01-01'),
(3,103,95000,'2023-01-01'),
(4,104,110000,'2023-01-01'),
(5,105,85000,'2023-01-01');
