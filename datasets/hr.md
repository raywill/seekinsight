
CREATE TABLE IF NOT EXISTS `hr_departments` (
  `dept_id` INT PRIMARY KEY COMMENT 'Unique department ID',
  `dept_name` VARCHAR(50) COMMENT 'Name of the department',
  `location` VARCHAR(50) COMMENT 'Physical location of the department office'
) COMMENT='Organization structure and department locations';

INSERT INTO `hr_departments` VALUES
(1, 'Engineering', 'Building A'),
(2, 'Sales', 'Building B'),
(3, 'Marketing', 'Building B'),
(4, 'HR', 'Building A'),
(5, 'Finance', 'Building C');

CREATE TABLE IF NOT EXISTS `hr_employees` (
  `emp_id` INT PRIMARY KEY COMMENT 'Unique employee ID',
  `full_name` VARCHAR(100) COMMENT 'Full name of the employee',
  `gender` VARCHAR(10) COMMENT 'Gender of the employee',
  `hire_date` DATE COMMENT 'Date of joining the company',
  `salary` DECIMAL(10, 2) COMMENT 'Annual salary',
  `dept_id` INT COMMENT 'Foreign key linking to hr_departments',
  `performance_score` INT COMMENT 'Latest performance rating (1-5)'
) COMMENT='Employee records including demographics and compensation';

INSERT INTO `hr_employees` VALUES
(201, 'John Doe', 'Male', '2019-05-01', 95000.00, 1, 4),
(202, 'Jane Smith', 'Female', '2020-03-15', 105000.00, 1, 5),
(203, 'Robert Brown', 'Male', '2018-11-20', 75000.00, 2, 3),
(204, 'Emily Davis', 'Female', '2021-07-01', 62000.00, 3, 4),
(205, 'Michael Wilson', 'Male', '2017-02-10', 88000.00, 5, 4),
(206, 'Sarah Johnson', 'Female', '2019-09-12', 72000.00, 4, 5),
(207, 'David Lee', 'Male', '2022-01-20', 68000.00, 2, 3),
(208, 'Jessica Garcia', 'Female', '2020-11-05', 98000.00, 1, 4),
(209, 'William Martinez', 'Male', '2016-06-30', 82000.00, 5, 3),
(210, 'Olivia Rodriguez', 'Female', '2021-04-18', 65000.00, 3, 5),
(211, 'James Anderson', 'Male', '2019-08-22', 110000.00, 1, 5),
(212, 'Sophia Hernandez', 'Female', '2022-09-10', 55000.00, 2, 2);
