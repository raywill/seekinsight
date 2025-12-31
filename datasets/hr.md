
DROP TABLE IF EXISTS `hr_departments`;
CREATE TABLE `hr_departments` (
  `dept_id` int NOT NULL COMMENT 'Unique department identifier',
  `dept_name` varchar(50) DEFAULT NULL COMMENT 'Name of the department',
  `location` varchar(50) DEFAULT NULL COMMENT 'Physical office location',
  PRIMARY KEY (`dept_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Department information table';

INSERT INTO `hr_departments` VALUES 
(10, 'Executive', 'New York'),
(20, 'Engineering', 'San Francisco'),
(30, 'Sales', 'Chicago'),
(40, 'Marketing', 'London'),
(50, 'Human Resources', 'New York');

DROP TABLE IF EXISTS `hr_employees`;
CREATE TABLE `hr_employees` (
  `emp_id` int NOT NULL COMMENT 'Employee unique ID',
  `name` varchar(100) DEFAULT NULL COMMENT 'Full name of the employee',
  `dept_id` int DEFAULT NULL COMMENT 'Department ID the employee belongs to',
  `manager_id` int DEFAULT NULL COMMENT 'ID of the direct manager (Self-referencing FK)',
  `hire_date` date DEFAULT NULL COMMENT 'Date of hiring',
  `title` varchar(100) DEFAULT NULL COMMENT 'Job title',
  PRIMARY KEY (`emp_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Employee details and hierarchy table';

INSERT INTO `hr_employees` VALUES 
(100, 'Arthur King', 10, NULL, '2015-01-01', 'CEO'),
(101, 'Ben Wright', 20, 100, '2016-03-15', 'VP of Engineering'),
(102, 'Cindy Lo', 30, 100, '2017-06-01', 'VP of Sales'),
(103, 'David Scott', 20, 101, '2018-01-10', 'Director of Engineering'),
(104, 'Elena Vance', 20, 103, '2019-02-20', 'Principal Engineer'),
(105, 'Frank Miller', 20, 103, '2019-05-15', 'Engineering Manager'),
(106, 'Grace Ho', 20, 105, '2020-08-01', 'Senior Software Engineer'),
(107, 'Henry Ford', 20, 105, '2021-03-12', 'Software Engineer'),
(108, 'Ivy Chen', 20, 104, '2021-07-22', 'Staff Engineer'),
(109, 'Jack Ryan', 30, 102, '2018-11-05', 'Sales Director'),
(110, 'Kelly Kapowski', 30, 109, '2019-09-30', 'Regional Sales Manager'),
(111, 'Liam Neeson', 30, 110, '2020-01-15', 'Sales Representative'),
(112, 'Mia Thermopolis', 30, 110, '2021-06-18', 'Sales Representative'),
(113, 'Noah Bennett', 50, 100, '2016-12-01', 'Director of HR'),
(114, 'Olivia Pope', 50, 113, '2019-04-10', 'HR Business Partner'),
(115, 'Peter Parker', 40, 100, '2020-05-20', 'CMO');

DROP TABLE IF EXISTS `hr_salaries`;
CREATE TABLE `hr_salaries` (
  `salary_id` int NOT NULL COMMENT 'Unique salary record ID',
  `emp_id` int DEFAULT NULL COMMENT 'Associated Employee ID',
  `amount` int DEFAULT NULL COMMENT 'Annual salary amount',
  `effective_date` date DEFAULT NULL COMMENT 'Date this salary became effective',
  PRIMARY KEY (`salary_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Salary history table';

INSERT INTO `hr_salaries` VALUES 
(1, 100, 450000, '2023-01-01'),
(2, 101, 280000, '2023-01-01'),
(3, 102, 260000, '2023-01-01'),
(4, 103, 220000, '2023-01-01'),
(5, 104, 195000, '2023-01-01'),
(6, 105, 180000, '2023-01-01'),
(7, 106, 160000, '2023-01-01'),
(8, 107, 130000, '2023-01-01'),
(9, 108, 185000, '2023-01-01'),
(10, 109, 200000, '2023-01-01'),
(11, 110, 150000, '2023-01-01'),
(12, 111, 90000, '2023-01-01'),
(13, 112, 92000, '2023-01-01'),
(14, 113, 175000, '2023-01-01'),
(15, 114, 110000, '2023-01-01'),
(16, 115, 240000, '2023-01-01');
