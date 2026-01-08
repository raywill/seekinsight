
-- HR Dataset: Workforce, Attendance, and Performance
-- Scale: Representative subset of a ~200 person company structure

DROP TABLE IF EXISTS "hr_departments";
CREATE TABLE "hr_departments" (
  "dept_id" integer NOT NULL,
  "dept_name" varchar(50) DEFAULT NULL,
  "location" varchar(50) DEFAULT NULL,
  "cost_center" varchar(20) DEFAULT NULL,
  PRIMARY KEY ("dept_id")
);
COMMENT ON TABLE "hr_departments" IS 'Department master data';
COMMENT ON COLUMN "hr_departments"."dept_id" IS 'Unique department identifier';
COMMENT ON COLUMN "hr_departments"."dept_name" IS 'Name of the department';
COMMENT ON COLUMN "hr_departments"."location" IS 'Physical office location';
COMMENT ON COLUMN "hr_departments"."cost_center" IS 'Accounting cost center code';

INSERT INTO "hr_departments" VALUES 
(100, 'Executive Office', 'New York', 'CC-001'),
(200, 'Engineering - Platform', 'San Francisco', 'CC-101'),
(201, 'Engineering - Product', 'San Francisco', 'CC-102'),
(202, 'Engineering - QA', 'San Francisco', 'CC-103'),
(300, 'Sales - North America', 'Chicago', 'CC-201'),
(301, 'Sales - EMEA', 'London', 'CC-202'),
(400, 'Marketing', 'New York', 'CC-301'),
(500, 'Human Resources', 'New York', 'CC-401'),
(600, 'Finance', 'New York', 'CC-501');

DROP TABLE IF EXISTS "hr_employees";
CREATE TABLE "hr_employees" (
  "emp_id" integer NOT NULL,
  "first_name" varchar(50) DEFAULT NULL,
  "last_name" varchar(50) DEFAULT NULL,
  "email" varchar(100) DEFAULT NULL,
  "gender" varchar(10) DEFAULT NULL,
  "dept_id" integer DEFAULT NULL,
  "job_title" varchar(100) DEFAULT NULL,
  "manager_id" integer DEFAULT NULL,
  "hire_date" date DEFAULT NULL,
  "employment_status" varchar(20) DEFAULT 'Active',
  PRIMARY KEY ("emp_id")
);
COMMENT ON TABLE "hr_employees" IS 'Core employee directory with hierarchy';
COMMENT ON COLUMN "hr_employees"."emp_id" IS 'Employee unique ID';
COMMENT ON COLUMN "hr_employees"."first_name" IS 'First name';
COMMENT ON COLUMN "hr_employees"."last_name" IS 'Last name';
COMMENT ON COLUMN "hr_employees"."email" IS 'Corporate email';
COMMENT ON COLUMN "hr_employees"."gender" IS 'Gender for diversity analytics';
COMMENT ON COLUMN "hr_employees"."dept_id" IS 'Department ID';
COMMENT ON COLUMN "hr_employees"."job_title" IS 'Official job title';
COMMENT ON COLUMN "hr_employees"."manager_id" IS 'Direct reporting manager ID';
COMMENT ON COLUMN "hr_employees"."hire_date" IS 'Date of joining';
COMMENT ON COLUMN "hr_employees"."employment_status" IS 'Active, Terminated, Leave';

INSERT INTO "hr_employees" VALUES 
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

DROP TABLE IF EXISTS "hr_salaries";
CREATE TABLE "hr_salaries" (
  "id" integer NOT NULL,
  "emp_id" integer DEFAULT NULL,
  "base_salary" integer DEFAULT NULL,
  "bonus_target" decimal(5,2) DEFAULT NULL,
  "effective_date" date DEFAULT NULL,
  PRIMARY KEY ("id")
);
COMMENT ON TABLE "hr_salaries" IS 'Compensation history';
COMMENT ON COLUMN "hr_salaries"."id" IS 'Record ID';
COMMENT ON COLUMN "hr_salaries"."emp_id" IS 'Employee ID';
COMMENT ON COLUMN "hr_salaries"."base_salary" IS 'Annual base salary in USD';
COMMENT ON COLUMN "hr_salaries"."bonus_target" IS 'Target bonus percentage (e.g. 0.15)';
COMMENT ON COLUMN "hr_salaries"."effective_date" IS 'Salary start date';

INSERT INTO "hr_salaries" VALUES 
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

DROP TABLE IF EXISTS "hr_attendance_daily";
CREATE TABLE "hr_attendance_daily" (
  "log_id" integer NOT NULL,
  "emp_id" integer DEFAULT NULL,
  "date" date DEFAULT NULL,
  "check_in" time DEFAULT NULL,
  "check_out" time DEFAULT NULL,
  "status" varchar(20) DEFAULT NULL,
  PRIMARY KEY ("log_id")
);
COMMENT ON TABLE "hr_attendance_daily" IS 'Daily attendance logs for June 2023';
COMMENT ON COLUMN "hr_attendance_daily"."log_id" IS 'Log entry ID';
COMMENT ON COLUMN "hr_attendance_daily"."emp_id" IS 'Employee ID';
COMMENT ON COLUMN "hr_attendance_daily"."date" IS 'Work date';
COMMENT ON COLUMN "hr_attendance_daily"."check_in" IS 'Clock in time';
COMMENT ON COLUMN "hr_attendance_daily"."check_out" IS 'Clock out time';
COMMENT ON COLUMN "hr_attendance_daily"."status" IS 'Present, Late, Absent, Leave';

-- Sample data for 1 week in June for a few employees
INSERT INTO "hr_attendance_daily" VALUES 
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

DROP TABLE IF EXISTS "hr_performance_reviews";
CREATE TABLE "hr_performance_reviews" (
  "review_id" integer NOT NULL,
  "emp_id" integer DEFAULT NULL,
  "review_date" date DEFAULT NULL,
  "rating" integer DEFAULT NULL,
  "comments" text,
  PRIMARY KEY ("review_id")
);
COMMENT ON TABLE "hr_performance_reviews" IS 'Annual performance reviews';
COMMENT ON COLUMN "hr_performance_reviews"."review_id" IS 'Review ID';
COMMENT ON COLUMN "hr_performance_reviews"."emp_id" IS 'Employee ID';
COMMENT ON COLUMN "hr_performance_reviews"."review_date" IS 'Date of review';
COMMENT ON COLUMN "hr_performance_reviews"."rating" IS 'Rating 1-5 (5 is best)';
COMMENT ON COLUMN "hr_performance_reviews"."comments" IS 'Manager feedback';

INSERT INTO "hr_performance_reviews" VALUES 
(1, 101, '2022-12-15', 5, 'Exceptional performance. Ivy led the migration project successfully.'),
(2, 101, '2021-12-20', 4, 'Great start, solid coding skills.'),
(3, 102, '2022-12-15', 3, 'Met expectations but needs to improve on communication.'),
(4, 105, '2022-12-15', 3, 'Good learning curve, but attendance issues noted.'),
(5, 108, '2022-12-15', 5, 'Top sales performer of Q4.'),
(6, 109, '2022-12-15', 2, 'Missed quota for 2 consecutive quarters.'),
(7, 20, '2022-12-10', 4, 'Managed the team well during high pressure release.'),
(8, 21, '2022-12-10', 5, 'Zero downtime this year. Outstanding infrastructure management.');
