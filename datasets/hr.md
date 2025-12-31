
-- HR Dataset: Workforce, Attendance, and Performance
-- Scale: Representative subset of a ~200 person company structure

DROP TABLE IF EXISTS `hr_departments`;
CREATE TABLE `hr_departments` (
  `dept_id` int NOT NULL COMMENT 'Unique department identifier',
  `dept_name` varchar(50) DEFAULT NULL COMMENT 'Name of the department',
  `location` varchar(50) DEFAULT NULL COMMENT 'Physical office location',
  `cost_center` varchar(20) DEFAULT NULL COMMENT 'Accounting cost center code',
  PRIMARY KEY (`dept_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Department master data';

INSERT INTO `hr_departments` VALUES 
(100, 'Executive Office', 'New York', 'CC-001'),
(200, 'Engineering - Platform', 'San Francisco', 'CC-101'),
(201, 'Engineering - Product', 'San Francisco', 'CC-102'),
(202, 'Engineering - QA', 'San Francisco', 'CC-103'),
(300, 'Sales - North America', 'Chicago', 'CC-201'),
(301, 'Sales - EMEA', 'London', 'CC-202'),
(400, 'Marketing', 'New York', 'CC-301'),
(500, 'Human Resources', 'New York', 'CC-401'),
(600, 'Finance', 'New York', 'CC-501');

DROP TABLE IF EXISTS `hr_employees`;
CREATE TABLE `hr_employees` (
  `emp_id` int NOT NULL COMMENT 'Employee unique ID',
  `first_name` varchar(50) DEFAULT NULL COMMENT 'First name',
  `last_name` varchar(50) DEFAULT NULL COMMENT 'Last name',
  `email` varchar(100) DEFAULT NULL COMMENT 'Corporate email',
  `gender` varchar(10) DEFAULT NULL COMMENT 'Gender for diversity analytics',
  `dept_id` int DEFAULT NULL COMMENT 'Department ID',
  `job_title` varchar(100) DEFAULT NULL COMMENT 'Official job title',
  `manager_id` int DEFAULT NULL COMMENT 'Direct reporting manager ID',
  `hire_date` date DEFAULT NULL COMMENT 'Date of joining',
  `employment_status` varchar(20) DEFAULT 'Active' COMMENT 'Active, Terminated, Leave',
  PRIMARY KEY (`emp_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Core employee directory with hierarchy';

-- Hierarchy: 
-- Level 1: 1 (CEO)
-- Level 2: 2, 3, 4 (CXOs/VPs)
-- Level 3: 10, 11, 12, 30 (Directors)
-- Level 4: 20, 21, 31, 40 (Managers)
-- Level 5: 100+ (Staff)

INSERT INTO `hr_employees` VALUES 
(1, 'Arthur', 'King', 'arthur.king@corp.com', 'Male', 100, 'CEO', NULL, '2015-01-01', 'Active'),
(2, 'Ben', 'Wright', 'ben.wright@corp.com', 'Male', 200, 'CTO', 1, '2015-06-01', 'Active'),
(3, 'Cindy', 'Lo', 'cindy.lo@corp.com', 'Female', 300, 'VP of Sales', 1, '2016-02-15', 'Active'),
(4, 'Diana', 'Prince', 'diana.prince@corp.com', 'Female', 500, 'VP of People', 1, '2017-08-01', 'Active'),
(10, 'David', 'Scott', 'david.scott@corp.com', 'Male', 200, 'Director of Engineering', 2, '2018-01-10', 'Active'),
(11, 'Elena', 'Vance', 'elena.vance@corp.com', 'Female', 201, 'Director of Product', 2, '2019-03-20', 'Active'),
(12, 'Frank', 'Miller', 'frank.miller@corp.com', 'Male', 202, 'QA Director', 2, '2019-05-15', 'Active'),
(20, 'Grace', 'Ho', 'grace.ho@corp.com', 'Female', 200, 'Engineering Manager', 10, '2020-08-01', 'Active'),
(21, 'Henry', 'Ford', 'henry.ford@corp.com', 'Male', 200, 'DevOps Manager', 10, '2021-01-12', 'Active'),
(30, 'Jack', 'Ryan', 'jack.ryan@corp.com', 'Male', 300, 'Sales Director NA', 3, '2018-11-05', 'Active'),
(31, 'Kelly', 'Kapowski', 'kelly.k@corp.com', 'Female', 300, 'Sales Manager', 30, '2019-09-30', 'Active'),
(40, 'Liam', 'Neeson', 'liam.n@corp.com', 'Male', 500, 'HR Manager', 4, '2020-01-15', 'Active'),
-- ICs (Individual Contributors) - Engineering Team A
(101, 'Ivy', 'Chen', 'ivy.chen@corp.com', 'Female', 200, 'Senior Backend Engineer', 20, '2021-07-22', 'Active'),
(102, 'John', 'Snow', 'john.snow@corp.com', 'Male', 200, 'Backend Engineer', 20, '2021-08-01', 'Active'),
(103, 'Kevin', 'Hart', 'kevin.hart@corp.com', 'Male', 200, 'Frontend Engineer', 20, '2021-09-15', 'Active'),
(104, 'Laura', 'Croft', 'laura.croft@corp.com', 'Female', 200, 'Frontend Engineer', 20, '2022-01-10', 'Active'),
(105, 'Mike', 'Ross', 'mike.ross@corp.com', 'Male', 200, 'Junior Engineer', 20, '2022-06-01', 'Active'),
-- ICs - DevOps Team
(106, 'Nancy', 'Drew', 'nancy.drew@corp.com', 'Female', 200, 'SRE', 21, '2021-05-20', 'Active'),
(107, 'Oscar', 'Wilde', 'oscar.wilde@corp.com', 'Male', 200, 'Cloud Architect', 21, '2021-02-15', 'Active'),
-- ICs - Sales Team
(108, 'Paul', 'Rudd', 'paul.rudd@corp.com', 'Male', 300, 'Account Executive', 31, '2020-03-10', 'Active'),
(109, 'Quinn', 'Fabray', 'quinn.f@corp.com', 'Female', 300, 'Account Executive', 31, '2020-04-01', 'Active'),
(110, 'Rachel', 'Green', 'rachel.g@corp.com', 'Female', 300, 'SDR', 31, '2022-01-15', 'Active'),
(111, 'Steve', 'Rogers', 'steve.r@corp.com', 'Male', 300, 'SDR', 31, '2022-02-01', 'Active'),
-- ICs - HR
(112, 'Tina', 'Fey', 'tina.fey@corp.com', 'Female', 500, 'Recruiter', 40, '2021-03-01', 'Active'),
(113, 'Uma', 'Thurman', 'uma.t@corp.com', 'Female', 500, 'HR Specialist', 40, '2021-04-15', 'Active'),
-- Terminated/Former
(199, 'Zack', 'Snyder', 'zack.s@corp.com', 'Male', 200, 'Engineer', 20, '2020-01-01', 'Terminated');

DROP TABLE IF EXISTS `hr_salaries`;
CREATE TABLE `hr_salaries` (
  `id` int NOT NULL COMMENT 'Record ID',
  `emp_id` int DEFAULT NULL COMMENT 'Employee ID',
  `base_salary` int DEFAULT NULL COMMENT 'Annual base salary in USD',
  `bonus_target` decimal(5,2) DEFAULT NULL COMMENT 'Target bonus percentage (e.g. 0.15)',
  `effective_date` date DEFAULT NULL COMMENT 'Salary start date',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Compensation history';

INSERT INTO `hr_salaries` VALUES 
(1, 1, 450000, 0.50, '2023-01-01'),
(2, 2, 320000, 0.30, '2023-01-01'),
(3, 3, 300000, 0.40, '2023-01-01'),
(4, 4, 280000, 0.25, '2023-01-01'),
(5, 10, 240000, 0.20, '2023-01-01'),
(6, 20, 190000, 0.15, '2023-01-01'),
(7, 21, 195000, 0.15, '2023-01-01'),
(8, 30, 210000, 0.35, '2023-01-01'),
(9, 31, 160000, 0.25, '2023-01-01'),
(10, 101, 175000, 0.10, '2023-01-01'), -- Senior Eng
(11, 102, 150000, 0.10, '2023-01-01'), -- Eng
(12, 103, 145000, 0.10, '2023-01-01'),
(13, 104, 145000, 0.10, '2023-01-01'),
(14, 105, 110000, 0.05, '2023-01-01'), -- Junior
(15, 106, 160000, 0.10, '2023-01-01'),
(16, 107, 180000, 0.10, '2023-01-01'), -- Architect
(17, 108, 90000, 0.40, '2023-01-01'), -- Sales (High bonus)
(18, 109, 92000, 0.40, '2023-01-01'),
(19, 110, 65000, 0.20, '2023-01-01'), -- SDR
(20, 111, 65000, 0.20, '2023-01-01'),
(21, 112, 95000, 0.10, '2023-01-01'),
(22, 113, 85000, 0.10, '2023-01-01');

DROP TABLE IF EXISTS `hr_attendance_daily`;
CREATE TABLE `hr_attendance_daily` (
  `log_id` int NOT NULL COMMENT 'Log entry ID',
  `emp_id` int DEFAULT NULL COMMENT 'Employee ID',
  `date` date DEFAULT NULL COMMENT 'Work date',
  `check_in` time DEFAULT NULL COMMENT 'Clock in time',
  `check_out` time DEFAULT NULL COMMENT 'Clock out time',
  `status` varchar(20) DEFAULT NULL COMMENT 'Present, Late, Absent, Leave',
  PRIMARY KEY (`log_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Daily attendance logs for June 2023';

-- Sample data for 1 week in June for a few employees
INSERT INTO `hr_attendance_daily` VALUES 
-- Ivy (Senior Eng) - Reliable
(1, 101, '2023-06-01', '08:55:00', '18:05:00', 'Present'),
(2, 101, '2023-06-02', '09:00:00', '17:55:00', 'Present'),
(3, 101, '2023-06-05', '08:50:00', '18:10:00', 'Present'),
(4, 101, '2023-06-06', '09:05:00', '18:00:00', 'Present'),
(5, 101, '2023-06-07', '08:55:00', '18:30:00', 'Present'),
-- Mike (Junior) - Occasional Late
(6, 105, '2023-06-01', '09:15:00', '18:00:00', 'Late'),
(7, 105, '2023-06-02', '09:30:00', '18:30:00', 'Late'),
(8, 105, '2023-06-05', '09:00:00', '18:00:00', 'Present'),
(9, 105, '2023-06-06', '09:10:00', '18:15:00', 'Late'),
(10, 105, '2023-06-07', '08:55:00', '17:50:00', 'Present'),
-- Rachel (Sales) - Long hours
(11, 110, '2023-06-01', '08:30:00', '19:00:00', 'Present'),
(12, 110, '2023-06-02', '08:35:00', '18:45:00', 'Present'),
(13, 110, '2023-06-05', '08:30:00', '19:30:00', 'Present'),
(14, 110, '2023-06-06', '08:40:00', '19:00:00', 'Present'),
(15, 110, '2023-06-07', '08:30:00', '18:00:00', 'Present');

DROP TABLE IF EXISTS `hr_performance_reviews`;
CREATE TABLE `hr_performance_reviews` (
  `review_id` int NOT NULL COMMENT 'Review ID',
  `emp_id` int DEFAULT NULL COMMENT 'Employee ID',
  `review_date` date DEFAULT NULL COMMENT 'Date of review',
  `rating` int DEFAULT NULL COMMENT 'Rating 1-5 (5 is best)',
  `comments` text COMMENT 'Manager feedback',
  PRIMARY KEY (`review_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci COMMENT='Annual performance reviews';

INSERT INTO `hr_performance_reviews` VALUES 
(1, 101, '2022-12-15', 5, 'Exceptional performance. Ivy led the migration project successfully.'),
(2, 101, '2021-12-20', 4, 'Great start, solid coding skills.'),
(3, 102, '2022-12-15', 3, 'Met expectations but needs to improve on communication.'),
(4, 105, '2022-12-15', 3, 'Good learning curve, but attendance issues noted.'),
(5, 108, '2022-12-15', 5, 'Top sales performer of Q4.'),
(6, 109, '2022-12-15', 2, 'Missed quota for 2 consecutive quarters.'),
(7, 20, '2022-12-10', 4, 'Managed the team well during high pressure release.'),
(8, 21, '2022-12-10', 5, 'Zero downtime this year. Outstanding infrastructure management.');
